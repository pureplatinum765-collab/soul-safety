(function () {
  const GAME_API = window.GAME_API || '';
  const BOARD_SIZE = 20;

  /* Special spaces config */
  const SPECIAL = {
    5:  { type: 'bonus', label: '⭐', desc: '+2 Forward' },
    9:  { type: 'hazard', label: '🌀', desc: 'Slip back 2' },
    15: { type: 'bonus', label: '⭐', desc: '+2 Forward' },
    17: { type: 'hazard', label: '🌀', desc: 'Slip back 2' },
    10: { type: 'rest', label: '☕', desc: 'Rest stop' },
    19: { type: 'finish', label: '🏁', desc: 'Finish line' }
  };

  function gameHeaders(extra = {}) {
    const token = window.authToken || window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken') || '';
    return token ? { ...extra, Authorization: 'Bearer ' + token } : extra;
  }

  async function gameGet(path) {
    const response = await fetch(GAME_API + path, { headers: gameHeaders(), credentials: 'include' });
    if (!response.ok) throw new Error('Game API error: ' + response.status);
    return response.json();
  }

  async function gamePost(path, body) {
    const response = await fetch(GAME_API + path, {
      method: 'POST',
      headers: gameHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(body)
    });
    return response.json();
  }

  function getCurrentUser() {
    return window.currentUser || document.querySelector('.user-option.active')?.dataset.user || 'raphael';
  }

  /* Snaking board layout: row 0 goes right (0-4), row 1 goes left (9-5), row 2 goes right (10-14), row 3 goes left (19-15) */
  function getCellOrder() {
    return [
      0, 1, 2, 3, 4,      // row 0: left to right
      9, 8, 7, 6, 5,       // row 1: right to left (snake back)
      10, 11, 12, 13, 14,  // row 2: left to right
      19, 18, 17, 16, 15   // row 3: right to left (snake back)
    ];
  }

  function renderBoard(players, whoseTurn) {
    const board = document.getElementById('gameBoard');
    if (!board) return;

    const cellOrder = getCellOrder();
    const playerPositions = {};
    (players || []).forEach(p => {
      const pos = Number(p.position);
      if (!playerPositions[pos]) playerPositions[pos] = [];
      playerPositions[pos].push(p);
    });

    board.innerHTML = cellOrder.map((cellIdx, visualIdx) => {
      const special = SPECIAL[cellIdx] || null;
      const inCell = (playerPositions[cellIdx] || []).map(p =>
        '<span class="game-token ' + (p.user_id === 'raphael' ? 'token-raphael' : 'token-taylor') + '">' +
        (p.user_id === 'raphael' ? '🌻' : '🌿') + '</span>'
      ).join('');

      const isStart = cellIdx === 0;
      const isFinish = cellIdx === BOARD_SIZE - 1;
      const specialClass = special ? ' cell-' + special.type : '';
      const startClass = isStart ? ' cell-start' : '';

      return '<div class="game-cell' + specialClass + startClass + '" data-cell="' + cellIdx + '">' +
        '<div class="cell-number">' + cellIdx + '</div>' +
        (special ? '<div class="cell-special">' + special.label + '</div>' : '') +
        '<div class="cell-tokens">' + inCell + '</div>' +
        '</div>';
    }).join('');
  }

  function renderPlayers(players, whoseTurn) {
    const el = document.getElementById('gamePlayers');
    if (!el) return;
    el.innerHTML = (players || []).map(p => {
      const isRaphael = p.user_id === 'raphael';
      const isTurn = p.user_id === whoseTurn;
      return '<div class="game-player-pill' + (isTurn ? ' player-active' : '') + '">' +
        '<span class="player-icon">' + (isRaphael ? '🌻' : '🌿') + '</span>' +
        '<span class="player-info">' +
          '<span class="player-name">' + (isRaphael ? 'Raphael' : 'Taylor') + '</span>' +
          '<span class="player-stats">Space ' + p.position + ' · ' + p.points + ' pts</span>' +
        '</span>' +
        (isTurn ? '<span class="turn-badge">Your roll</span>' : '') +
        '</div>';
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
      return '<div class="event-row' + (isWin ? ' event-win' : '') + '">' +
        '<span class="event-user">' + user + '</span>' +
        '<span class="event-text">' + note + '</span>' +
        '</div>';
    }).join('');
  }

  function updateTurnIndicator(whoseTurn) {
    const currentUser = getCurrentUser();
    const isMyTurn = currentUser === whoseTurn;
    const rollBtn = document.getElementById('rollDiceBtn');
    const turnBanner = document.getElementById('turnBanner');

    if (rollBtn) {
      rollBtn.disabled = !isMyTurn;
      rollBtn.classList.toggle('btn-disabled', !isMyTurn);
    }

    if (turnBanner) {
      const name = whoseTurn === 'raphael' ? 'Raphael' : 'Taylor';
      const emoji = whoseTurn === 'raphael' ? '🌻' : '🌿';
      if (isMyTurn) {
        turnBanner.innerHTML = emoji + ' Your turn — roll the dice!';
        turnBanner.className = 'turn-banner turn-yours';
      } else {
        turnBanner.innerHTML = emoji + ' Waiting for ' + name + '...';
        turnBanner.className = 'turn-banner turn-waiting';
      }
    }
  }

  let currentWhoseTurn = 'raphael';

  async function refreshGameState() {
    try {
      const state = await gameGet('/api/game/state');
      currentWhoseTurn = state.whose_turn || 'raphael';
      renderBoard(state.players || [], currentWhoseTurn);
      renderPlayers(state.players || [], currentWhoseTurn);
      renderEvents(state.feed || []);
      updateTurnIndicator(currentWhoseTurn);
    } catch (error) {
      console.warn('Unable to refresh game state:', error);
    }
  }

  /* Dice animation */
  function animateDice(finalValue) {
    return new Promise(resolve => {
      const diceEl = document.getElementById('diceDisplay');
      if (!diceEl) { resolve(); return; }

      const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      diceEl.classList.add('dice-rolling');
      diceEl.style.display = 'flex';

      let count = 0;
      const interval = setInterval(() => {
        diceEl.textContent = faces[Math.floor(Math.random() * 6)];
        count++;
        if (count >= 12) {
          clearInterval(interval);
          diceEl.textContent = faces[finalValue - 1];
          diceEl.classList.remove('dice-rolling');
          diceEl.classList.add('dice-landed');
          setTimeout(() => {
            diceEl.classList.remove('dice-landed');
            resolve();
          }, 1200);
        }
      }, 80);
    });
  }

  async function rollDice() {
    const user = getCurrentUser();
    const rollBtn = document.getElementById('rollDiceBtn');
    if (rollBtn) { rollBtn.disabled = true; rollBtn.textContent = 'Rolling...'; }

    const result = await gamePost('/api/game/move', { user_id: user });

    if (result.error) {
      if (result.error === 'Not your turn') {
        const name = result.whose_turn === 'raphael' ? 'Raphael' : 'Taylor';
        showToast("It's " + name + "'s turn!");
      } else {
        showToast(result.error);
      }
      if (rollBtn) { rollBtn.disabled = false; rollBtn.textContent = '🎲 Roll Dice'; }
      return;
    }

    /* Animate the dice with the server-provided roll value */
    await animateDice(result.roll);

    if (result.won) {
      showToast('🏆 ' + (user === 'raphael' ? 'Raphael' : 'Taylor') + ' wins the round! +10 pts');
    } else if (result.bonus_note) {
      showToast(result.bonus_note.trim());
    }

    await refreshGameState();
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
    setTimeout(() => { toast.classList.add('toast-visible'); }, 10);
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function wireUi() {
    const rollBtn = document.getElementById('rollDiceBtn');
    if (rollBtn) rollBtn.addEventListener('click', rollDice);
  }

  /* Re-evaluate turn when user switches */
  const origSelectUser = window.selectUser;
  window.selectUser = function(u) {
    if (origSelectUser) origSelectUser(u);
    setTimeout(() => updateTurnIndicator(currentWhoseTurn), 50);
  };

  document.addEventListener('DOMContentLoaded', () => {
    wireUi();
    refreshGameState();
    setInterval(refreshGameState, 5000);
  });
})();
