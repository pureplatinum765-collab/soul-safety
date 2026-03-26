/* minigames.js — Pong, Rock Paper Scissors, Lucky Word */
(function () {
  'use strict';

  const API = window.MINIGAME_API || '';

  function apiHeaders(extra) {
    const tok = window.authToken || window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken') || '';
    return tok ? { ...extra, Authorization: 'Bearer ' + tok } : { ...extra };
  }

  async function apiPost(path, body) {
    const r = await fetch(API + path, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  }

  async function apiGet(path) {
    const r = await fetch(API + path, { headers: apiHeaders({}), credentials: 'include' });
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  }

  function who() {
    return window.currentUser || document.querySelector('.user-option.active')?.dataset.user || 'raphael';
  }

  // ── MODAL ────────────────────────────────────────────────────────
  function openModal(title, html, wide) {
    const overlay = document.getElementById('minigameOverlay');
    const modal = overlay && overlay.querySelector('.minigame-modal');
    const titleEl = document.getElementById('minigameTitle');
    const content = document.getElementById('minigameContent');
    if (!overlay) return;
    if (titleEl) titleEl.textContent = title;
    if (content) content.innerHTML = html;
    if (modal) modal.classList.toggle('minigame-modal--wide', !!wide);
    overlay.hidden = false;
  }

  function closeModal() {
    stopPong();
    const overlay = document.getElementById('minigameOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    const modal = overlay.querySelector('.minigame-modal');
    if (modal) modal.classList.remove('minigame-modal--wide');
  }

  window.closeMinigameModal = closeModal;

  // ════════════════════════════════════════════════════════════════
  // 🏓 PONG
  // ════════════════════════════════════════════════════════════════
  let pong = null;
  let pongRAF = null;

  function launchPong() {
    openModal('🏓 Pong', `
      <div id="pg-root">
        <div id="pg-menu">
          <p class="mg-sub">Choose your mode — first to 7 wins</p>
          <button class="btn-game mg-btn" onclick="window.pongGo('easy')">🌸 Chill — Easy CPU</button>
          <button class="btn-game mg-btn" onclick="window.pongGo('normal')">🎯 Challenge — Normal CPU</button>
          <button class="btn-game mg-btn" onclick="window.pongGo('hard')">🔥 Beast Mode — Hard CPU</button>
          <button class="btn-game mg-btn" onclick="window.pongGo('2p')">👥 Two Player (same device)</button>
          <p class="mg-hint">Practice: W/S or ↑/↓ &nbsp;·&nbsp; 2P: Left W/S, Right ↑/↓</p>
        </div>
        <div id="pg-game" style="display:none">
          <div class="pg-hud">
            <span id="pg-p1-lbl">You</span>
            <span class="pg-score" id="pg-score">0 — 0</span>
            <span id="pg-p2-lbl">CPU</span>
          </div>
          <canvas id="pg-canvas"></canvas>
          <button class="btn-game mg-btn-sm" style="margin-top:.6rem" onclick="window.pongBack()">← Back to Menu</button>
        </div>
      </div>
    `, true);
  }

  window.pongGo = function (mode) {
    document.getElementById('pg-menu').style.display = 'none';
    const wrap = document.getElementById('pg-game');
    wrap.style.display = 'block';

    const canvas = document.getElementById('pg-canvas');
    const modalW = document.querySelector('.minigame-modal')?.offsetWidth || 600;
    const W = Math.min(560, modalW - 32);
    const H = Math.round(W * 0.58);
    canvas.width = W; canvas.height = H; canvas.style.width = '100%';

    const p1l = document.getElementById('pg-p1-lbl');
    const p2l = document.getElementById('pg-p2-lbl');
    if (mode === '2p') { p1l.textContent = '🌻 Raphael'; p2l.textContent = '🌿 Taylor'; }
    else { p1l.textContent = 'You'; p2l.textContent = 'Soul Bot'; }

    const cpuSpeeds = { easy: 2.0, normal: 4.2, hard: 7.5 };
    const PH = Math.round(H * 0.22), PW = Math.round(W * 0.018), BR = Math.round(W * 0.013);

    pong = {
      W, H, PH, PW, BR, WIN: 7, mode,
      cpuSpeed: cpuSpeeds[mode] || 4.2,
      p1: { y: H / 2 - PH / 2, score: 0 },
      p2: { y: H / 2 - PH / 2, score: 0 },
      ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
      trail: [], keys: {}, winner: null, serveTimer: 65,
    };
    _resetBall(pong, 1);

    const onKD = e => {
      pong.keys[e.key] = true;
      if (['w','s','W','S','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
    };
    const onKU = e => { pong.keys[e.key] = false; };
    document.addEventListener('keydown', onKD);
    document.addEventListener('keyup', onKU);
    pong.cleanup = () => { document.removeEventListener('keydown', onKD); document.removeEventListener('keyup', onKU); };

    // Touch control
    let tY = null;
    canvas.addEventListener('touchstart', e => { tY = e.touches[0].clientY; }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      if (!tY || !pong) return;
      const dy = e.touches[0].clientY - tY;
      pong.p1.y = Math.max(0, Math.min(H - PH, pong.p1.y + dy * 0.85));
      tY = e.touches[0].clientY;
      e.preventDefault();
    }, { passive: false });

    stopPong();
    const pctx = canvas.getContext('2d');
    function loop() {
      if (!pong) return;
      _updatePong(pong);
      _drawPong(pctx, pong);
      if (!pong.winner) pongRAF = requestAnimationFrame(loop);
    }
    pongRAF = requestAnimationFrame(loop);
  };

  function _resetBall(s, dir) {
    s.ball.x = s.W / 2; s.ball.y = s.H / 2;
    const spd = s.W * 0.0068;
    const a = (Math.random() * 0.4 - 0.2);
    s.ball.vx = spd * (dir || (Math.random() > 0.5 ? 1 : -1)) * Math.cos(a);
    s.ball.vy = spd * Math.sin(a) * (Math.random() > 0.5 ? 1 : -1);
    s.trail = []; s.serveTimer = 60;
  }

  function _updatePong(s) {
    if (s.winner) return;
    if (s.serveTimer > 0) { s.serveTimer--; return; }
    const spd = 5.2, k = s.keys;
    // P1
    if (k['w'] || k['W']) s.p1.y -= spd;
    if (k['s'] || k['S']) s.p1.y += spd;
    if (s.mode !== '2p') {
      if (k['ArrowUp']) s.p1.y -= spd;
      if (k['ArrowDown']) s.p1.y += spd;
    }
    s.p1.y = Math.max(0, Math.min(s.H - s.PH, s.p1.y));
    // P2
    if (s.mode === '2p') {
      if (k['ArrowUp']) s.p2.y -= spd;
      if (k['ArrowDown']) s.p2.y += spd;
    } else {
      const mid = s.p2.y + s.PH / 2;
      const diff = s.ball.y - mid;
      const eff = s.cpuSpeed * (1 + Math.abs(s.ball.vx) / (s.W * 0.022));
      s.p2.y += Math.sign(diff) * Math.min(Math.abs(diff), eff);
      if (s.p2.score - s.p1.score >= 2 && Math.random() < 0.045) s.p2.y += (Math.random()-0.5)*s.PH*0.45;
    }
    s.p2.y = Math.max(0, Math.min(s.H - s.PH, s.p2.y));

    s.trail.push({ x: s.ball.x, y: s.ball.y });
    if (s.trail.length > 10) s.trail.shift();
    s.ball.x += s.ball.vx; s.ball.y += s.ball.vy;

    if (s.ball.y - s.BR < 0) { s.ball.y = s.BR; s.ball.vy = Math.abs(s.ball.vy); }
    if (s.ball.y + s.BR > s.H) { s.ball.y = s.H - s.BR; s.ball.vy = -Math.abs(s.ball.vy); }

    const px1 = s.PW + 10;
    if (s.ball.x - s.BR < px1 + s.PW && s.ball.vx < 0 && s.ball.y > s.p1.y - 4 && s.ball.y < s.p1.y + s.PH + 4) {
      s.ball.x = px1 + s.PW + s.BR + 1;
      s.ball.vx = Math.abs(s.ball.vx) * 1.055;
      s.ball.vy = ((s.ball.y - (s.p1.y + s.PH / 2)) / (s.PH / 2)) * s.W * 0.0085;
    }
    const px2 = s.W - s.PW - 10;
    if (s.ball.x + s.BR > px2 && s.ball.vx > 0 && s.ball.y > s.p2.y - 4 && s.ball.y < s.p2.y + s.PH + 4) {
      s.ball.x = px2 - s.BR - 1;
      s.ball.vx = -Math.abs(s.ball.vx) * 1.055;
      s.ball.vy = ((s.ball.y - (s.p2.y + s.PH / 2)) / (s.PH / 2)) * s.W * 0.0085;
    }

    const spd2 = Math.hypot(s.ball.vx, s.ball.vy);
    const max = s.W * 0.024;
    if (spd2 > max) { s.ball.vx *= max / spd2; s.ball.vy *= max / spd2; }

    if (s.ball.x < 0) {
      s.p2.score++; _updHUD(s);
      if (s.p2.score >= s.WIN) s.winner = 'p2'; else _resetBall(s, 1);
    }
    if (s.ball.x > s.W) {
      s.p1.score++; _updHUD(s);
      if (s.p1.score >= s.WIN) s.winner = 'p1'; else _resetBall(s, -1);
    }
  }

  function _updHUD(s) {
    const el = document.getElementById('pg-score');
    if (el) el.textContent = `${s.p1.score} — ${s.p2.score}`;
  }

  function _rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); }
    else { c.rect(x, y, w, h); }
  }

  function _drawPong(c, s) {
    const { W, H, PH, PW, BR } = s;
    c.fillStyle = '#120d07'; c.fillRect(0, 0, W, H);
    c.setLineDash([7, 7]); c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W/2, 0); c.lineTo(W/2, H); c.stroke(); c.setLineDash([]);

    s.trail.forEach((p, i) => {
      const a = (i / s.trail.length) * 0.26;
      const r = BR * (0.3 + 0.7 * i / s.trail.length);
      c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI*2);
      c.fillStyle = `rgba(220,155,75,${a})`; c.fill();
    });

    if (s.serveTimer <= 0) {
      const gg = c.createRadialGradient(s.ball.x, s.ball.y, 0, s.ball.x, s.ball.y, BR*3.5);
      gg.addColorStop(0,'rgba(194,98,58,0.28)'); gg.addColorStop(1,'transparent');
      c.fillStyle = gg; c.beginPath(); c.arc(s.ball.x, s.ball.y, BR*3.5, 0, Math.PI*2); c.fill();
      const bg = c.createRadialGradient(s.ball.x-BR*0.3, s.ball.y-BR*0.3, 0, s.ball.x, s.ball.y, BR);
      bg.addColorStop(0,'#fff8e8'); bg.addColorStop(1,'#c2623a');
      c.beginPath(); c.arc(s.ball.x, s.ball.y, BR, 0, Math.PI*2); c.fillStyle = bg; c.fill();
    } else {
      const ct = Math.ceil(s.serveTimer / 20);
      c.fillStyle = 'rgba(255,245,220,0.45)';
      c.font = `bold ${Math.round(H*0.11)}px Sentient,Georgia,serif`;
      c.textAlign = 'center'; c.fillText(ct > 0 ? ct : '', W/2, H/2 + H*0.04); c.textAlign = 'left';
    }

    function drawPaddle(x, y, col) {
      const gr = c.createLinearGradient(x, y, x+PW, y+PH);
      gr.addColorStop(0, col); gr.addColorStop(1, col + '88');
      _rr(c, x, y, PW, PH, 4); c.fillStyle = gr; c.fill();
    }
    drawPaddle(10, s.p1.y, '#d98a64');
    drawPaddle(W-PW-10, s.p2.y, '#8da47e');

    if (s.winner) {
      c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(0,0,W,H);
      c.textAlign = 'center';
      const isP1 = s.winner === 'p1';
      const wName = s.mode === '2p'
        ? (isP1 ? '🌻 Raphael wins!' : '🌿 Taylor wins!')
        : (isP1 ? 'You win! 🎉' : 'Soul Bot wins!');
      c.fillStyle = '#fff5e0'; c.font = `bold ${Math.round(H*0.1)}px Sentient,Georgia,serif`;
      c.fillText(wName, W/2, H/2 - H*0.06);
      c.font = `${Math.round(H*0.07)}px General Sans,sans-serif`;
      c.fillStyle = 'rgba(255,245,220,0.5)';
      c.fillText(`${s.p1.score} — ${s.p2.score}`, W/2, H/2 + H*0.03);
      c.textAlign = 'left';
    }
  }

  function stopPong() {
    if (pongRAF) { cancelAnimationFrame(pongRAF); pongRAF = null; }
    if (pong && pong.cleanup) pong.cleanup();
    pong = null;
  }

  window.pongBack = function () {
    stopPong();
    const menu = document.getElementById('pg-menu');
    const game = document.getElementById('pg-game');
    if (menu) menu.style.display = 'block';
    if (game) game.style.display = 'none';
    const sc = document.getElementById('pg-score');
    if (sc) sc.textContent = '0 — 0';
  };

  // ════════════════════════════════════════════════════════════════
  // ✂️ ROCK PAPER SCISSORS
  // ════════════════════════════════════════════════════════════════
  let rps = null;
  const RPS_C = ['🪨', '📄', '✂️'];
  const RPS_N = ['Rock', 'Paper', 'Scissors'];

  function launchRPS() {
    rps = null;
    openModal('✂️ Rock Paper Scissors', `
      <div id="rps-root">
        <div id="rps-menu">
          <p class="mg-sub">Choose your mode — best of 5</p>
          <button class="btn-game mg-btn" onclick="window.rpsStartPractice()">🤖 Practice vs Soul Bot</button>
          <button class="btn-game mg-btn" onclick="window.rpsStart2P()">👥 Two Player (pass device)</button>
        </div>
        <div id="rps-game" style="display:none"></div>
      </div>
    `);
  }

  window.rpsStartPractice = function () {
    rps = { mode: 'practice', w: 0, l: 0, d: 0, round: 0, total: 5 };
    document.getElementById('rps-menu').style.display = 'none';
    document.getElementById('rps-game').style.display = 'block';
    _renderRPSRound();
  };

  window.rpsStart2P = function () {
    rps = { mode: '2p', w: 0, l: 0, d: 0, round: 0, total: 5, p1pick: null, p2pick: null, phase: 'p1' };
    document.getElementById('rps-menu').style.display = 'none';
    document.getElementById('rps-game').style.display = 'block';
    _render2P();
  };

  function _renderRPSRound() {
    const el = document.getElementById('rps-game');
    if (!el || !rps) return;
    const { w, l, d, round, total } = rps;
    el.innerHTML = `
      <div class="rps-scoreboard">Round ${round + 1} / ${total} &nbsp;·&nbsp;
        <span style="color:var(--color-sage)">W${w}</span> &nbsp;D${d}&nbsp;
        <span style="color:var(--color-primary)">L${l}</span>
      </div>
      <div class="rps-arena">
        <div class="rps-side">
          <div class="rps-choice-big" id="rps-bot">❓</div>
          <div class="rps-label">🤖 Soul Bot</div>
        </div>
        <div class="rps-vs">VS</div>
        <div class="rps-side">
          <div class="rps-choice-big" id="rps-you">❓</div>
          <div class="rps-label">✨ You</div>
        </div>
      </div>
      <div class="rps-result" id="rps-res"></div>
      <div class="rps-picks" id="rps-picks">
        ${RPS_C.map((c, i) => `<button class="rps-pick-btn" onclick="window.rpsPick(${i})">${c}<small>${RPS_N[i]}</small></button>`).join('')}
      </div>
      <button class="btn-game mg-btn-sm" style="margin-top:.6rem;opacity:.6" onclick="window.rpsMenu()">← Menu</button>
    `;
  }

  window.rpsPick = function (idx) {
    const picks = document.getElementById('rps-picks');
    if (picks) picks.style.pointerEvents = 'none';
    const res = document.getElementById('rps-res');
    let count = 3;
    if (res) res.textContent = count + '...';
    const iv = setInterval(() => {
      count--;
      if (count > 0) { if (res) res.textContent = count + '...'; }
      else {
        clearInterval(iv);
        const botIdx = Math.floor(Math.random() * 3);
        _revealRPS(idx, botIdx);
      }
    }, 380);
  };

  function _revealRPS(youIdx, botIdx) {
    const botEl = document.getElementById('rps-bot');
    const youEl = document.getElementById('rps-you');
    const res = document.getElementById('rps-res');
    if (botEl) botEl.textContent = RPS_C[botIdx];
    if (youEl) youEl.textContent = RPS_C[youIdx];
    const result = _rpsWho(youIdx, botIdx);
    rps.round++;
    let msg = '';
    if (result === 'win') { rps.w++; msg = '✨ You win this round!'; }
    else if (result === 'lose') { rps.l++; msg = '🤖 Soul Bot wins!'; }
    else { rps.d++; msg = '🤝 Draw!'; }
    if (res) res.textContent = msg;
    if (rps.round >= rps.total) setTimeout(_showRPSFinal, 1300);
    else setTimeout(_renderRPSRound, 1650);
  }

  function _rpsWho(a, b) {
    if (a === b) return 'draw';
    return (a===0&&b===2)||(a===1&&b===0)||(a===2&&b===1) ? 'win' : 'lose';
  }

  function _showRPSFinal() {
    const el = document.getElementById('rps-game');
    if (!el || !rps) return;
    const { w, l, d } = rps;
    let msg, icon;
    if (w > l) { msg = 'You won the series! 🎉'; icon = '🏆'; }
    else if (l > w) { msg = 'Soul Bot wins!'; icon = '🤖'; }
    else { msg = 'All tied up!'; icon = '🤝'; }
    el.innerHTML = `
      <div class="rps-final">
        <div class="rps-final-icon">${icon}</div>
        <h3>${msg}</h3>
        <p class="rps-series">W${w} — D${d} — L${l}</p>
        <button class="btn-game mg-btn" onclick="window.rpsStartPractice()">Play Again</button>
        <button class="btn-game mg-btn-sm" onclick="window.rpsMenu()">← Menu</button>
      </div>`;
  }

  function _render2P() {
    const el = document.getElementById('rps-game');
    if (!el || !rps) return;
    const { phase, w, l, d, round, total, p1pick, p2pick } = rps;

    if (phase === 'p1') {
      el.innerHTML = `
        <div class="rps-scoreboard">🌻 Raphael — Round ${round+1}/${total} — pick secretly</div>
        <div class="rps-notice">🌿 Taylor, look away! 👀</div>
        <div class="rps-picks">${RPS_C.map((c,i)=>`<button class="rps-pick-btn" onclick="window.rps2pP1(${i})">${c}<small>${RPS_N[i]}</small></button>`).join('')}</div>
        <button class="btn-game mg-btn-sm" style="margin-top:.6rem;opacity:.6" onclick="window.rpsMenu()">← Menu</button>`;
    } else if (phase === 'p2') {
      el.innerHTML = `
        <div class="rps-scoreboard">🌿 Taylor — Round ${round+1}/${total} — pick secretly</div>
        <div class="rps-notice">🌻 Raphael, look away! 👀</div>
        <div class="rps-cover"></div>
        <div class="rps-picks">${RPS_C.map((c,i)=>`<button class="rps-pick-btn" onclick="window.rps2pP2(${i})">${c}<small>${RPS_N[i]}</small></button>`).join('')}</div>
        <button class="btn-game mg-btn-sm" style="margin-top:.6rem;opacity:.6" onclick="window.rpsMenu()">← Menu</button>`;
    } else if (phase === 'reveal') {
      const result = _rpsWho(p1pick, p2pick);
      rps.round++;
      if (result === 'win') rps.w++;
      else if (result === 'lose') rps.l++;
      else rps.d++;
      const msg = result==='win' ? '🌻 Raphael wins!' : result==='lose' ? '🌿 Taylor wins!' : '🤝 Draw!';
      const more = rps.round < rps.total
        ? `<button class="btn-game mg-btn" onclick="window.rps2pNext()">Next Round →</button>`
        : `<button class="btn-game mg-btn" onclick="window.rps2pFinal()">Final Results 🏆</button>`;
      el.innerHTML = `
        <div class="rps-scoreboard">Round ${rps.round}/${rps.total} · 🌻${rps.w}—${rps.l}🌿</div>
        <div class="rps-arena">
          <div class="rps-side"><div class="rps-choice-big">${RPS_C[p1pick]}</div><div class="rps-label">🌻 Raphael</div></div>
          <div class="rps-vs">VS</div>
          <div class="rps-side"><div class="rps-choice-big">${RPS_C[p2pick]}</div><div class="rps-label">🌿 Taylor</div></div>
        </div>
        <div class="rps-result">${msg}</div>
        ${more}
        <button class="btn-game mg-btn-sm" style="margin-top:.5rem;opacity:.6" onclick="window.rpsMenu()">← Menu</button>`;
    }
  }

  window.rps2pP1 = i => { rps.p1pick = i; rps.phase = 'p2'; _render2P(); };
  window.rps2pP2 = i => { rps.p2pick = i; rps.phase = 'reveal'; _render2P(); };
  window.rps2pNext = () => { rps.phase = 'p1'; rps.p1pick = rps.p2pick = null; _render2P(); };
  window.rps2pFinal = () => {
    const { w, l, d } = rps;
    const msg = w>l ? '🌻 Raphael wins the match!' : l>w ? '🌿 Taylor wins the match!' : 'Tied match!';
    document.getElementById('rps-game').innerHTML = `
      <div class="rps-final">
        <div class="rps-final-icon">🏆</div>
        <h3>${msg}</h3>
        <p class="rps-series">🌻 ${w} — ${l} 🌿</p>
        <button class="btn-game mg-btn" onclick="window.rpsStart2P()">Play Again</button>
        <button class="btn-game mg-btn-sm" onclick="window.rpsMenu()">← Menu</button>
      </div>`;
  };
  window.rpsMenu = () => {
    document.getElementById('rps-menu').style.display = 'block';
    document.getElementById('rps-game').style.display = 'none';
    rps = null;
  };

  // ════════════════════════════════════════════════════════════════
  // 🍀 LUCKY WORD
  // ════════════════════════════════════════════════════════════════
  const WORDS = ['Home','Bloom','Light','Peace','Tender','Wonder','Gentle','Warm',
    'Brave','Soft','Dream','Root','Wild','Quiet','Sacred','Open','Still','Bright','Free','Present'];

  async function launchLuckyWord() {
    const date = new Date().toISOString().slice(0, 10);
    openModal('🍀 Lucky Word', `<div style="text-align:center;padding:1.5rem;opacity:.5">Loading today's word…</div>`);
    let reflections = {};
    try { reflections = await apiGet(`/api/word-reflection?date=${date}`); } catch (_) {}
    _renderLuckyWord(reflections, date);
  }

  function _renderLuckyWord(reflections, date) {
    const dayN = Math.floor(new Date(date).getTime() / 86400000);
    const word = WORDS[dayN % WORDS.length];
    const me = who();
    const mine = (me === 'raphael' ? reflections.raphael : reflections.taylor) || '';
    const content = document.getElementById('minigameContent');
    if (!content) return;
    content.innerHTML = `
      <div class="lw-wrap">
        <div class="lw-word-box">
          <div class="lw-label">Today's Word</div>
          <div class="lw-word">${word}</div>
        </div>
        <textarea id="lw-ta" class="lw-ta" rows="3" placeholder="What does '${word}' stir in you today…">${mine}</textarea>
        <button class="btn-game mg-btn" id="lw-save" onclick="window.lwSave('${word}','${date}')">Save Reflection ✦</button>
        <div class="lw-both">
          <div class="lw-card lw-raphael">
            <div class="lw-who">🌻 Raphael</div>
            <div class="lw-text">${reflections.raphael || '<em style="opacity:.4">No reflection yet…</em>'}</div>
          </div>
          <div class="lw-card lw-taylor">
            <div class="lw-who">🌿 Taylor</div>
            <div class="lw-text">${reflections.taylor || '<em style="opacity:.4">No reflection yet…</em>'}</div>
          </div>
        </div>
      </div>`;
  }

  window.lwSave = async function (word, date) {
    const btn = document.getElementById('lw-save');
    const ta = document.getElementById('lw-ta');
    if (!ta || !ta.value.trim()) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      await apiPost('/api/word-reflection', { user_id: who(), reflection: ta.value.trim(), date });
      if (btn) btn.textContent = 'Saved ✓';
      setTimeout(launchLuckyWord, 600);
    } catch (_) {
      if (btn) { btn.textContent = 'Save Reflection ✦'; btn.disabled = false; }
    }
  };

  // ════════════════════════════════════════════════════════════════
  // WIRING
  // ════════════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-minigame-launch]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.getAttribute('data-minigame-launch');
        try {
          if (type === 'pong') launchPong();
          else if (type === 'rps') launchRPS();
          else if (type === 'lucky-word') await launchLuckyWord();
          else {
            // Send challenge and open game
            const challenger = who();
            const opponent = challenger === 'raphael' ? 'taylor' : 'raphael';
            try { await apiPost('/api/challenge', { challenger, opponent, game: type }); } catch (_) {}
            if (type === 'pong') launchPong(); else if (type === 'rps') launchRPS();
          }
        } catch (e) { console.warn('Minigame error:', e); }
      });
    });

    document.querySelector('[data-minigame-close]')?.addEventListener('click', closeModal);
    document.getElementById('minigameOverlay')?.addEventListener('click', e => {
      if (e.target.id === 'minigameOverlay') closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  });
})();
