/* game.js — Board game with challenge cards */
(function () {
  'use strict';

  const BOARD_SIZE = 20;
  const SPECIAL = {
    3:  { type: 'challenge', label: '💬', desc: 'Challenge!' },
    5:  { type: 'bonus',     label: '⭐', desc: '+2 Forward' },
    7:  { type: 'trivia',   label: '🔮', desc: 'Trivia!' },
    9:  { type: 'hazard',   label: '🌀', desc: 'Slip back 2' },
    10: { type: 'rest',     label: '☕', desc: 'Rest stop' },
    12: { type: 'challenge', label: '💬', desc: 'Challenge!' },
    15: { type: 'bonus',    label: '⭐', desc: '+2 Forward' },
    16: { type: 'trivia',   label: '🔮', desc: 'Trivia!' },
    17: { type: 'hazard',   label: '🌀', desc: 'Slip back 2' },
    19: { type: 'finish',   label: '🏁', desc: 'Finish line' },
  };

  // ── Challenge cards ───────────────────────────────────────────
  const CHALLENGES = [
    { icon:'💬', type:'truth',  text:'What made you laugh the most recently? Share the story.' },
    { icon:'🎨', type:'create', text:'Describe your dream home in exactly 5 words each.' },
    { icon:'🌿', type:'share',  text:'Share a song that describes exactly how you feel today.' },
    { icon:'🌙', type:'dream',  text:'If you woke up anywhere tomorrow — where would it be?' },
    { icon:'🔮', type:'wonder', text:'What\'s one thing you\'ve always wanted to learn but haven\'t?' },
    { icon:'🌸', type:'bloom',  text:'Share the most beautiful thing you\'ve seen this week.' },
    { icon:'⚡', type:'brave',  text:'Name something you\'re proud of that you rarely talk about.' },
    { icon:'☕', type:'cozy',   text:'Describe your perfect cozy day together in 3 sentences.' },
    { icon:'💛', type:'truth',  text:'What do you appreciate about the other person right now?' },
    { icon:'🌟', type:'dream',  text:'If you had a superpower for one day — what and why?' },
    { icon:'📷', type:'share',  text:'Share the last photo that made you smile from your camera roll.' },
    { icon:'🖊️', type:'create', text:'Write each other a 3-word poem about this exact moment.' },
    { icon:'🌊', type:'wonder', text:'If you could talk to any animal, which one and what would you ask?' },
    { icon:'🌺', type:'bloom',  text:'What\'s one thing that feels like home to you?' },
    { icon:'🦋', type:'brave',  text:'Share something you\'re currently growing within yourself.' },
    { icon:'🎵', type:'share',  text:'Hum or describe the melody stuck in your head right now.' },
    { icon:'🌄', type:'dream',  text:'Describe your ideal morning in vivid detail.' },
    { icon:'✨', type:'wonder', text:'What small ordinary thing do you find secretly magical?' },
    { icon:'🤝', type:'truth',  text:'Say one thing you\'ve been meaning to tell the other person.' },
    { icon:'🌱', type:'bloom',  text:'What\'s one tiny thing you want to nurture this week?' },
  ];

  const HAZARD_MSGS = [
    { icon:'🌀', text:'Whoa — slipped on a dream cloud! Back 2 spaces, but here\'s a hug 🤗' },
    { icon:'🍃', text:'A friendly wind blew you backwards — back 2 spaces! Regroup and roll again soon.' },
    { icon:'🌊', text:'Caught a sneaky wave! Slide back 2 spaces, but the ocean says hello.' },
    { icon:'🐾', text:'A tiny creature asked you to come back — back 2 spaces, they needed the company.' },
  ];

  const REST_MSGS = [
    { icon:'☕', text:'Rest Stop! Take a real breath together. Close your eyes for 5 seconds before continuing.' },
    { icon:'🌿', text:'Rest Stop! Name one thing each of you is grateful for right now.' },
    { icon:'🌸', text:'Rest Stop! Look each other in the eyes and smile for 3 seconds — then roll.' },
  ];

  const TRIVIA = [
    { icon:'🔮', type:'trivia', text:'Each person writes down their biggest fear — then swap and the other gives it a pep talk.' },
    { icon:'🧩', type:'trivia', text:'Name 3 things you both genuinely have in common that most people wouldn\'t guess.' },
    { icon:'🎯', type:'trivia', text:'What\'s one thing the other person does that you wish you could do?' },
    { icon:'🌍', type:'trivia', text:'If you had to live in a different country for a year, which one and why? Both answer.' },
    { icon:'📖', type:'trivia', text:'Describe a memory from childhood that shaped who you are. Both share.' },
    { icon:'🎪', type:'trivia', text:'What\'s the silliest argument you\'ve ever had? Reenact it in 30 seconds.' },
    { icon:'🔑', type:'trivia', text:'What\'s one door you\'d open if fear wasn\'t a factor? Both answer honestly.' },
    { icon:'🌈', type:'trivia', text:'Pick a color that represents your mood right now and explain why.' },
    { icon:'🎭', type:'trivia', text:'If your life were a movie genre — what genre is this current chapter?' },
    { icon:'🧸', type:'trivia', text:'What\'s something you still carry from being a kid that you\'re proud of?' },
  ];

  function drawChallenge() { return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]; }
  function drawTrivia() { return TRIVIA[Math.floor(Math.random() * TRIVIA.length)]; }
  function drawHazard() { return HAZARD_MSGS[Math.floor(Math.random() * HAZARD_MSGS.length)]; }
  function drawRest() { return REST_MSGS[Math.floor(Math.random() * REST_MSGS.length)]; }

  function _getGameContainer() {
    return document.querySelector('.game-section__inner') || document.getElementById('gameSection');
  }

  function showCard(card) {
    const container = _getGameContainer();
    if (!container) return;
    const old = container.querySelector('.gc-overlay');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'gc-overlay';
    el.innerHTML = `
      <div class="gc-card">
        <div class="gc-icon">${card.icon}</div>
        <div class="gc-type">${card.type || ''}</div>
        <div class="gc-text">${card.text}</div>
        <button class="btn-game gc-close">Got it ✓</button>
      </div>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('gc-show'));
    el.querySelector('.gc-close').addEventListener('click', () => {
      el.classList.remove('gc-show');
      setTimeout(() => el.remove(), 320);
    });
  }

  function showVictory(user) {
    const container = _getGameContainer();
    if (!container) return;
    const old = container.querySelector('.gc-overlay');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'gc-overlay gc-victory';
    const name = user === 'raphael' ? '🌻 Raphael' : '🌿 Taylor';
    el.innerHTML = `
      <div class="gc-card">
        <div class="gc-icon">🏆</div>
        <div class="gc-type">winner</div>
        <div class="gc-text">${name} wins the round! A new game starts next roll.</div>
        <button class="btn-game gc-close">Celebrate! 🎉</button>
      </div>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('gc-show'));
    el.querySelector('.gc-close').addEventListener('click', () => {
      el.classList.remove('gc-show');
      setTimeout(() => el.remove(), 320);
    });
    _launchConfetti(container);
  }

  function _launchConfetti(container) {
    const colors = ['#c2623a','#c9922a','#6b7f5e','#9b6db5','#d4a060','#a0c080'];
    for (let i = 0; i < 40; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'gc-confetti';
        p.style.cssText = `
          position:absolute; left:${20+Math.random()*60}%; top:0;
          width:${6+Math.random()*6}px; height:${6+Math.random()*6}px;
          background:${colors[Math.floor(Math.random()*colors.length)]};
          border-radius:${Math.random()>0.5?'50%':'2px'};
          animation:confettiFall ${1.2+Math.random()*1.4}s ease forwards;
          transform:rotate(${Math.random()*360}deg);
          opacity:0.9; pointer-events:none; z-index:9990;
        `;
        container.appendChild(p);
        setTimeout(() => p.remove(), 3000);
      }, i * 60);
    }
  }

  // ── Game state tracking ───────────────────────────────────────
  let lastPlayers = [];
  let currentWhoseTurn = 'raphael';

  function gameHeaders(extra) {
    const tok = window.authToken || window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken') || '';
    return tok ? { ...extra, Authorization: 'Bearer ' + tok } : { ...extra };
  }
  async function gameGet(path) {
    const r = await fetch(path, { headers: gameHeaders({}), credentials: 'include' });
    if (!r.ok) throw new Error('Game API ' + r.status);
    return r.json();
  }
  async function gamePost(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: gameHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return r.json();
  }

  function getCurrentUser() {
    return window.currentUser || document.querySelector('.user-option.active')?.dataset.user || 'raphael';
  }

  function getCellOrder() {
    return [0,1,2,3,4, 9,8,7,6,5, 10,11,12,13,14, 19,18,17,16,15];
  }

  function renderBoard(players, whoseTurn) {
    const board = document.getElementById('gameBoard');
    if (!board) return;
    const cellOrder = getCellOrder();
    const byPos = {};
    (players || []).forEach(p => {
      const pos = Number(p.position);
      if (!byPos[pos]) byPos[pos] = [];
      byPos[pos].push(p);
    });
    board.innerHTML = cellOrder.map(cellIdx => {
      const spec = SPECIAL[cellIdx] || null;
      const inCell = (byPos[cellIdx] || []).map(p =>
        `<span class="game-token ${p.user_id === 'raphael' ? 'token-raphael' : 'token-taylor'}">${p.user_id === 'raphael' ? '🌻' : '🌿'}</span>`
      ).join('');
      const cls = ['game-cell', spec ? 'cell-' + spec.type : '', cellIdx === 0 ? 'cell-start' : ''].filter(Boolean).join(' ');
      return `<div class="${cls}" data-cell="${cellIdx}">
        <div class="cell-number">${cellIdx}</div>
        ${spec ? `<div class="cell-special">${spec.label}</div>` : ''}
        <div class="cell-tokens">${inCell}</div>
      </div>`;
    }).join('');
  }

  function renderPlayers(players, whoseTurn) {
    const el = document.getElementById('gamePlayers');
    if (!el) return;
    el.innerHTML = (players || []).map(p => {
      const isR = p.user_id === 'raphael';
      const isTurn = p.user_id === whoseTurn;
      return `<div class="game-player-pill${isTurn ? ' player-active' : ''}">
        <span class="player-icon">${isR ? '🌻' : '🌿'}</span>
        <span class="player-info">
          <span class="player-name">${isR ? 'Raphael' : 'Taylor'}</span>
          <span class="player-stats">Space ${p.position} · ${p.points} pts</span>
        </span>
        ${isTurn ? '<span class="turn-badge">Your roll</span>' : ''}
      </div>`;
    }).join('');
  }

  function renderEvents(feed) {
    const el = document.getElementById('gameEventLog');
    if (!el) return;
    if (!feed || feed.length === 0) {
      el.innerHTML = '<p class="game-empty">Roll the dice to start playing.</p>';
      return;
    }
    el.innerHTML = feed.slice(0, 10).map(evt => {
      const user = evt.user_id === 'raphael' ? '🌻' : '🌿';
      const note = evt.note || evt.event_type;
      const isWin = evt.event_type === 'game_won';
      return `<div class="event-row${isWin ? ' event-win' : ''}">
        <span class="event-user">${user}</span>
        <span class="event-text">${note}</span>
      </div>`;
    }).join('');
  }

  function updateTurnIndicator(whoseTurn) {
    const me = getCurrentUser();
    const isMyTurn = me === whoseTurn;
    const rollBtn = document.getElementById('rollDiceBtn');
    const banner = document.getElementById('turnBanner');
    if (rollBtn) {
      rollBtn.disabled = !isMyTurn;
      rollBtn.classList.toggle('btn-disabled', !isMyTurn);
    }
    if (banner) {
      const name = whoseTurn === 'raphael' ? 'Raphael' : 'Taylor';
      const emoji = whoseTurn === 'raphael' ? '🌻' : '🌿';
      banner.innerHTML = isMyTurn
        ? `${emoji} Your turn — roll the dice!`
        : `${emoji} Waiting for ${name}…`;
      banner.className = `turn-banner ${isMyTurn ? 'turn-yours' : 'turn-waiting'}`;
    }
  }

  async function refreshGameState() {
    try {
      const state = await gameGet('/api/game/state');
      currentWhoseTurn = state.whose_turn || 'raphael';
      lastPlayers = state.players || [];
      renderBoard(lastPlayers, currentWhoseTurn);
      renderPlayers(lastPlayers, currentWhoseTurn);
      renderEvents(state.feed || []);
      updateTurnIndicator(currentWhoseTurn);
    } catch (e) {
      console.warn('Game state refresh failed:', e);
    }
  }

  function animateDice(finalValue) {
    return new Promise(resolve => {
      const diceEl = document.getElementById('diceDisplay');
      if (!diceEl) { resolve(); return; }
      const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
      diceEl.style.display = 'flex';
      diceEl.classList.add('dice-rolling');
      let count = 0;
      const iv = setInterval(() => {
        diceEl.textContent = faces[Math.floor(Math.random() * 6)];
        if (++count >= 12) {
          clearInterval(iv);
          diceEl.textContent = faces[finalValue - 1];
          diceEl.classList.remove('dice-rolling');
          diceEl.classList.add('dice-landed');
          setTimeout(() => { diceEl.classList.remove('dice-landed'); resolve(); }, 1100);
        }
      }, 80);
    });
  }

  async function rollDice() {
    const user = getCurrentUser();
    const rollBtn = document.getElementById('rollDiceBtn');
    if (rollBtn) { rollBtn.disabled = true; rollBtn.textContent = 'Rolling…'; }

    const result = await gamePost('/api/game/move', { user_id: user });

    if (result.error) {
      if (result.error === 'Not your turn') {
        const name = result.whose_turn === 'raphael' ? 'Raphael' : 'Taylor';
        showToast(`It's ${name}'s turn!`);
      } else {
        showToast(result.error);
      }
      if (rollBtn) { rollBtn.disabled = false; rollBtn.textContent = '🎲 Roll Dice'; }
      return;
    }

    await animateDice(result.roll);
    await refreshGameState();

    // Determine where this player landed
    const me = lastPlayers.find(p => p.user_id === user);
    const pos = me ? Number(me.position) : -1;

    const challengeSpots  = new Set([3, 12]);
    const triviaSpots     = new Set([7, 16]);
    const hazardSpots     = new Set([9, 17]);
    const restSpots       = new Set([10]);
    const bonusSpots      = new Set([5, 15]);

    if (result.won) {
      setTimeout(() => showVictory(user), 300);
    } else if (challengeSpots.has(pos)) {
      setTimeout(() => showCard(drawChallenge()), 500);
    } else if (triviaSpots.has(pos)) {
      setTimeout(() => showCard(drawTrivia()), 500);
    } else if (hazardSpots.has(pos)) {
      setTimeout(() => showCard(drawHazard()), 400);
    } else if (restSpots.has(pos)) {
      setTimeout(() => showCard(drawRest()), 400);
    } else if (bonusSpots.has(pos) || result.bonus_note) {
      showToast(result.bonus_note ? result.bonus_note.trim() : '⭐ Bonus! +2 spaces!');
    }

    if (rollBtn) { rollBtn.textContent = '🎲 Roll Dice'; }
  }

  function showToast(msg) {
    const existing = document.querySelector('.game-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'game-toast';
    toast.textContent = msg;
    const section = document.getElementById('gameSection');
    if (section) section.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2600);
  }

  function wireUi() {
    const btn = document.getElementById('rollDiceBtn');
    if (btn) btn.addEventListener('click', rollDice);
  }

  const origSelectUser = window.selectUser;
  window.selectUser = function (u) {
    if (origSelectUser) origSelectUser(u);
    setTimeout(() => updateTurnIndicator(currentWhoseTurn), 50);
  };

  document.addEventListener('DOMContentLoaded', () => {
    wireUi();
    refreshGameState();
    setInterval(refreshGameState, 5000);
  });
})();
