/* =============================================
   SOUL SAFETY — MINIGAMES v3
   Real-time multiplayer via Supabase Broadcast.
   Games: Pong 🏓 | Rock Paper Scissors ✂️ | Lucky Word 🍀
   ============================================= */
(function () {
  'use strict';

  /* ─── CONSTANTS ─────────────────────────────── */
  const MINIGAME_API = window.MINIGAME_API || '';
  const WIN_SCORE = 5;
  const PONG_W = 420;
  const PONG_H = 280;
  const PADDLE_W = 12;
  const PADDLE_H = 70;
  const PADDLE_X = 14;
  const BALL_R = 5;
  const BALL_SPEED_INIT = 5;
  const BALL_SPEED_MAX = 12;
  const LW_MAX_GUESSES = 6;
  const LW_WORD_LENGTH = 4;

  const LW_WORDS = [
    'love','hope','calm','cozy','warm','glow','star','moon','leaf','wave',
    'rain','soul','safe','home','kind','care','wish','soft','fair','true',
    'good','pure','ease','rest','heal','grow','life','dawn','dusk','nest',
    'pond','bird','frog','deer','rose','vine','seed','root','peak','hill',
    'lake','flow','wind','song','tune','bell','mist','fire','tree','path',
    'open','bold','free','wild','play','find','feel','know','give','hold',
    'lift','walk','stay','grin','hush','damp','roam','soar','gust','haze',
    'deep','tall','wide','cool','keen','glad','fond','dear','vast','lush',
    'rich','full','real','bare','gold','blue','pink','grey','aqua','mint',
    'clay','dust','tide','fall','rise','turn','gaze','pace','lace','harp',
    'drum','arch','lens','silk','wool','fern'
  ].filter(w => w.length === LW_WORD_LENGTH);

  const RPS_CHOICES = [
    { key: 'rock',     emoji: '🪨', label: 'Rock'     },
    { key: 'paper',    emoji: '📄', label: 'Paper'    },
    { key: 'scissors', emoji: '✂️', label: 'Scissors' }
  ];

  const RPS_BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

  const LW_KB_ROWS = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['Enter','z','x','c','v','b','n','m','⌫']
  ];

  /* ─── UTILS ─────────────────────────────────── */
  function apiHeaders(extra) {
    extra = extra || {};
    const token = window.authToken || window.SOUL_SAFETY_BEARER_TOKEN
      || localStorage.getItem('soulSafetyBearerToken') || '';
    return token ? Object.assign({ Authorization: 'Bearer ' + token }, extra) : extra;
  }

  async function apiPost(path, body) {
    const res = await fetch(MINIGAME_API + path, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + ': ' + text);
    }
    return res.json();
  }

  async function apiGet(path) {
    const res = await fetch(MINIGAME_API + path, {
      method: 'GET',
      headers: apiHeaders(),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('API error: ' + res.status);
    return res.json();
  }

  function currentUser() {
    return window.currentUser
      || document.querySelector('.user-option.active') && document.querySelector('.user-option.active').dataset.user
      || 'raphael';
  }

  function opponentOf(user) {
    return user === 'raphael' ? 'taylor' : 'raphael';
  }

  function displayName(userId) {
    return userId === 'raphael' ? 'Raphael 🌻' : 'Taylor 🌿';
  }

  function friendDisplayName() {
    return displayName(opponentOf(currentUser()));
  }

  function lwPickWord() {
    return LW_WORDS[Math.floor(Math.random() * LW_WORDS.length)];
  }

  function rpsRandom() {
    return RPS_CHOICES[Math.floor(Math.random() * 3)];
  }

  function rpsOutcome(playerKey, opponentKey) {
    if (playerKey === opponentKey) return 'draw';
    return RPS_BEATS[playerKey] === opponentKey ? 'win' : 'loss';
  }

  /* ─── SUPABASE CLIENT ───────────────────────── */
  // Wait for window.supabase to be initialized by the app
  let _supabaseReady = false;
  let _supabaseCallbacks = [];

  function whenSupabase(cb) {
    if (window.supabase) { cb(window.supabase); return; }
    if (_supabaseReady) { cb(window.supabase); return; }
    _supabaseCallbacks.push(cb);
  }

  function pollForSupabase() {
    if (window.supabase) {
      _supabaseReady = true;
      _supabaseCallbacks.forEach(function(cb) { try { cb(window.supabase); } catch(e) {} });
      _supabaseCallbacks = [];
      return;
    }
    setTimeout(pollForSupabase, 200);
  }
  pollForSupabase();

  /* ─── ACTIVE CHANNEL CLEANUP ────────────────── */
  let _activeChannel = null;

  function cleanupChannel() {
    if (_activeChannel && window.supabase) {
      window.supabase.removeChannel(_activeChannel).catch(function() {});
      _activeChannel = null;
    }
  }

  /* ─── MODAL SYSTEM ──────────────────────────── */
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
    stopPong();
    cleanupChannel();
    if (window.__lwKeyHandler) {
      document.removeEventListener('keydown', window.__lwKeyHandler);
      window.__lwKeyHandler = null;
    }
    _rpsState = null;
    _lwState = null;
    window.__boardMinigameActive = false;
  }

  window.closeMinigameModal = closeModal;

  function setModalContent(html) {
    const content = document.getElementById('minigameContent');
    if (content) content.innerHTML = html;
  }

  /* ─── MODE SELECTION ────────────────────────── */
  function showModeSelect(gameKey, gameEmoji, gameTitle) {
    const friend = friendDisplayName();
    openModal(gameEmoji + ' ' + gameTitle, `
      <p class="mg-mode-desc">How would you like to play?</p>
      <div class="mg-mode-select">
        <button class="mg-mode-btn" id="mgPracticeBtn">
          <span class="mg-mode-icon">🤖</span>
          <span class="mg-mode-label">
            <span class="mg-mode-title">Practice Mode</span>
            <span class="mg-mode-sub">Solo against a simple AI — no internet needed</span>
          </span>
        </button>
        <button class="mg-mode-btn" id="mgChallengeBtn">
          <span class="mg-mode-icon">📡</span>
          <span class="mg-mode-label">
            <span class="mg-mode-title">Challenge ${friend}</span>
            <span class="mg-mode-sub">Real-time multiplayer — play together live</span>
          </span>
        </button>
      </div>
    `);
    document.getElementById('mgPracticeBtn').addEventListener('click', function() {
      launchGame(gameKey, 'practice');
    });
    document.getElementById('mgChallengeBtn').addEventListener('click', function() {
      launchGame(gameKey, 'multiplayer');
    });
  }

  function launchGame(gameKey, mode) {
    if (gameKey === 'pong')           openPong(mode);
    else if (gameKey === 'rps')       openRPS(mode);
    else if (gameKey === 'lucky-word') openLuckyWord(mode);
  }

  /* ─── CHALLENGE CREATION ────────────────────── */
  async function createChallenge(gameType) {
    const challenger = currentUser();
    const opponent   = opponentOf(challenger);
    const data = await apiPost('/api/challenge', {
      challenger,
      opponent,
      game: gameType
    });
    return data; // { id, challenger, opponent, game, status, ... }
  }

  /* ─── WAITING SCREEN ────────────────────────── */
  function showWaiting(message) {
    setModalContent(`
      <div class="mg-waiting">
        <div class="mg-waiting-pulse">📡</div>
        <div class="mg-waiting-text">${message}</div>
      </div>
    `);
  }

  /* ─── RESULT SCREEN ─────────────────────────── */
  function showGameResult(opts) {
    // opts: { emoji, title, sub, onPlayAgain, onBack, backLabel, gameKey, gameEmoji, gameTitle, won }

    /* Board-game integration: if a board-game challenge launched this minigame,
       show a simplified result screen and fire the callback instead of
       showing Play Again / Back buttons. */
    if (window.__boardMinigameActive && typeof window.__boardGameResultCallback === 'function') {
      var won = !!opts.won;
      setModalContent(`
        <div class="mg-result-screen">
          <div class="mg-result-emoji">${opts.emoji}</div>
          <div class="mg-result-title">${opts.title}</div>
          <div class="mg-result-sub">${opts.sub}</div>
          <div class="mg-result-actions">
            <button class="mg-btn mg-btn-primary" id="mgBoardReturn">${won ? '🏆 Claim Reward' : '😤 Back to Board'}</button>
          </div>
        </div>
      `);
      document.getElementById('mgBoardReturn').addEventListener('click', function () {
        window.__boardMinigameActive = false;
        closeModal();
        if (typeof window.__boardGameResultCallback === 'function') {
          window.__boardGameResultCallback(won);
        }
      });
      return;
    }

    setModalContent(`
      <div class="mg-result-screen">
        <div class="mg-result-emoji">${opts.emoji}</div>
        <div class="mg-result-title">${opts.title}</div>
        <div class="mg-result-sub">${opts.sub}</div>
        <div class="mg-result-actions">
          <button class="mg-btn mg-btn-primary" id="mgResultPlayAgain">Play Again</button>
          <button class="mg-btn mg-btn-ghost" id="mgResultBack">${opts.backLabel || 'Back'}</button>
        </div>
      </div>
    `);
    document.getElementById('mgResultPlayAgain').addEventListener('click', opts.onPlayAgain);
    document.getElementById('mgResultBack').addEventListener('click', opts.onBack);
  }

  /* ════════════════════════════════════════════════
     GAME 1 — PONG 🏓
  ════════════════════════════════════════════════ */
  let pongRAF = null;
  let pongActive = false;
  let _pongChannel = null;

  function stopPong() {
    pongActive = false;
    if (pongRAF) { cancelAnimationFrame(pongRAF); pongRAF = null; }
    if (_pongChannel && window.supabase) {
      window.supabase.removeChannel(_pongChannel).catch(function() {});
      _pongChannel = null;
    }
  }

  function openPong(mode) {
    stopPong();
    if (mode === 'multiplayer') {
      startPongMultiplayer();
    } else {
      startPongPractice();
    }
  }

  /* ── Pong shared rendering ── */
  function buildPongModalHtml(label1, label2) {
    return `
      <div class="pong-wrapper">
        <div class="pong-score">
          <div class="pong-score-you">
            <div class="pong-score-label">${label1}</div>
            <div id="pongS1">0</div>
          </div>
          <span class="pong-score-sep">vs</span>
          <div class="pong-score-ai">
            <div class="pong-score-label">${label2}</div>
            <div id="pongS2">0</div>
          </div>
        </div>
        <canvas id="pongCanvas" width="${PONG_W}" height="${PONG_H}"></canvas>
        <p class="pong-hint" id="pongHint">Move your mouse or touch to control your paddle</p>
      </div>
    `;
  }

  function renderPong(ctx, state) {
    const W = PONG_W, H = PONG_H;

    // Background
    ctx.fillStyle = '#0f0f14';
    ctx.fillRect(0, 0, W, H);

    // Center line
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles
    ctx.fillStyle = '#c2623a'; // host/left (Raphael color)
    ctx.fillRect(PADDLE_X, state.p1y - PADDLE_H / 2, PADDLE_W, PADDLE_H);
    ctx.fillStyle = '#6b8e5f'; // guest/right (Taylor color)
    ctx.fillRect(W - PADDLE_X - PADDLE_W, state.p2y - PADDLE_H / 2, PADDLE_W, PADDLE_H);

    // Ball trail
    if (state.trail && state.trail.length) {
      state.trail.forEach(function(pos, i) {
        ctx.globalAlpha = (i + 1) / state.trail.length * 0.5;
        ctx.fillStyle = '#daa520';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BALL_R * ((i + 1) / state.trail.length), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // Ball
    ctx.fillStyle = '#faf6ef';
    ctx.beginPath();
    ctx.arc(state.bx, state.by, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Scores
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#ffffff88';
    ctx.textAlign = 'center';
    ctx.fillText(state.s1, W / 4, 40);
    ctx.fillText(state.s2, 3 * W / 4, 40);
    ctx.textAlign = 'left';
  }

  function updatePongScoreEls(s1, s2) {
    const el1 = document.getElementById('pongS1');
    const el2 = document.getElementById('pongS2');
    if (el1) el1.textContent = s1;
    if (el2) el2.textContent = s2;
  }

  function shakeCanvas() {
    const modal = document.querySelector('.minigame-modal');
    if (!modal) return;
    modal.classList.remove('mg-shake');
    void modal.offsetWidth;
    modal.classList.add('mg-shake');
  }

  /* ── Pong: Practice Mode ── */
  function startPongPractice() {
    openModal('🏓 Pong — Practice', buildPongModalHtml('You', 'AI'));
    const canvas = document.getElementById('pongCanvas');
    if (!canvas) return;
    scalePongCanvas(canvas);
    const ctx = canvas.getContext('2d');

    let p1y = PONG_H / 2;   // left/player paddle center
    let p2y = PONG_H / 2;   // right/AI paddle center
    let bx = PONG_W / 2, by = PONG_H / 2;
    let bvx = BALL_SPEED_INIT * (Math.random() > 0.5 ? 1 : -1);
    let bvy = (Math.random() * 2.5 + 1.5) * (Math.random() > 0.5 ? 1 : -1);
    let speed = BALL_SPEED_INIT;
    let s1 = 0, s2 = 0;
    const trail = [];

    function resetBall(dir) {
      bx = PONG_W / 2; by = PONG_H / 2;
      speed = BALL_SPEED_INIT;
      bvx = speed * dir;
      bvy = (Math.random() * 2.5 + 1.5) * (Math.random() > 0.5 ? 1 : -1);
      trail.length = 0;
    }

    function getCanvasY(clientY) {
      const rect = canvas.getBoundingClientRect();
      return (clientY - rect.top) * (PONG_H / rect.height);
    }

    canvas.addEventListener('mousemove', function(e) {
      if (!pongActive) return;
      p1y = Math.max(PADDLE_H / 2, Math.min(PONG_H - PADDLE_H / 2, getCanvasY(e.clientY)));
    });
    canvas.addEventListener('touchmove', function(e) {
      if (!pongActive) return;
      e.preventDefault();
      p1y = Math.max(PADDLE_H / 2, Math.min(PONG_H - PADDLE_H / 2, getCanvasY(e.touches[0].clientY)));
    }, { passive: false });

    function loop() {
      if (!pongActive) return;

      // AI tracks ball with slight lag
      const aiDiff = by - p2y;
      const aiSpd = Math.min(Math.abs(aiDiff), speed * 0.75);
      if (Math.abs(aiDiff) > 2) p2y += Math.sign(aiDiff) * aiSpd;
      p2y = Math.max(PADDLE_H / 2, Math.min(PONG_H - PADDLE_H / 2, p2y));

      // Trail
      trail.push({ x: bx, y: by });
      if (trail.length > 6) trail.shift();

      bx += bvx;
      by += bvy;

      // Wall bounce
      if (by - BALL_R < 0) { by = BALL_R; bvy = Math.abs(bvy); }
      if (by + BALL_R > PONG_H) { by = PONG_H - BALL_R; bvy = -Math.abs(bvy); }

      // Left paddle collision
      const lx = PADDLE_X + PADDLE_W;
      if (bvx < 0 && bx - BALL_R < lx && bx - BALL_R > PADDLE_X - 2 &&
          by > p1y - PADDLE_H / 2 && by < p1y + PADDLE_H / 2) {
        speed = Math.min(speed + 0.3, BALL_SPEED_MAX);
        bvx = speed;
        bvy = ((by - p1y) / (PADDLE_H / 2)) * speed * 0.85;
        bx = lx + BALL_R + 1;
      }

      // Right paddle collision
      const rx = PONG_W - PADDLE_X - PADDLE_W;
      if (bvx > 0 && bx + BALL_R > rx && bx + BALL_R < rx + PADDLE_W + 2 &&
          by > p2y - PADDLE_H / 2 && by < p2y + PADDLE_H / 2) {
        speed = Math.min(speed + 0.3, BALL_SPEED_MAX);
        bvx = -speed;
        bvy = ((by - p2y) / (PADDLE_H / 2)) * speed * 0.85;
        bx = rx - BALL_R - 1;
      }

      // Scoring
      if (bx < 0) {
        s2++; updatePongScoreEls(s1, s2); shakeCanvas();
        if (s2 >= WIN_SCORE) { pongActive = false; showPongEnd(false, s1, s2, 'practice'); return; }
        resetBall(1);
      }
      if (bx > PONG_W) {
        s1++; updatePongScoreEls(s1, s2);
        if (s1 >= WIN_SCORE) { pongActive = false; showPongEnd(true, s1, s2, 'practice'); return; }
        resetBall(-1);
      }

      renderPong(ctx, { p1y, p2y, bx, by, s1, s2, trail });
      pongRAF = requestAnimationFrame(loop);
    }

    pongActive = true;
    pongRAF = requestAnimationFrame(loop);
  }

  /* ── Pong: Multiplayer Mode ── */
  async function startPongMultiplayer() {
    const me = currentUser();
    const friend = friendDisplayName();

    showWaiting('Creating challenge...');

    let challengeId, myRole;
    try {
      const ch = await createChallenge('pong');
      challengeId = ch.id;
      myRole = 'host'; // challenger is always host
    } catch (e) {
      setModalContent('<div class="mg-error">Could not create challenge: ' + e.message + '<br><button class="mg-btn mg-btn-ghost" onclick="window.closeMinigameModal()">Close</button></div>');
      return;
    }

    showWaiting('Waiting for ' + friend + ' to accept...');

    whenSupabase(function(sb) {
      const channelName = 'ss-game-' + challengeId;
      let opponentReady = false;
      let gameStarted = false;

      // Pong state (host only)
      let p1y = PONG_H / 2;
      let p2y = PONG_H / 2; // received from guest
      let bx = PONG_W / 2, by = PONG_H / 2;
      let bvx = BALL_SPEED_INIT * (Math.random() > 0.5 ? 1 : -1);
      let bvy = (Math.random() * 2.5 + 1.5) * (Math.random() > 0.5 ? 1 : -1);
      let speed = BALL_SPEED_INIT;
      let s1 = 0, s2 = 0;
      const trail = [];

      // Guest-side interpolation
      let guestBx = PONG_W / 2, guestBy = PONG_H / 2;
      let guestP1y = PONG_H / 2;
      let guestP2y = PONG_H / 2;
      let guestS1 = 0, guestS2 = 0;
      let guestTrail = [];
      let guestPaddleSendTimer = 0;

      const channel = sb.channel(channelName)
        .on('broadcast', { event: 'player-ready' }, function(msg) {
          const pl = msg.payload;
          if (pl && pl.role === 'guest') {
            opponentReady = true;
            if (!gameStarted) startPongGame();
          }
        })
        .on('broadcast', { event: 'pong-state' }, function(msg) {
          // Guest receives ball state from host
          const pl = msg.payload;
          if (!pl) return;
          guestBx = pl.bx;
          guestBy = pl.by;
          guestP1y = pl.p1y;
          guestS1 = pl.s1;
          guestS2 = pl.s2;
          guestTrail = pl.trail || [];
          updatePongScoreEls(pl.s1, pl.s2);
        })
        .on('broadcast', { event: 'pong-paddle' }, function(msg) {
          // Host receives guest paddle position
          const pl = msg.payload;
          if (pl && typeof pl.y === 'number') p2y = pl.y;
        })
        .on('broadcast', { event: 'pong-end' }, function(msg) {
          const pl = msg.payload;
          if (!pl || gameStarted === false) return;
          stopPong();
          const iWon = pl.winner === me;
          showPongEnd(iWon, pl.s1, pl.s2, 'multiplayer', pl.winner);
        })
        .subscribe(function() {
          // Announce self as host
          channel.send({ type: 'broadcast', event: 'player-ready', payload: { player: me, role: 'host' } });
        });

      _pongChannel = channel;
      _activeChannel = channel;

      function startPongGame() {
        if (gameStarted) return;
        gameStarted = true;

        if (myRole === 'host') {
          openModal('🏓 Pong vs ' + friend, buildPongModalHtml(displayName(me), friend));
        } else {
          openModal('🏓 Pong vs ' + friend, buildPongModalHtml(displayName(me), friend));
        }

        const canvas = document.getElementById('pongCanvas');
        if (!canvas) return;
        scalePongCanvas(canvas);
        const ctx = canvas.getContext('2d');

        // Set up paddle control (both roles control their respective paddle)
        canvas.addEventListener('mousemove', function(e) {
          if (!pongActive) return;
          const y = Math.max(PADDLE_H / 2, Math.min(PONG_H - PADDLE_H / 2,
            (e.clientY - canvas.getBoundingClientRect().top) * (PONG_H / canvas.getBoundingClientRect().height)));
          if (myRole === 'host') { p1y = y; }
          else { guestP2y = y; }
        });
        canvas.addEventListener('touchmove', function(e) {
          if (!pongActive) return;
          e.preventDefault();
          const y = Math.max(PADDLE_H / 2, Math.min(PONG_H - PADDLE_H / 2,
            (e.touches[0].clientY - canvas.getBoundingClientRect().top) * (PONG_H / canvas.getBoundingClientRect().height)));
          if (myRole === 'host') { p1y = y; }
          else { guestP2y = y; }
        }, { passive: false });

        function resetBall(dir) {
          bx = PONG_W / 2; by = PONG_H / 2;
          speed = BALL_SPEED_INIT;
          bvx = speed * dir;
          bvy = (Math.random() * 2.5 + 1.5) * (Math.random() > 0.5 ? 1 : -1);
          trail.length = 0;
        }

        function broadcastPongEnd(winner) {
          channel.send({ type: 'broadcast', event: 'pong-end', payload: { winner, s1, s2 } });
        }

        function hostLoop() {
          if (!pongActive) return;

          trail.push({ x: bx, y: by });
          if (trail.length > 6) trail.shift();

          bx += bvx;
          by += bvy;

          // Wall bounce
          if (by - BALL_R < 0) { by = BALL_R; bvy = Math.abs(bvy); }
          if (by + BALL_R > PONG_H) { by = PONG_H - BALL_R; bvy = -Math.abs(bvy); }

          // Left (host) paddle collision
          const lx = PADDLE_X + PADDLE_W;
          if (bvx < 0 && bx - BALL_R < lx && bx - BALL_R > PADDLE_X - 2 &&
              by > p1y - PADDLE_H / 2 && by < p1y + PADDLE_H / 2) {
            speed = Math.min(speed + 0.3, BALL_SPEED_MAX);
            bvx = speed;
            bvy = ((by - p1y) / (PADDLE_H / 2)) * speed * 0.85;
            bx = lx + BALL_R + 1;
          }

          // Right (guest) paddle collision — uses last broadcast p2y
          const rx = PONG_W - PADDLE_X - PADDLE_W;
          if (bvx > 0 && bx + BALL_R > rx && bx + BALL_R < rx + PADDLE_W + 2 &&
              by > p2y - PADDLE_H / 2 && by < p2y + PADDLE_H / 2) {
            speed = Math.min(speed + 0.3, BALL_SPEED_MAX);
            bvx = -speed;
            bvy = ((by - p2y) / (PADDLE_H / 2)) * speed * 0.85;
            bx = rx - BALL_R - 1;
          }

          // Scoring
          if (bx < 0) {
            s2++; updatePongScoreEls(s1, s2); shakeCanvas();
            if (s2 >= WIN_SCORE) {
              pongActive = false;
              broadcastPongEnd(opponentOf(me));
              showPongEnd(false, s1, s2, 'multiplayer', opponentOf(me));
              return;
            }
            resetBall(1);
          }
          if (bx > PONG_W) {
            s1++; updatePongScoreEls(s1, s2);
            if (s1 >= WIN_SCORE) {
              pongActive = false;
              broadcastPongEnd(me);
              showPongEnd(true, s1, s2, 'multiplayer', me);
              return;
            }
            resetBall(-1);
          }

          // Broadcast state every frame
          channel.send({
            type: 'broadcast', event: 'pong-state',
            payload: { bx, by, bvx, bvy, p1y, s1, s2, trail: trail.slice() }
          });

          renderPong(ctx, { p1y, p2y, bx, by, s1, s2, trail });
          pongRAF = requestAnimationFrame(hostLoop);
        }

        function guestLoop() {
          if (!pongActive) return;

          // Send own paddle position every 50ms
          guestPaddleSendTimer++;
          if (guestPaddleSendTimer >= 3) {
            guestPaddleSendTimer = 0;
            channel.send({ type: 'broadcast', event: 'pong-paddle', payload: { y: guestP2y } });
          }

          // Lerp ball for smooth render
          guestBx += (guestBx - guestBx) * 0.2;
          guestBy += (guestBy - guestBy) * 0.2;

          renderPong(ctx, {
            p1y: guestP1y,
            p2y: guestP2y,
            bx: guestBx,
            by: guestBy,
            s1: guestS1,
            s2: guestS2,
            trail: guestTrail
          });
          pongRAF = requestAnimationFrame(guestLoop);
        }

        pongActive = true;
        if (myRole === 'host') {
          pongRAF = requestAnimationFrame(hostLoop);
        } else {
          pongRAF = requestAnimationFrame(guestLoop);
        }
      }

      // Store start function for guest to call on accept
      channel._startGame = startPongGame;
    });
  }

  /* ── Pong accept side (guest) ── */
  async function joinPongAsGuest(challengeId) {
    const me = currentUser();
    const friend = displayName(opponentOf(me));

    whenSupabase(function(sb) {
      const channelName = 'ss-game-' + challengeId;
      let gameStarted = false;

      let guestP2y = PONG_H / 2;
      let guestBx = PONG_W / 2, guestBy = PONG_H / 2;
      let guestP1y = PONG_H / 2;
      let guestS1 = 0, guestS2 = 0;
      let guestTrail = [];
      let guestPaddleSendTimer = 0;

      const channel = sb.channel(channelName)
        .on('broadcast', { event: 'player-ready' }, function(msg) {
          const pl = msg.payload;
          if (pl && pl.role === 'host' && !gameStarted) {
            startGame();
          }
        })
        .on('broadcast', { event: 'pong-state' }, function(msg) {
          const pl = msg.payload;
          if (!pl) return;
          guestBx = pl.bx;
          guestBy = pl.by;
          guestP1y = pl.p1y;
          guestS1 = pl.s1;
          guestS2 = pl.s2;
          guestTrail = pl.trail || [];
          updatePongScoreEls(pl.s1, pl.s2);
        })
        .on('broadcast', { event: 'pong-end' }, function(msg) {
          const pl = msg.payload;
          if (!pl) return;
          stopPong();
          const iWon = pl.winner === me;
          showPongEnd(iWon, pl.s1, pl.s2, 'multiplayer', pl.winner);
        })
        .subscribe(function() {
          channel.send({ type: 'broadcast', event: 'player-ready', payload: { player: me, role: 'guest' } });
        });

      _pongChannel = channel;
      _activeChannel = channel;

      function startGame() {
        if (gameStarted) return;
        gameStarted = true;

        openModal('🏓 Pong vs ' + friend, buildPongModalHtml(friend, displayName(me)));

        const canvas = document.getElementById('pongCanvas');
        if (!canvas) return;
        scalePongCanvas(canvas);
        const ctx = canvas.getContext('2d');

        canvas.addEventListener('mousemove', function(e) {
          if (!pongActive) return;
          guestP2y = Math.max(PADDLE_H / 2, Math.min(PONG_H - PADDLE_H / 2,
            (e.clientY - canvas.getBoundingClientRect().top) * (PONG_H / canvas.getBoundingClientRect().height)));
        });
        canvas.addEventListener('touchmove', function(e) {
          if (!pongActive) return;
          e.preventDefault();
          guestP2y = Math.max(PADDLE_H / 2, Math.min(PONG_H - PADDLE_H / 2,
            (e.touches[0].clientY - canvas.getBoundingClientRect().top) * (PONG_H / canvas.getBoundingClientRect().height)));
        }, { passive: false });

        function guestLoop() {
          if (!pongActive) return;
          guestPaddleSendTimer++;
          if (guestPaddleSendTimer >= 3) {
            guestPaddleSendTimer = 0;
            channel.send({ type: 'broadcast', event: 'pong-paddle', payload: { y: guestP2y } });
          }
          renderPong(ctx, {
            p1y: guestP1y,
            p2y: guestP2y,
            bx: guestBx,
            by: guestBy,
            s1: guestS1,
            s2: guestS2,
            trail: guestTrail
          });
          pongRAF = requestAnimationFrame(guestLoop);
        }

        pongActive = true;
        pongRAF = requestAnimationFrame(guestLoop);
      }

      // Immediately try to start (host may already be ready)
      setTimeout(startGame, 1500);
    });
  }

  function scalePongCanvas(canvas) {
    const parentW = canvas.parentElement ? canvas.parentElement.clientWidth : PONG_W;
    if (parentW < PONG_W) {
      const scale = parentW / PONG_W;
      canvas.style.width = (PONG_W * scale) + 'px';
      canvas.style.height = (PONG_H * scale) + 'px';
    }
  }

  function showPongEnd(iWon, s1, s2, mode, winnerUserId) {
    stopPong();
    let title, sub, emoji;
    if (mode === 'multiplayer' && winnerUserId) {
      title = iWon ? 'You win!' : displayName(winnerUserId) + ' wins!';
      emoji = iWon ? '🏆' : '🥲';
      sub = s1 + ' — ' + s2;
    } else {
      title = iWon ? 'You win!' : 'AI wins!';
      emoji = iWon ? '🏆' : '🥲';
      sub = 'Score: ' + s1 + ' — ' + s2;
    }
    showGameResult({
      emoji, title, sub, won: iWon,
      onPlayAgain: function() { openPong(mode); },
      onBack: function() { showModeSelect('pong', '🏓', 'Pong Challenge'); }
    });
  }

  /* ════════════════════════════════════════════════
     GAME 2 — ROCK PAPER SCISSORS ✂️
  ════════════════════════════════════════════════ */
  let _rpsState = null;
  let _rpsChannel = null;

  function openRPS(mode) {
    cleanupRPS();
    if (mode === 'multiplayer') {
      startRPSMultiplayer();
    } else {
      startRPSPractice();
    }
  }

  function cleanupRPS() {
    if (_rpsChannel && window.supabase) {
      window.supabase.removeChannel(_rpsChannel).catch(function() {});
      _rpsChannel = null;
    }
    _rpsState = null;
  }

  function buildRPSHtml(label1, label2) {
    return `
      <div class="rps-wrapper">
        <div class="rps-scoreline">
          Round <span id="rpsRoundNum">1</span> of 3
          <div class="rps-rounds">
            <div class="rps-round-dot" id="rpsDot0"></div>
            <div class="rps-round-dot" id="rpsDot1"></div>
            <div class="rps-round-dot" id="rpsDot2"></div>
          </div>
        </div>
        <div class="rps-arena">
          <div class="rps-combatant">
            <div class="rps-choice-display hidden-choice" id="rpsPlayerChoice">❓</div>
            <div class="rps-combatant-label">${label1}</div>
          </div>
          <span class="rps-vs">VS</span>
          <div class="rps-combatant">
            <div class="rps-choice-display hidden-choice" id="rpsOppChoice">❓</div>
            <div class="rps-combatant-label">${label2}</div>
          </div>
        </div>
        <div class="rps-result-text" id="rpsResultText"></div>
        <div class="rps-picks" id="rpsPicksRow">
          ${RPS_CHOICES.map(function(c) {
            return '<button class="rps-pick-btn" data-rps-pick="' + c.key + '"><span class="rps-pick-emoji">' + c.emoji + '</span>' + c.label + '</button>';
          }).join('')}
        </div>
      </div>
    `;
  }

  /* ── RPS: Practice ── */
  function startRPSPractice() {
    openModal('✂️ Rock Paper Scissors', buildRPSHtml('You', 'AI'));
    attachRPSPracticeEvents();
  }

  function attachRPSPracticeEvents() {
    let round = 0;
    const results = [];
    let busy = false;

    document.querySelectorAll('.rps-pick-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (busy) return;
        busy = true;
        document.querySelectorAll('.rps-pick-btn').forEach(function(b) { b.disabled = true; });

        const playerKey = btn.dataset.rpsPick;
        const playerChoice = RPS_CHOICES.find(function(c) { return c.key === playerKey; });
        const aiChoice = rpsRandom();

        const playerEl = document.getElementById('rpsPlayerChoice');
        const oppEl = document.getElementById('rpsOppChoice');
        const resultEl = document.getElementById('rpsResultText');

        playerEl.textContent = playerChoice.emoji;
        playerEl.classList.remove('hidden-choice');
        oppEl.textContent = '⏳';
        oppEl.classList.remove('hidden-choice');
        resultEl.textContent = '';

        let count = 3;
        resultEl.textContent = count;
        resultEl.className = 'rps-result-text rps-countdown-text';

        const tick = setInterval(function() {
          count--;
          if (count > 0) {
            resultEl.textContent = count;
          } else {
            clearInterval(tick);
            oppEl.textContent = aiChoice.emoji;
            oppEl.classList.add('rps-reveal');
            setTimeout(function() { oppEl.classList.remove('rps-reveal'); }, 500);

            resultEl.className = 'rps-result-text';
            const outcome = rpsOutcome(playerKey, aiChoice.key);
            results.push(outcome);

            const dot = document.getElementById('rpsDot' + round);
            if (dot) dot.classList.add(outcome);

            resultEl.textContent = buildRPSOutcomeText(outcome, playerKey, aiChoice.key);
            round++;

            const wins = results.filter(function(r) { return r === 'win'; }).length;
            const losses = results.filter(function(r) { return r === 'loss'; }).length;
            const done = wins >= 2 || losses >= 2 || round >= 3;

            if (done) {
              setTimeout(function() { showRPSEnd(results, 'practice'); }, 1200);
            } else {
              setTimeout(function() {
                document.getElementById('rpsRoundNum').textContent = round + 1;
                playerEl.textContent = '❓'; playerEl.classList.add('hidden-choice');
                oppEl.textContent = '❓'; oppEl.classList.add('hidden-choice');
                resultEl.textContent = '';
                document.querySelectorAll('.rps-pick-btn').forEach(function(b) { b.disabled = false; });
                busy = false;
              }, 1600);
            }
          }
        }, 600);
      });
    });
  }

  function buildRPSOutcomeText(outcome, playerKey, opponentKey) {
    const RPS_DESCRIPTIONS = {
      'rock-scissors':   '🪨 Rock crushes ✂️ Scissors',
      'paper-rock':      '📄 Paper covers 🪨 Rock',
      'scissors-paper':  '✂️ Scissors cuts 📄 Paper',
      'rock-paper':      '📄 Paper covers 🪨 Rock',
      'paper-scissors':  '✂️ Scissors cuts 📄 Paper',
      'scissors-rock':   '🪨 Rock crushes ✂️ Scissors'
    };
    const RPS_FLAVOR = {
      win:  ['Nice move!', 'You got them!', 'Sharp thinking!'],
      loss: ['Oh no!', 'So close…', 'Not today!'],
      draw: ['Great minds…', 'Mirror image!', 'Tied!']
    };
    const descKey = playerKey + '-' + opponentKey;
    const desc = RPS_DESCRIPTIONS[descKey] || '';
    const flavor = RPS_FLAVOR[outcome][Math.floor(Math.random() * RPS_FLAVOR[outcome].length)];
    if (outcome === 'draw') {
      const ch = RPS_CHOICES.find(function(c) { return c.key === playerKey; });
      return 'Both picked ' + (ch ? ch.emoji : '') + ' — ' + flavor;
    }
    return desc + ' — ' + flavor;
  }

  /* ── RPS: Multiplayer ── */
  async function startRPSMultiplayer() {
    const me = currentUser();
    const friend = friendDisplayName();

    showWaiting('Creating challenge...');

    let challengeId;
    try {
      const ch = await createChallenge('rps');
      challengeId = ch.id;
    } catch (e) {
      setModalContent('<div class="mg-error">Could not create challenge: ' + e.message + '<br><button class="mg-btn mg-btn-ghost" onclick="window.closeMinigameModal()">Close</button></div>');
      return;
    }

    showWaiting('Waiting for ' + friend + ' to accept...');

    whenSupabase(function(sb) {
      joinRPSChannel(sb, challengeId, 'host', me, friend);
    });
  }

  function joinRPSChannel(sb, challengeId, myRole, me, friendName) {
    const channelName = 'ss-game-' + challengeId;
    let round = 0;
    const results = [];
    let myPick = null;
    let opponentPick = null;
    let opponentPicked = false;
    let gameStarted = false;

    _rpsState = {
      round: function() { return round; },
      pick: function(key) { myPick = key; }
    };

    const channel = sb.channel(channelName)
      .on('broadcast', { event: 'player-ready' }, function(msg) {
        const pl = msg.payload;
        if (pl && !gameStarted) {
          // Both host and guest trigger game start when either sees the other
          if ((myRole === 'host' && pl.role === 'guest') ||
              (myRole === 'guest' && pl.role === 'host')) {
            startRPSGame();
          }
        }
      })
      .on('broadcast', { event: 'rps-pick' }, function(msg) {
        // Opponent has picked (but we don't know what yet)
        const pl = msg.payload;
        if (!pl || pl.player === me) return;
        if (pl.round !== round) return;
        opponentPicked = true;
        // If I've also picked, reveal
        if (myPick !== null) {
          revealAndRequestReveal();
        } else {
          // Update UI to show opponent has picked
          const oppEl = document.getElementById('rpsOppChoice');
          if (oppEl) { oppEl.textContent = '✅'; oppEl.classList.remove('hidden-choice'); }
          const resultEl = document.getElementById('rpsResultText');
          if (resultEl) resultEl.textContent = friendName + ' has chosen...';
        }
      })
      .on('broadcast', { event: 'rps-reveal' }, function(msg) {
        const pl = msg.payload;
        if (!pl || pl.player === me) return;
        if (pl.round !== round) return;
        opponentPick = pl.choice;
        if (myPick !== null && opponentPick !== null) {
          resolveRound(round, myPick, opponentPick);
        }
      })
      .subscribe(function() {
        channel.send({ type: 'broadcast', event: 'player-ready', payload: { player: me, role: myRole } });
      });

    _rpsChannel = channel;
    _activeChannel = channel;

    function revealAndRequestReveal() {
      if (myPick === null) return;
      // Reveal myself
      channel.send({ type: 'broadcast', event: 'rps-reveal', payload: { player: me, round, choice: myPick } });
      if (opponentPick !== null) {
        resolveRound(round, myPick, opponentPick);
      }
    }

    function resolveRound(r, myChoice, oppChoice) {
      const myChoiceObj = RPS_CHOICES.find(function(c) { return c.key === myChoice; });
      const oppChoiceObj = RPS_CHOICES.find(function(c) { return c.key === oppChoice; });

      const playerEl = document.getElementById('rpsPlayerChoice');
      const oppEl = document.getElementById('rpsOppChoice');
      const resultEl = document.getElementById('rpsResultText');

      if (playerEl) {
        playerEl.textContent = myChoiceObj ? myChoiceObj.emoji : myChoice;
        playerEl.classList.remove('hidden-choice');
        playerEl.classList.add('rps-reveal');
        setTimeout(function() { playerEl.classList.remove('rps-reveal'); }, 500);
      }
      if (oppEl) {
        oppEl.textContent = oppChoiceObj ? oppChoiceObj.emoji : oppChoice;
        oppEl.classList.remove('hidden-choice');
        oppEl.classList.add('rps-reveal');
        setTimeout(function() { oppEl.classList.remove('rps-reveal'); }, 500);
      }

      const outcome = rpsOutcome(myChoice, oppChoice);
      results.push(outcome);

      const dot = document.getElementById('rpsDot' + r);
      if (dot) dot.classList.add(outcome);

      if (resultEl) {
        resultEl.className = 'rps-result-text';
        resultEl.textContent = buildRPSOutcomeText(outcome, myChoice, oppChoice);
      }

      round++;
      myPick = null;
      opponentPick = null;
      opponentPicked = false;

      const wins = results.filter(function(r) { return r === 'win'; }).length;
      const losses = results.filter(function(r) { return r === 'loss'; }).length;
      const done = wins >= 2 || losses >= 2 || round >= 3;

      if (done) {
        setTimeout(function() { showRPSEnd(results, 'multiplayer'); }, 1200);
      } else {
        setTimeout(function() {
          document.getElementById('rpsRoundNum').textContent = round + 1;
          if (playerEl) { playerEl.textContent = '❓'; playerEl.classList.add('hidden-choice'); }
          if (oppEl) { oppEl.textContent = '❓'; oppEl.classList.add('hidden-choice'); }
          if (resultEl) resultEl.textContent = '';
          document.querySelectorAll('.rps-pick-btn').forEach(function(b) { b.disabled = false; });
        }, 1600);
      }
    }

    function startRPSGame() {
      if (gameStarted) return;
      gameStarted = true;

      const myLabel = displayName(me);
      const oppLabel = friendName;
      openModal('✂️ RPS vs ' + oppLabel, buildRPSHtml(myLabel, oppLabel));

      document.querySelectorAll('.rps-pick-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (myPick !== null) return; // already picked this round
          const key = btn.dataset.rpsPick;
          myPick = key;
          document.querySelectorAll('.rps-pick-btn').forEach(function(b) { b.disabled = true; });

          const playerEl = document.getElementById('rpsPlayerChoice');
          if (playerEl) {
            const ch = RPS_CHOICES.find(function(c) { return c.key === key; });
            playerEl.textContent = ch ? ch.emoji : key;
            playerEl.classList.remove('hidden-choice');
          }

          const resultEl = document.getElementById('rpsResultText');
          if (resultEl) resultEl.textContent = 'Waiting for ' + friendName + '...';

          // Broadcast pick notification (no choice revealed yet)
          channel.send({ type: 'broadcast', event: 'rps-pick', payload: { player: me, round } });

          if (opponentPicked) {
            revealAndRequestReveal();
          }
        });
      });
    }

    // If guest, also trigger game start check when we see ourselves
    if (myRole === 'guest') {
      setTimeout(startRPSGame, 1500);
    }
  }

  function showRPSEnd(results, mode) {
    cleanupRPS();
    const wins = results.filter(function(r) { return r === 'win'; }).length;
    const losses = results.filter(function(r) { return r === 'loss'; }).length;
    const draws = results.filter(function(r) { return r === 'draw'; }).length;
    const won = wins > losses;
    const tied = wins === losses;

    showGameResult({
      emoji: won ? '🎉' : tied ? '🤝' : '😅',
      title: won ? 'You win!' : tied ? "It's a tie!" : 'They win this time!',
      sub: wins + 'W — ' + losses + 'L — ' + draws + 'D',
      won: won,
      onPlayAgain: function() { openRPS(mode); },
      onBack: function() { showModeSelect('rps', '✂️', 'Rock Paper Scissors'); }
    });
  }

  /* ════════════════════════════════════════════════
     GAME 3 — LUCKY WORD 🍀
  ════════════════════════════════════════════════ */
  let _lwState = null;
  let _lwChannel = null;

  function openLuckyWord(mode) {
    cleanupLW();
    if (mode === 'multiplayer') {
      startLWMultiplayer();
    } else {
      startLWPractice();
    }
  }

  function cleanupLW() {
    if (_lwChannel && window.supabase) {
      window.supabase.removeChannel(_lwChannel).catch(function() {});
      _lwChannel = null;
    }
    if (window.__lwKeyHandler) {
      document.removeEventListener('keydown', window.__lwKeyHandler);
      window.__lwKeyHandler = null;
    }
    _lwState = null;
  }

  /* ── Lucky Word HTML builders ── */
  function buildLWSoloHtml() {
    return '<div class="lw-wrapper">' +
      '<p class="lw-info">Guess the 4-letter word in 6 tries</p>' +
      buildLWGridHtml('lw', LW_MAX_GUESSES) +
      '<div id="lwMessage" class="lw-message"></div>' +
      buildLWKeyboardHtml() +
      '</div>';
  }

  function buildLWMultiHtml(myLabel, oppLabel) {
    return '<div class="lw-multi-wrapper">' +
      '<div class="lw-multi-panel lw-multi-mine">' +
        '<div class="lw-multi-label">' + myLabel + '</div>' +
        buildLWGridHtml('lwm', LW_MAX_GUESSES) +
        '<div id="lwMessage" class="lw-message"></div>' +
        buildLWKeyboardHtml() +
      '</div>' +
      '<div class="lw-multi-panel lw-multi-opp">' +
        '<div class="lw-multi-label">' + oppLabel + '</div>' +
        buildLWOppGridHtml() +
        '<div class="lw-opp-status" id="lwOppStatus">Waiting...</div>' +
      '</div>' +
    '</div>';
  }

  function buildLWGridHtml(prefix, rows) {
    let html = '<div class="lw-grid">';
    for (let r = 0; r < rows; r++) {
      html += '<div class="lw-row" id="' + prefix + 'Row' + r + '">';
      for (let c = 0; c < LW_WORD_LENGTH; c++) {
        html += '<div class="lw-cell" id="' + prefix + 'Cell' + r + c + '"></div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildLWOppGridHtml() {
    let html = '<div class="lw-grid lw-opp-grid">';
    for (let r = 0; r < LW_MAX_GUESSES; r++) {
      html += '<div class="lw-row" id="lwOppRow' + r + '">';
      for (let c = 0; c < LW_WORD_LENGTH; c++) {
        html += '<div class="lw-cell lw-opp-cell" id="lwOppCell' + r + c + '"></div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildLWKeyboardHtml() {
    let html = '<div class="lw-keyboard">';
    LW_KB_ROWS.forEach(function(row) {
      html += '<div class="lw-kb-row">';
      row.forEach(function(key) {
        const wide = (key === 'Enter' || key === '⌫') ? ' lw-key-wide' : '';
        html += '<button class="lw-key' + wide + '" data-lw-key="' + key + '">' + key + '</button>';
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ── Lucky Word: word evaluation ── */
  function lwEvaluate(guess, answer) {
    const results = Array(LW_WORD_LENGTH).fill('absent');
    const ansArr = answer.split('');
    const guessArr = guess.split('');
    const used = Array(LW_WORD_LENGTH).fill(false);
    // exact pass
    for (let i = 0; i < LW_WORD_LENGTH; i++) {
      if (guessArr[i] === ansArr[i]) {
        results[i] = 'correct';
        used[i] = true;
        guessArr[i] = null;
      }
    }
    // present pass
    for (let i = 0; i < LW_WORD_LENGTH; i++) {
      if (results[i] === 'correct') continue;
      for (let j = 0; j < LW_WORD_LENGTH; j++) {
        if (!used[j] && guessArr[i] === ansArr[j]) {
          results[i] = 'present';
          used[j] = true;
          break;
        }
      }
    }
    return results;
  }

  /* ── Lucky Word: cell/row operations ── */
  function lwUpdateRow(prefix, rowIdx, guess) {
    for (let c = 0; c < LW_WORD_LENGTH; c++) {
      const cell = document.getElementById(prefix + 'Cell' + rowIdx + c);
      if (!cell) continue;
      cell.textContent = (guess[c] || '').toUpperCase();
      cell.className = 'lw-cell' + (guess[c] ? ' filled' : '');
    }
  }

  function lwRevealRow(prefix, rowIdx, results, callback) {
    const DELAY = 120;
    for (let c = 0; c < LW_WORD_LENGTH; c++) {
      (function(col, state) {
        setTimeout(function() {
          const cell = document.getElementById(prefix + 'Cell' + rowIdx + col);
          if (cell) cell.classList.add('flip', state);
          if (col === LW_WORD_LENGTH - 1 && callback) {
            setTimeout(callback, 50);
          }
        }, col * DELAY);
      })(c, results[c]);
    }
  }

  function lwShakeRow(prefix, rowIdx) {
    const row = document.getElementById(prefix + 'Row' + rowIdx);
    if (!row) return;
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
  }

  function lwUpdateKeyboard(results, guess) {
    const PRIORITY = { correct: 3, present: 2, absent: 1 };
    const keyStates = _lwState && _lwState.keyStates ? _lwState.keyStates : {};
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const state = results[i];
      if (!keyStates[letter] || PRIORITY[state] > PRIORITY[keyStates[letter]]) {
        keyStates[letter] = state;
      }
    }
    if (_lwState) _lwState.keyStates = keyStates;
    document.querySelectorAll('.lw-key').forEach(function(btn) {
      const k = btn.dataset.lwKey ? btn.dataset.lwKey.toLowerCase() : null;
      if (k && keyStates[k]) {
        const wide = (k === 'enter' || k === '⌫') ? ' lw-key-wide' : '';
        btn.className = 'lw-key' + wide + ' ' + keyStates[k];
      }
    });
  }

  function lwShowMessage(msg, color) {
    const el = document.getElementById('lwMessage');
    if (el) { el.textContent = msg; el.style.color = color || '#c2623a'; }
  }

  /* ── Lucky Word: Practice Mode ── */
  function startLWPractice() {
    const word = lwPickWord();
    openModal('🍀 Lucky Word', buildLWSoloHtml());
    attachLWPracticeEvents(word, 'practice', 'lw');
  }

  function attachLWPracticeEvents(answer, mode, prefix) {
    _lwState = { keyStates: {} };
    let currentRow = 0;
    let currentGuess = '';
    let gameOver = false;

    function onKey(key) {
      if (gameOver) return;
      if (key === 'Enter') {
        submitGuess();
      } else if (key === '⌫' || key === 'Backspace') {
        currentGuess = currentGuess.slice(0, -1);
        lwUpdateRow(prefix, currentRow, currentGuess);
      } else if (/^[a-zA-Z]$/.test(key) && currentGuess.length < LW_WORD_LENGTH) {
        currentGuess += key.toLowerCase();
        lwUpdateRow(prefix, currentRow, currentGuess);
      }
    }

    function submitGuess() {
      if (gameOver) return;
      const g = currentGuess.toLowerCase();
      if (g.length < LW_WORD_LENGTH) { lwShowMessage('Need ' + LW_WORD_LENGTH + ' letters!'); lwShakeRow(prefix, currentRow); return; }

      const results = lwEvaluate(g, answer);
      const r = currentRow;
      currentRow++;
      currentGuess = '';
      lwShowMessage('');

      lwRevealRow(prefix, r, results, function() {
        lwUpdateKeyboard(results, g);
        const won = results.every(function(x) { return x === 'correct'; });
        if (won) {
          gameOver = true;
          setTimeout(function() {
            lwBounceCells(prefix, r);
            setTimeout(function() { showLWEnd(true, r + 1, answer, mode); }, 800);
          }, LW_WORD_LENGTH * 120 + 100);
        } else if (currentRow >= LW_MAX_GUESSES) {
          gameOver = true;
          setTimeout(function() { showLWEnd(false, LW_MAX_GUESSES, answer, mode); }, LW_WORD_LENGTH * 120 + 100);
        }
      });
    }

    document.querySelectorAll('.lw-key').forEach(function(btn) {
      btn.addEventListener('click', function() { onKey(btn.dataset.lwKey); });
    });

    function handleKeyDown(e) {
      if (document.getElementById('minigameOverlay') && document.getElementById('minigameOverlay').hidden) return;
      if (e.key === 'Escape') return;
      onKey(e.key === 'Backspace' ? '⌫' : e.key);
    }

    document.addEventListener('keydown', handleKeyDown);
    window.__lwKeyHandler = handleKeyDown;
  }

  function lwBounceCells(prefix, rowIdx) {
    for (let c = 0; c < LW_WORD_LENGTH; c++) {
      (function(col) {
        setTimeout(function() {
          const cell = document.getElementById(prefix + 'Cell' + rowIdx + col);
          if (cell) {
            cell.classList.add('bounce');
            setTimeout(function() { cell.classList.remove('bounce'); }, 400);
          }
        }, col * 80);
      })(c);
    }
  }

  /* ── Lucky Word: Multiplayer ── */
  async function startLWMultiplayer() {
    const me = currentUser();
    const friend = friendDisplayName();

    showWaiting('Creating challenge...');

    let challengeId;
    try {
      const ch = await createChallenge('lucky-word');
      challengeId = ch.id;
    } catch (e) {
      setModalContent('<div class="mg-error">Could not create challenge: ' + e.message + '<br><button class="mg-btn mg-btn-ghost" onclick="window.closeMinigameModal()">Close</button></div>');
      return;
    }

    showWaiting('Waiting for ' + friend + ' to accept...');

    whenSupabase(function(sb) {
      joinLWChannel(sb, challengeId, 'host', me, friend);
    });
  }

  function joinLWChannel(sb, challengeId, myRole, me, friendLabel) {
    const channelName = 'ss-game-' + challengeId;
    let gameStarted = false;
    let word = null;
    let myGuessCount = 0;
    let oppGuessCount = 0;
    let gameOver = false;

    _lwState = { keyStates: {} };

    const channel = sb.channel(channelName)
      .on('broadcast', { event: 'player-ready' }, function(msg) {
        const pl = msg.payload;
        if (!pl || gameStarted) return;
        if ((myRole === 'host' && pl.role === 'guest') ||
            (myRole === 'guest' && pl.role === 'host')) {
          if (myRole === 'host') {
            // Host picks word and broadcasts word-start
            word = lwPickWord();
            channel.send({ type: 'broadcast', event: 'word-start', payload: { length: LW_WORD_LENGTH } });
            // Brief delay then send the actual word
            setTimeout(function() {
              channel.send({ type: 'broadcast', event: 'word-go', payload: { word } });
            }, 500);
          }
          startLWGame();
        }
      })
      .on('broadcast', { event: 'word-start' }, function(msg) {
        // Guest gets notified a word was picked
      })
      .on('broadcast', { event: 'word-go' }, function(msg) {
        const pl = msg.payload;
        if (!pl || !pl.word) return;
        if (myRole === 'guest' && !word) {
          word = pl.word;
          if (!gameStarted) startLWGame();
        }
      })
      .on('broadcast', { event: 'word-guess' }, function(msg) {
        const pl = msg.payload;
        if (!pl || pl.player === me) return;
        // Show opponent's progress (grey rows with count only, no letters)
        oppGuessCount = pl.guessNum;
        updateOppProgress(oppGuessCount - 1, pl.result);
        const statusEl = document.getElementById('lwOppStatus');
        if (statusEl) statusEl.textContent = 'Guess ' + oppGuessCount + ' of 6';
      })
      .on('broadcast', { event: 'word-end' }, function(msg) {
        const pl = msg.payload;
        if (!pl || gameOver) return;
        gameOver = true;
        const iWon = pl.winner === me;
        setTimeout(function() {
          showLWEnd(iWon, iWon ? pl.guesses1 : pl.guesses2, pl.word, 'multiplayer', pl.winner);
        }, 600);
      })
      .subscribe(function() {
        channel.send({ type: 'broadcast', event: 'player-ready', payload: { player: me, role: myRole } });
      });

    _lwChannel = channel;
    _activeChannel = channel;

    function updateOppProgress(rowIdx, result) {
      // Show colored dots but no letters
      for (let c = 0; c < LW_WORD_LENGTH; c++) {
        const cell = document.getElementById('lwOppCell' + rowIdx + c);
        if (cell) {
          cell.className = 'lw-cell lw-opp-cell flip ' + (result ? result[c] : 'absent');
          cell.textContent = '';
        }
      }
    }

    function startLWGame() {
      if (gameStarted) return;
      gameStarted = true;

      const myLabel = displayName(me);
      openModal('🍀 Lucky Word vs ' + friendLabel, buildLWMultiHtml(myLabel, friendLabel));

      // Wait for word if we don't have it yet
      if (!word) {
        lwShowMessage('Waiting for word...');
        const checkWord = setInterval(function() {
          if (word) {
            clearInterval(checkWord);
            lwShowMessage('');
            attachLWMultiEvents();
          }
        }, 100);
        return;
      }
      attachLWMultiEvents();
    }

    function attachLWMultiEvents() {
      if (!word) return;
      const prefix = 'lwm';
      let currentRow = 0;
      let currentGuess = '';

      function onKey(key) {
        if (gameOver) return;
        if (key === 'Enter') {
          submitGuess();
        } else if (key === '⌫' || key === 'Backspace') {
          currentGuess = currentGuess.slice(0, -1);
          lwUpdateRow(prefix, currentRow, currentGuess);
        } else if (/^[a-zA-Z]$/.test(key) && currentGuess.length < LW_WORD_LENGTH) {
          currentGuess += key.toLowerCase();
          lwUpdateRow(prefix, currentRow, currentGuess);
        }
      }

      function submitGuess() {
        if (gameOver) return;
        const g = currentGuess.toLowerCase();
        if (g.length < LW_WORD_LENGTH) { lwShowMessage('Need ' + LW_WORD_LENGTH + ' letters!'); lwShakeRow(prefix, currentRow); return; }

        const results = lwEvaluate(g, word);
        const r = currentRow;
        currentRow++;
        myGuessCount = currentRow;
        currentGuess = '';
        lwShowMessage('');

        // Broadcast guess (results but no letters)
        channel.send({
          type: 'broadcast', event: 'word-guess',
          payload: { player: me, result: results, guessNum: myGuessCount }
        });

        lwRevealRow(prefix, r, results, function() {
          lwUpdateKeyboard(results, g);
          const won = results.every(function(x) { return x === 'correct'; });
          if (won) {
            gameOver = true;
            channel.send({
              type: 'broadcast', event: 'word-end',
              payload: { winner: me, word, guesses1: myGuessCount, guesses2: oppGuessCount }
            });
            setTimeout(function() {
              lwBounceCells(prefix, r);
              setTimeout(function() { showLWEnd(true, myGuessCount, word, 'multiplayer', me); }, 800);
            }, LW_WORD_LENGTH * 120 + 100);
          } else if (currentRow >= LW_MAX_GUESSES) {
            gameOver = true;
            // Don't broadcast word-end from guesser who failed — only winner does
            lwShowMessage('Out of guesses! The word was ' + word.toUpperCase(), '#8a7065');
          }
        });
      }

      document.querySelectorAll('.lw-key').forEach(function(btn) {
        btn.addEventListener('click', function() { onKey(btn.dataset.lwKey); });
      });

      function handleKeyDown(e) {
        if (document.getElementById('minigameOverlay') && document.getElementById('minigameOverlay').hidden) return;
        if (e.key === 'Escape') return;
        onKey(e.key === 'Backspace' ? '⌫' : e.key);
      }

      document.addEventListener('keydown', handleKeyDown);
      window.__lwKeyHandler = handleKeyDown;
    }

    // Guest: also try to start after delay (host may already have broadcast)
    if (myRole === 'guest') {
      setTimeout(startLWGame, 1500);
    }
  }

  /* ── Lucky Word: join as guest ── */
  async function joinLWAsGuest(challengeId) {
    const me = currentUser();
    const friend = displayName(opponentOf(me));
    showWaiting('Joining game...');
    whenSupabase(function(sb) {
      joinLWChannel(sb, challengeId, 'guest', me, friend);
    });
  }

  function showLWEnd(iWon, tries, answer, mode, winnerUserId) {
    cleanupLW();
    let title, sub, emoji;
    if (mode === 'multiplayer' && winnerUserId) {
      const winnerName = displayName(winnerUserId);
      title = iWon ? 'You solved it first!' : winnerName + ' solved it first!';
      emoji = iWon ? '🌟' : '🥲';
      sub = iWon
        ? 'Found "' + answer.toUpperCase() + '" in ' + tries + ' ' + (tries === 1 ? 'guess' : 'guesses') + '!'
        : 'The word was "' + answer.toUpperCase() + '"';
    } else {
      emoji = iWon ? (tries <= 2 ? '🌟' : '🍀') : '😔';
      title = iWon ? 'Found it in ' + tries + '!' : 'Not this time';
      sub = iWon
        ? (tries === 1 ? 'First try! Incredible!' : tries + ' guesses — well done!')
        : 'The word was "' + answer.toUpperCase() + '"';
    }
    showGameResult({
      emoji, title, sub, won: iWon,
      onPlayAgain: function() { openLuckyWord(mode); },
      onBack: function() { showModeSelect('lucky-word', '🍀', 'Lucky Word'); }
    });
  }

  /* ════════════════════════════════════════════════
     CHALLENGE BANNER INTEGRATION
  ════════════════════════════════════════════════ */

  // Accept a challenge as the GUEST player
  window.acceptGameChallenge = async function(challengeId, gameType) {
    const me = currentUser();
    const banner = document.getElementById('challengeBanner');

    // Update banner to show accepting state
    if (banner) {
      banner.innerHTML = '<div class="challenge-incoming"><span>Joining game...</span></div>';
    }

    try {
      // Respond to the challenge via API
      await apiPost('/api/challenge/' + challengeId + '/respond', {
        response: 'accept'
      });
    } catch (e) {
      console.warn('Challenge respond error:', e);
      // Continue anyway — the Supabase channel is what really matters
    }

    // Open modal and join as guest
    const gameEmoji = { pong: '🏓', rps: '✂️', 'lucky-word': '🍀' }[gameType] || '🎮';
    const gameName = gameType === 'lucky-word' ? 'Lucky Word' : gameType === 'rps' ? 'Rock Paper Scissors' : 'Pong';
    showWaiting('Joining ' + gameName + '...');
    const overlay = document.getElementById('minigameOverlay');
    if (overlay) overlay.hidden = false;

    if (banner) banner.hidden = true;

    // Route to the correct game join function
    if (gameType === 'pong') {
      await joinPongAsGuest(challengeId);
    } else if (gameType === 'rps') {
      const me2 = currentUser();
      const friend = displayName(opponentOf(me2));
      whenSupabase(function(sb) {
        joinRPSChannel(sb, challengeId, 'guest', me2, friend);
      });
    } else if (gameType === 'lucky-word') {
      await joinLWAsGuest(challengeId);
    }
  };

  // Hook for the app's challenge polling
  window.onChallengeAvailable = function(challenge) {
    const banner = document.getElementById('challengeBanner');
    if (!banner) return;
    const me = currentUser();
    // Only show challenge if I'm the opponent (not the challenger)
    if (challenge.challenger === me || challenge.opponent !== me) return;

    const challenger = challenge.challenger === 'raphael' ? 'Raphael 🌻' : 'Taylor 🌿';
    const gameEmoji = { pong: '🏓', rps: '✂️', 'lucky-word': '🍀' }[challenge.game] || '🎮';
    const gameName = challenge.game === 'lucky-word' ? 'Lucky Word'
      : challenge.game === 'rps' ? 'Rock Paper Scissors'
      : challenge.game === 'pong' ? 'Pong'
      : challenge.game;

    banner.innerHTML =
      '<div class="challenge-incoming">' +
        '<span>' + gameEmoji + ' ' + challenger + ' challenged you to ' + gameName + '!</span>' +
        '<button class="btn-accept-challenge" onclick="window.acceptGameChallenge(\'' + challenge.id + '\', \'' + challenge.game + '\')">' +
          'Accept &amp; Play' +
        '</button>' +
      '</div>';
    banner.hidden = false;
  };

  /* ════════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function() {
    // Launch buttons
    document.querySelectorAll('[data-minigame-launch]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const type = btn.getAttribute('data-minigame-launch');
        if (type === 'pong')           showModeSelect('pong', '🏓', 'Pong Challenge');
        else if (type === 'rps')       showModeSelect('rps', '✂️', 'Rock Paper Scissors');
        else if (type === 'lucky-word') showModeSelect('lucky-word', '🍀', 'Lucky Word');
      });
    });

    // Close button
    var closeBtn = document.querySelector('[data-minigame-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Overlay backdrop click
    var overlay = document.getElementById('minigameOverlay');
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal();
      });
    }

    // Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var ov = document.getElementById('minigameOverlay');
        if (ov && !ov.hidden) closeModal();
      }
    });

    // Poll for pending challenges directed at current user
    function pollChallenges() {
      const me = currentUser();
      apiGet('/api/challenges').then(function(data) {
        const challenges = Array.isArray(data) ? data : (data.challenges || []);
        const pending = challenges.find(function(c) {
          return c.status === 'pending' && c.opponent === me;
        });
        if (pending && typeof window.onChallengeAvailable === 'function') {
          window.onChallengeAvailable(pending);
        }
      }).catch(function() {});
    }

    // Start polling every 5 seconds
    setInterval(pollChallenges, 5000);
    // Also call once shortly after load
    setTimeout(pollChallenges, 2000);
  });

})();
