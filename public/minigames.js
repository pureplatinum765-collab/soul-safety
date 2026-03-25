/* =============================================
   SOUL SAFETY — MINIGAMES v2
   Three real playable games with Practice + Challenge modes.
   ============================================= */
(function () {
  'use strict';

  /* ─── UTILS ─────────────────────────────── */
  const MINIGAME_API = window.MINIGAME_API || '';

  function apiHeaders(extra = {}) {
    const token = window.authToken || window.SOUL_SAFETY_BEARER_TOKEN
      || localStorage.getItem('soulSafetyBearerToken') || '';
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  }

  async function apiPost(path, body) {
    const res = await fetch(`${MINIGAME_API}${path}`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  function currentUser() {
    return window.currentUser
      || document.querySelector('.user-option.active')?.dataset.user
      || 'raphael';
  }

  function friendName() {
    const u = currentUser();
    return u === 'raphael' ? 'Taylor 🌿' : 'Raphael 🌻';
  }

  /* ─── MODAL SYSTEM ──────────────────────── */
  function openModal(title, html) {
    const overlay = document.getElementById('minigameOverlay');
    const titleEl = document.getElementById('minigameTitle');
    const content = document.getElementById('minigameContent');
    if (!overlay || !titleEl || !content) return;
    titleEl.textContent = title;
    content.innerHTML = html;
    overlay.hidden = false;
  }

  function closeModal() {
    const overlay = document.getElementById('minigameOverlay');
    if (overlay) overlay.hidden = true;
    stopPong(); // clean up animation loop
  }

  // Expose globally for inline onclick in index.html
  window.closeMinigameModal = closeModal;

  /* ─── MODE SELECTION ────────────────────── */
  function showModeSelect(gameKey, gameEmoji, gameTitle) {
    const friend = friendName();
    openModal(`${gameEmoji} ${gameTitle}`, `
      <p class="mg-mode-desc">Choose how to play:</p>
      <div class="mg-mode-select">
        <button class="mg-mode-btn" id="mgPracticeBtn">
          <span class="mg-mode-icon">🤖</span>
          <span class="mg-mode-label">
            <span class="mg-mode-title">Practice Mode</span>
            <span class="mg-mode-sub">Play solo against a simple AI — no internet needed</span>
          </span>
        </button>
        <button class="mg-mode-btn" id="mgChallengeBtn">
          <span class="mg-mode-icon">📨</span>
          <span class="mg-mode-label">
            <span class="mg-mode-title">Challenge ${friend}</span>
            <span class="mg-mode-sub">Play against AI, then send your result as a challenge</span>
          </span>
        </button>
      </div>
    `);

    document.getElementById('mgPracticeBtn').addEventListener('click', () => {
      launchGame(gameKey, 'practice');
    });
    document.getElementById('mgChallengeBtn').addEventListener('click', () => {
      launchGame(gameKey, 'challenge');
    });
  }

  function launchGame(gameKey, mode) {
    if (gameKey === 'pong')       openPong(mode);
    else if (gameKey === 'rps')   openRPS(mode);
    else if (gameKey === 'lucky-word') openLuckyWord(mode);
  }

  /* ─── CHALLENGE HELPER ──────────────────── */
  async function sendChallenge(game, payload) {
    const challenger = currentUser();
    const opponent   = challenger === 'raphael' ? 'taylor' : 'raphael';
    try {
      const ch = await apiPost('/api/challenge', { challenger, opponent, game, payload });
      const banner = document.getElementById('challengeBanner');
      if (banner) {
        banner.hidden = false;
        banner.textContent = `Challenge sent to ${friendName()} — ${game}!`;
      }
      return ch;
    } catch (e) {
      console.warn('Challenge API unavailable:', e);
      return null;
    }
  }

  /* ═══════════════════════════════════════════
     GAME 1 — PONG
  ═══════════════════════════════════════════ */
  let pongRAF = null;
  let pongActive = false;

  function stopPong() {
    pongActive = false;
    if (pongRAF) { cancelAnimationFrame(pongRAF); pongRAF = null; }
  }

  function openPong(mode) {
    stopPong();
    const title = mode === 'challenge' ? '🏓 Pong — Challenge Mode' : '🏓 Pong — Practice';
    openModal(title, `
      <div class="pong-wrapper">
        <div class="pong-score">
          <div class="pong-score-you">
            <div class="pong-score-label">You</div>
            <div id="pongScoreYou">0</div>
          </div>
          <span class="pong-score-sep">vs</span>
          <div class="pong-score-ai">
            <div class="pong-score-label">AI</div>
            <div id="pongScoreAi">0</div>
          </div>
        </div>
        <canvas id="pongCanvas" width="400" height="280"></canvas>
        <p class="pong-hint">Move your mouse (or touch) to control the left paddle</p>
      </div>
    `);
    startPong(mode);
  }

  function startPong(mode) {
    const canvas = document.getElementById('pongCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = canvas.width;
    const H = canvas.height;

    // Scale canvas on small screens
    const containerW = canvas.parentElement?.clientWidth || W;
    if (containerW < W) {
      const scale = containerW / W;
      canvas.style.width  = (W * scale) + 'px';
      canvas.style.height = (H * scale) + 'px';
    }

    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
    const COLOR = {
      bg:      () => isDark() ? '#1e1410' : '#faf6ef',
      paddle:  () => '#c2623a',
      aiPaddle:() => '#6b8e5f',
      ball:    () => '#c2623a',
      trail:   () => isDark() ? 'rgba(194,98,58,0.15)' : 'rgba(194,98,58,0.1)',
      text:    () => isDark() ? '#f0e8de' : '#3d2416',
      net:     () => isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    };

    const PW = 10, PH = 64, BALL_R = 7;
    const WIN_SCORE = 5;
    const INIT_SPEED = 4.5;

    let playerY = H / 2 - PH / 2;
    let aiY     = H / 2 - PH / 2;
    let scoreYou = 0, scoreAi = 0;
    let gameOver = false;
    let flashPaddle = 0; // frames to flash

    // Ball
    let bx = W / 2, by = H / 2;
    let vx = INIT_SPEED * (Math.random() > 0.5 ? 1 : -1);
    let vy = (Math.random() * 3 + 1.5) * (Math.random() > 0.5 ? 1 : -1);
    let speed = INIT_SPEED;

    // Trail
    const trail = [];

    // Mouse/touch control
    function getRelativeY(clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleY = H / rect.height;
      return (clientY - rect.top) * scaleY;
    }

    function onMouseMove(e) {
      if (!pongActive) return;
      playerY = getRelativeY(e.clientY) - PH / 2;
      playerY = Math.max(0, Math.min(H - PH, playerY));
    }

    function onTouchMove(e) {
      if (!pongActive) return;
      e.preventDefault();
      const t = e.touches[0];
      playerY = getRelativeY(t.clientY) - PH / 2;
      playerY = Math.max(0, Math.min(H - PH, playerY));
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    function resetBall(toRight) {
      bx = W / 2; by = H / 2;
      speed = INIT_SPEED;
      vx = speed * (toRight ? 1 : -1);
      vy = (Math.random() * 3 + 1.5) * (Math.random() > 0.5 ? 1 : -1);
      trail.length = 0;
    }

    function updateAI() {
      // AI follows ball center with slight lag
      const aiCenter = aiY + PH / 2;
      const target = by;
      const diff = target - aiCenter;
      // Difficulty: speed factor 0.065 makes it beatable
      const aiSpeed = Math.min(Math.abs(diff), speed * 0.78);
      if (Math.abs(diff) > 2) {
        aiY += Math.sign(diff) * aiSpeed;
        aiY = Math.max(0, Math.min(H - PH, aiY));
      }
    }

    function updateScoreEl() {
      const ey = document.getElementById('pongScoreYou');
      const ea = document.getElementById('pongScoreAi');
      if (ey) ey.textContent = scoreYou;
      if (ea) ea.textContent = scoreAi;
    }

    function shakeModal() {
      const modal = document.querySelector('.minigame-modal');
      if (!modal) return;
      modal.classList.remove('mg-shake');
      void modal.offsetWidth; // reflow
      modal.classList.add('mg-shake');
    }

    function drawNet() {
      ctx.strokeStyle = COLOR.net();
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawPaddle(x, y, color, flash) {
      ctx.fillStyle = flash > 0 ? '#fff' : color;
      ctx.shadowColor = flash > 0 ? '#fff' : color;
      ctx.shadowBlur = flash > 0 ? 18 : 6;
      ctx.beginPath();
      // Use fillRect for broad compatibility
      ctx.fillRect(x, y, PW, PH);
      ctx.shadowBlur = 0;
    }

    function drawBall() {
      // Trail
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        const a = (i / trail.length) * 0.55;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BALL_R * (i / trail.length) * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(194,98,58,${a})`;
        ctx.fill();
      }
      // Main ball
      ctx.beginPath();
      ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.ball();
      ctx.shadowColor = COLOR.ball();
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function showEndScreen(won) {
      pongActive = false;
      const emoji = won ? '🏆' : '🥲';
      const title = won ? 'You win!' : 'AI wins!';
      const sub   = won ? `You scored ${scoreYou} — ${scoreAi} against the AI` : `Score was ${scoreYou} — ${scoreAi}`;

      let actionsHtml = `<button class="mg-btn mg-btn-primary" id="pongPlayAgain">Play Again</button>`;
      if (mode === 'challenge') {
        actionsHtml += `<button class="mg-btn mg-btn-sage" id="pongSendChallenge">Send Challenge</button>`;
      }
      actionsHtml += `<button class="mg-btn mg-btn-ghost" id="pongBackMenu">Back</button>`;

      const content = document.getElementById('minigameContent');
      if (!content) return;
      content.innerHTML = `
        <div class="mg-result-screen">
          <div class="mg-result-emoji">${emoji}</div>
          <div class="mg-result-title">${title}</div>
          <div class="mg-result-sub">${sub}</div>
          <div class="mg-result-actions">${actionsHtml}</div>
        </div>
      `;

      document.getElementById('pongPlayAgain')?.addEventListener('click', () => openPong(mode));
      document.getElementById('pongBackMenu')?.addEventListener('click', () => showModeSelect('pong', '🏓', 'Pong Challenge'));
      document.getElementById('pongSendChallenge')?.addEventListener('click', async () => {
        await sendChallenge('pong', { scoreYou, scoreAi, result: won ? 'win' : 'loss' });
        content.innerHTML = `<div class="mg-challenge-result">Challenge sent to ${friendName()}! 🏓<br>Your score: <strong>${scoreYou} — ${scoreAi}</strong></div>`;
      });
    }

    function loop() {
      if (!pongActive) return;

      // Move ball
      trail.push({ x: bx, y: by });
      if (trail.length > 8) trail.shift();

      bx += vx;
      by += vy;

      // Top/bottom wall bounce
      if (by - BALL_R < 0) { by = BALL_R; vy = Math.abs(vy); }
      if (by + BALL_R > H) { by = H - BALL_R; vy = -Math.abs(vy); }

      // Player paddle collision (left side)
      const px = 10;
      if (bx - BALL_R < px + PW && bx - BALL_R > px - 2 &&
          by > playerY && by < playerY + PH && vx < 0) {
        vx = Math.abs(vx) * 1.04;
        // Angle based on hit position
        const hitPos = (by - playerY) / PH; // 0..1
        vy = (hitPos - 0.5) * 9;
        speed = Math.min(speed * 1.04, 13);
        vx = speed;
        bx = px + PW + BALL_R + 1;
        flashPaddle = 8;
      }

      // AI paddle collision (right side)
      const ax = W - 10 - PW;
      if (bx + BALL_R > ax && bx + BALL_R < ax + PW + 2 &&
          by > aiY && by < aiY + PH && vx > 0) {
        vx = -(Math.abs(vx) * 1.03);
        const hitPos = (by - aiY) / PH;
        vy = (hitPos - 0.5) * 9;
        speed = Math.min(speed * 1.03, 13);
        bx = ax - BALL_R - 1;
      }

      // Scoring
      if (bx < 0) {
        scoreAi++;
        updateScoreEl();
        shakeModal();
        if (scoreAi >= WIN_SCORE) { showEndScreen(false); return; }
        resetBall(true);
      }
      if (bx > W) {
        scoreYou++;
        updateScoreEl();
        if (scoreYou >= WIN_SCORE) { showEndScreen(true); return; }
        resetBall(false);
      }

      updateAI();
      if (flashPaddle > 0) flashPaddle--;

      // Draw
      ctx.fillStyle = COLOR.bg();
      ctx.fillRect(0, 0, W, H);
      drawNet();
      drawBall();
      drawPaddle(px, playerY, COLOR.paddle(), flashPaddle);
      drawPaddle(ax, aiY, COLOR.aiPaddle(), 0);

      pongRAF = requestAnimationFrame(loop);
    }

    pongActive = true;
    pongRAF = requestAnimationFrame(loop);
  }

  /* ═══════════════════════════════════════════
     GAME 2 — ROCK PAPER SCISSORS
  ═══════════════════════════════════════════ */
  const RPS_CHOICES = [
    { key: 'rock',     emoji: '🪨', label: 'Rock'     },
    { key: 'paper',    emoji: '📄', label: 'Paper'    },
    { key: 'scissors', emoji: '✂️', label: 'Scissors' }
  ];

  const RPS_BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

  const RPS_LINES = {
    win:  [
      'Nice move!', 'You got them!', 'Sharp thinking!',
      'Unstoppable!', 'Too smooth!'
    ],
    loss: [
      'Oh no!', 'So close…', 'The AI got lucky.',
      'Try again!', 'Not today!'
    ],
    draw: [
      'Great minds…', 'Perfect match!', 'Mirror image!', 'Tied!' ]
  };

  const RPS_DESCRIPTIONS = {
    'rock-scissors':    '🪨 Rock crushes ✂️ Scissors',
    'paper-rock':       '📄 Paper covers 🪨 Rock',
    'scissors-paper':   '✂️ Scissors cuts 📄 Paper',
    'rock-paper':       '📄 Paper covers 🪨 Rock',
    'paper-scissors':   '✂️ Scissors cuts 📄 Paper',
    'scissors-rock':    '🪨 Rock crushes ✂️ Scissors',
  };

  function rpsRandom() {
    return RPS_CHOICES[Math.floor(Math.random() * 3)];
  }

  function rpsOutcome(playerKey, aiKey) {
    if (playerKey === aiKey) return 'draw';
    return RPS_BEATS[playerKey] === aiKey ? 'win' : 'loss';
  }

  function rpsFlavorText(outcome, playerKey, aiKey) {
    const descKey = `${playerKey}-${aiKey}`;
    const desc = RPS_DESCRIPTIONS[descKey] || '';
    const lines = RPS_LINES[outcome];
    const line = lines[Math.floor(Math.random() * lines.length)];
    return outcome === 'draw'
      ? `Both picked ${RPS_CHOICES.find(c => c.key === playerKey).emoji} — ${line}`
      : `${desc} — ${line}`;
  }

  function openRPS(mode) {
    openModal(mode === 'challenge' ? '✂️ RPS — Challenge Mode' : '✂️ Rock Paper Scissors', buildRPSHtml());
    attachRPSEvents(mode);
  }

  function buildRPSHtml() {
    return `
      <div class="rps-wrapper">
        <div class="rps-scoreline">
          Round <span id="rpsRoundNum">1</span>/3
          <div class="rps-rounds">
            <div class="rps-round-dot" id="rpsDot0"></div>
            <div class="rps-round-dot" id="rpsDot1"></div>
            <div class="rps-round-dot" id="rpsDot2"></div>
          </div>
        </div>
        <div class="rps-arena">
          <div class="rps-combatant">
            <div class="rps-choice-display hidden-choice" id="rpsPlayerChoice">❓</div>
            <div class="rps-combatant-label">You</div>
          </div>
          <span class="rps-vs">VS</span>
          <div class="rps-combatant">
            <div class="rps-choice-display hidden-choice" id="rpsAiChoice">❓</div>
            <div class="rps-combatant-label">AI</div>
          </div>
        </div>
        <div class="rps-result-text" id="rpsResultText"></div>
        <div class="rps-picks" id="rpsPicksRow">
          ${RPS_CHOICES.map(c => `
            <button class="rps-pick-btn" data-rps-pick="${c.key}">
              <span class="rps-pick-emoji">${c.emoji}</span>
              ${c.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function attachRPSEvents(mode) {
    let round = 0;
    const results = []; // 'win'|'loss'|'draw'
    let busy = false;

    function updateRoundIndicator() {
      document.getElementById('rpsRoundNum').textContent = round + 1;
    }

    function disablePicks() {
      document.querySelectorAll('.rps-pick-btn').forEach(b => b.disabled = true);
    }
    function enablePicks() {
      document.querySelectorAll('.rps-pick-btn').forEach(b => b.disabled = false);
    }

    document.querySelectorAll('.rps-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        disablePicks();

        const playerKey = btn.dataset.rpsPick;
        const playerChoice = RPS_CHOICES.find(c => c.key === playerKey);
        const aiChoice = rpsRandom();

        // Show player's pick immediately
        const playerEl = document.getElementById('rpsPlayerChoice');
        const aiEl     = document.getElementById('rpsAiChoice');
        const resultEl = document.getElementById('rpsResultText');

        playerEl.textContent = playerChoice.emoji;
        playerEl.classList.remove('hidden-choice');
        aiEl.textContent = '⏳';
        resultEl.textContent = '';

        // Countdown then reveal
        let count = 3;
        resultEl.textContent = count;
        resultEl.style.fontSize = '2.2rem';
        resultEl.style.fontWeight = '700';

        const tick = setInterval(() => {
          count--;
          if (count > 0) {
            resultEl.textContent = count;
          } else {
            clearInterval(tick);

            // Reveal AI
            aiEl.textContent = aiChoice.emoji;
            aiEl.classList.remove('hidden-choice');
            aiEl.classList.add('rps-reveal');
            setTimeout(() => aiEl.classList.remove('rps-reveal'), 500);

            resultEl.style.fontSize = '';
            resultEl.style.fontWeight = '';

            const outcome = rpsOutcome(playerKey, aiChoice.key);
            results.push(outcome);

            // Update dot
            const dot = document.getElementById(`rpsDot${round}`);
            if (dot) dot.classList.add(outcome);

            // Flavor text
            resultEl.textContent = rpsFlavorText(outcome, playerKey, aiChoice.key);

            round++;

            // Check if game over (best of 3, or after 3 rounds)
            const wins  = results.filter(r => r === 'win').length;
            const losses= results.filter(r => r === 'loss').length;
            const done  = wins >= 2 || losses >= 2 || round >= 3;

            if (done) {
              setTimeout(() => showRPSEnd(results, mode), 1200);
            } else {
              setTimeout(() => {
                updateRoundIndicator();
                // Reset display for next round
                playerEl.textContent = '❓';
                playerEl.classList.add('hidden-choice');
                aiEl.textContent = '❓';
                aiEl.classList.add('hidden-choice');
                resultEl.textContent = '';
                enablePicks();
                busy = false;
              }, 1600);
            }
          }
        }, 600);
      });
    });
  }

  function showRPSEnd(results, mode) {
    const wins  = results.filter(r => r === 'win').length;
    const losses= results.filter(r => r === 'loss').length;
    const won   = wins > losses;
    const tied  = wins === losses;

    const emoji = won ? '🎉' : tied ? '🤝' : '😅';
    const title = won ? 'You win best of 3!' : tied ? 'It\'s a tie!' : 'AI wins this round!';
    const sub   = `${wins}W — ${losses}L — ${results.filter(r => r === 'draw').length}D`;

    let actionsHtml = `<button class="mg-btn mg-btn-primary" id="rpsPlayAgain">Play Again</button>`;
    if (mode === 'challenge') {
      actionsHtml += `<button class="mg-btn mg-btn-sage" id="rpsSend">Send Challenge</button>`;
    }
    actionsHtml += `<button class="mg-btn mg-btn-ghost" id="rpsBack">Back</button>`;

    const content = document.getElementById('minigameContent');
    if (!content) return;
    content.innerHTML = `
      <div class="mg-result-screen">
        <div class="mg-result-emoji">${emoji}</div>
        <div class="mg-result-title">${title}</div>
        <div class="mg-result-sub">${sub}</div>
        <div class="mg-result-actions">${actionsHtml}</div>
      </div>
    `;

    document.getElementById('rpsPlayAgain')?.addEventListener('click', () => openRPS(mode));
    document.getElementById('rpsBack')?.addEventListener('click', () => showModeSelect('rps', '✂️', 'Rock Paper Scissors'));
    document.getElementById('rpsSend')?.addEventListener('click', async () => {
      await sendChallenge('rps', { wins, losses, result: won ? 'win' : tied ? 'draw' : 'loss' });
      content.innerHTML = `<div class="mg-challenge-result">Challenge sent to ${friendName()}! ✂️<br>Your result: <strong>${wins}W — ${losses}L</strong></div>`;
    });
  }

  /* ═══════════════════════════════════════════
     GAME 3 — LUCKY WORD (Wordle-like, 4 letters)
  ═══════════════════════════════════════════ */
  const LW_WORDS = [
    'love','hope','calm','cozy','warm','glow','star','moon','leaf','wave',
    'rain','wild','free','soul','safe','home','kind','care','wish','soft',
    'fair','true','good','nice','pure','ease','rest','heal','grow','life',
    'dawn','dusk','nest','pond','bird','frog','deer','bear','rose','vine',
    'seed','root','peak','hill','lake','flow','wind','song','tune','bell',
    'gust','mist','haze','lush','bold','fern','clay','reef','brew','dune',
    'flux','gale','halo','iris','jade','kite','lark','mead','opus','pear',
    'quiz','ruby','sage','teal','vale','wren','yarn','zinc','aura','balm',
    'cove','dash','echo','foam','gulf','hive','idle','dusk','meld','heed',
    'grin','beam','lilt','muse','wisp','zeal','bask','cord','knot','lore',
    'mane','orbs','path','riff','sigh','twig','urge','vibe','waft','yore'
  ].filter(w => w.length === 4); // ensure all 4-letter

  const LW_MAX_GUESSES = 6;

  const LW_KB_ROWS = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['Enter','z','x','c','v','b','n','m','⌫']
  ];

  function lwPickWord() {
    return LW_WORDS[Math.floor(Math.random() * LW_WORDS.length)];
  }

  function openLuckyWord(mode) {
    const word = lwPickWord();
    openModal(mode === 'challenge' ? '🍀 Lucky Word — Challenge' : '🍀 Lucky Word', buildLWHtml());
    attachLWEvents(word, mode);
  }

  function buildLWHtml() {
    // Grid: 6 rows × 4 columns
    let gridHtml = '<div class="lw-grid">';
    for (let r = 0; r < LW_MAX_GUESSES; r++) {
      gridHtml += `<div class="lw-row" id="lwRow${r}">`;
      for (let c = 0; c < 4; c++) {
        gridHtml += `<div class="lw-cell" id="lwCell${r}${c}"></div>`;
      }
      gridHtml += '</div>';
    }
    gridHtml += '</div>';

    // Keyboard
    let kbHtml = '<div class="lw-keyboard">';
    for (const row of LW_KB_ROWS) {
      kbHtml += '<div class="lw-kb-row">';
      for (const key of row) {
        const wide = key === 'Enter' || key === '⌫' ? ' lw-key-wide' : '';
        kbHtml += `<button class="lw-key${wide}" data-lw-key="${key}">${key}</button>`;
      }
      kbHtml += '</div>';
    }
    kbHtml += '</div>';

    return `
      <div class="lw-wrapper">
        <p class="lw-info">Guess the 4-letter word in 6 tries</p>
        ${gridHtml}
        <div id="lwMessage" style="font-size:0.85rem;min-height:1.2em;text-align:center;color:#c2623a;font-weight:600;"></div>
        ${kbHtml}
      </div>
    `;
  }

  function attachLWEvents(answer, mode) {
    let currentRow = 0;
    let currentGuess = '';
    let gameOver = false;
    const keyStates = {}; // letter → 'correct'|'present'|'absent'

    function updateCurrentRow() {
      for (let c = 0; c < 4; c++) {
        const cell = document.getElementById(`lwCell${currentRow}${c}`);
        if (!cell) continue;
        cell.textContent = (currentGuess[c] || '').toUpperCase();
        cell.className = 'lw-cell' + (currentGuess[c] ? ' filled' : '');
      }
    }

    function showMessage(msg, color) {
      const el = document.getElementById('lwMessage');
      if (el) {
        el.textContent = msg;
        el.style.color = color || '#c2623a';
      }
    }

    function shakeRow(r) {
      const row = document.getElementById(`lwRow${r}`);
      if (!row) return;
      row.classList.remove('shake');
      void row.offsetWidth;
      row.classList.add('shake');
    }

    function revealRow(r, results) {
      const DELAY = 120;
      for (let c = 0; c < 4; c++) {
        const cell = document.getElementById(`lwCell${r}${c}`);
        if (!cell) continue;
        const state = results[c]; // 'correct'|'present'|'absent'
        setTimeout(() => {
          cell.classList.add('flip', state);
        }, c * DELAY);
      }
    }

    function updateKeyboard(results, guess) {
      const PRIORITY = { correct: 3, present: 2, absent: 1 };
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        const state = results[i];
        const existing = keyStates[letter];
        if (!existing || PRIORITY[state] > PRIORITY[existing]) {
          keyStates[letter] = state;
        }
      }
      document.querySelectorAll('.lw-key').forEach(btn => {
        const k = btn.dataset.lwKey?.toLowerCase();
        if (k && keyStates[k]) {
          btn.className = `lw-key${k.length > 1 ? ' lw-key-wide' : ''} ${keyStates[k]}`;
        }
      });
    }

    function evaluateGuess(guess) {
      const results = Array(4).fill('absent');
      const answerArr = answer.split('');
      const guessArr  = guess.split('');
      const used = Array(4).fill(false);

      // First pass: exact matches
      for (let i = 0; i < 4; i++) {
        if (guessArr[i] === answerArr[i]) {
          results[i] = 'correct';
          used[i] = true;
          guessArr[i] = null;
        }
      }
      // Second pass: wrong position
      for (let i = 0; i < 4; i++) {
        if (results[i] === 'correct') continue;
        for (let j = 0; j < 4; j++) {
          if (!used[j] && guessArr[i] === answerArr[j]) {
            results[i] = 'present';
            used[j] = true;
            break;
          }
        }
      }
      return results;
    }

    function submitGuess() {
      if (gameOver) return;
      const g = currentGuess.toLowerCase();
      if (g.length < 4) { showMessage('Need 4 letters!'); shakeRow(currentRow); return; }

      const results = evaluateGuess(g);
      revealRow(currentRow, results);
      updateKeyboard(results, g);
      showMessage('');

      const won = results.every(r => r === 'correct');
      const r   = currentRow;
      currentRow++;
      currentGuess = '';

      if (won) {
        gameOver = true;
        const tries = r + 1;
        setTimeout(() => {
          // Bounce winning row
          for (let c = 0; c < 4; c++) {
            const cell = document.getElementById(`lwCell${r}${c}`);
            if (cell) setTimeout(() => { cell.classList.add('bounce'); setTimeout(() => cell.classList.remove('bounce'), 400); }, c * 80);
          }
          setTimeout(() => showLWEnd(true, tries, answer, mode), 800);
        }, 4 * 120 + 100);
        return;
      }

      if (currentRow >= LW_MAX_GUESSES) {
        gameOver = true;
        setTimeout(() => showLWEnd(false, LW_MAX_GUESSES, answer, mode), 4 * 120 + 100);
      }
    }

    function onKey(key) {
      if (gameOver) return;
      if (key === 'Enter') {
        submitGuess();
      } else if (key === '⌫' || key === 'Backspace') {
        currentGuess = currentGuess.slice(0, -1);
        updateCurrentRow();
      } else if (/^[a-zA-Z]$/.test(key) && currentGuess.length < 4) {
        currentGuess += key.toLowerCase();
        updateCurrentRow();
      }
    }

    // On-screen keyboard
    document.querySelectorAll('.lw-key').forEach(btn => {
      btn.addEventListener('click', () => onKey(btn.dataset.lwKey));
    });

    // Physical keyboard
    function handleKeyDown(e) {
      if (document.getElementById('minigameOverlay')?.hidden) return;
      if (e.key === 'Escape') return; // let main handler close modal
      onKey(e.key === 'Backspace' ? '⌫' : e.key);
    }

    document.addEventListener('keydown', handleKeyDown);

    // Store handler for cleanup
    window.__lwKeyHandler = handleKeyDown;
  }

  function showLWEnd(won, tries, answer, mode) {
    // Remove physical key handler
    if (window.__lwKeyHandler) {
      document.removeEventListener('keydown', window.__lwKeyHandler);
      window.__lwKeyHandler = null;
    }

    const emoji = won ? (tries <= 2 ? '🌟' : '🍀') : '😔';
    const title = won ? `Found it in ${tries}!` : 'Not this time';
    const sub   = won
      ? (tries === 1 ? 'First try! Incredible!' : `${tries} guess${tries > 1 ? 'es' : ''} — well done!`)
      : `The word was "${answer.toUpperCase()}"`;

    let actionsHtml = `<button class="mg-btn mg-btn-primary" id="lwPlayAgain">Play Again</button>`;
    if (mode === 'challenge') {
      actionsHtml += `<button class="mg-btn mg-btn-sage" id="lwSend">Send Challenge</button>`;
    }
    actionsHtml += `<button class="mg-btn mg-btn-ghost" id="lwBack">Back</button>`;

    const content = document.getElementById('minigameContent');
    if (!content) return;
    content.innerHTML = `
      <div class="mg-result-screen">
        <div class="mg-result-emoji">${emoji}</div>
        <div class="mg-result-title">${title}</div>
        <div class="mg-result-sub">${sub}</div>
        <div class="mg-result-actions">${actionsHtml}</div>
      </div>
    `;

    document.getElementById('lwPlayAgain')?.addEventListener('click', () => openLuckyWord(mode));
    document.getElementById('lwBack')?.addEventListener('click', () => showModeSelect('lucky-word', '🍀', 'Lucky Word'));
    document.getElementById('lwSend')?.addEventListener('click', async () => {
      await sendChallenge('lucky-word', { word: answer, tries, result: won ? 'win' : 'loss' });
      content.innerHTML = `<div class="mg-challenge-result">Challenge sent to ${friendName()}! 🍀<br>${won ? `Solved in ${tries} tries` : 'Didn\'t get it this time'}</div>`;
    });
  }

  /* ─── BOOT ─────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // Launch buttons
    document.querySelectorAll('[data-minigame-launch]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-minigame-launch');
        if (type === 'pong') {
          showModeSelect('pong', '🏓', 'Pong Challenge');
        } else if (type === 'rps') {
          showModeSelect('rps', '✂️', 'Rock Paper Scissors');
        } else if (type === 'lucky-word') {
          showModeSelect('lucky-word', '🍀', 'Lucky Word');
        }
      });
    });

    // Close button & overlay click
    document.querySelector('[data-minigame-close]')?.addEventListener('click', closeModal);
    document.getElementById('minigameOverlay')?.addEventListener('click', e => {
      if (e.target.id === 'minigameOverlay') closeModal();
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  });

})();
