(function () {
  const GAME_API = window.GAME_API || '';

  function gameHeaders(extra = {}) {
    const token = window.authToken || window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken') || '';
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  }

  async function gameGet(path) {
    const response = await fetch(`${GAME_API}${path}`, { headers: gameHeaders(), credentials: 'include' });
    if (!response.ok) throw new Error(`Game API error: ${response.status}`);
    return response.json();
  }

  async function gamePost(path, body) {
    const response = await fetch(`${GAME_API}${path}`, {
      method: 'POST',
      headers: gameHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Game API error: ${response.status}`);
    return response.json();
  }

  function getCurrentUser() {
    return window.currentUser || document.querySelector('.user-option.active')?.dataset.user || 'raphael';
  }

  function renderBoard(players) {
    const board = document.getElementById('gameBoard');
    if (!board) return;
    const cells = Array.from({ length: 20 }, (_, idx) => idx);
    board.innerHTML = cells.map((cell) => {
      const inCell = players.filter((p) => Number(p.position) === cell).map((p) => (p.user_id === 'raphael' ? '🌻' : '🌿')).join('');
      return `<div class="game-cell"><span>${cell}</span><div>${inCell}</div></div>`;
    }).join('');
  }

  function renderPlayers(players) {
    const el = document.getElementById('gamePlayers');
    if (!el) return;
    el.innerHTML = players.map((p) => `<div class="game-player-pill">${p.user_id === 'raphael' ? '🌻 Raphael' : '🌿 Taylor'} — ${p.points} pts</div>`).join('');
  }

  function renderEvents(feed) {
    const el = document.getElementById('gameEventLog');
    if (!el) return;
    if (!feed || feed.length === 0) {
      el.innerHTML = '<p class="game-empty">No events yet.</p>';
      return;
    }
    el.innerHTML = feed.slice(0, 8).map((evt) => {
      const user = evt.user_id === 'raphael' ? 'Raphael' : 'Taylor';
      if (evt.event_type === 'moved') return `<p>${user} moved ${evt.delta_position > 0 ? '+' : ''}${evt.delta_position}</p>`;
      if (evt.event_type === 'task_completed') return `<p>${user} finished a task (+${evt.delta_points})</p>`;
      return `<p>${user}: ${evt.event_type}</p>`;
    }).join('');
  }

  async function refreshGameState() {
    try {
      const state = await gameGet('/api/game/state');
      renderBoard(state.players || []);
      renderPlayers(state.players || []);
      renderEvents(state.feed || []);
    } catch (error) {
      console.warn('Unable to refresh game state:', error);
    }
  }

  async function moveBy(delta, note = null) {
    const user = getCurrentUser();
    await gamePost('/api/game/move', { user_id: user, delta_position: delta, note });
    await refreshGameState();
  }

  async function completeTask() {
    const user = getCurrentUser();
    const tasks = await gameGet('/api/game/tasks');
    if (!tasks.length) return;
    await gamePost('/api/game/task-complete', { user_id: user, task_id: tasks[0].id, note: 'Completed from board UI' });
    await refreshGameState();
  }

  function wireUi() {
    const rollBtn = document.getElementById('rollDiceBtn');
    const taskBtn = document.getElementById('taskCompleteBtn');
    if (rollBtn) rollBtn.addEventListener('click', async () => moveBy(Math.floor(Math.random() * 6) + 1, 'Dice roll'));
    if (taskBtn) taskBtn.addEventListener('click', async () => completeTask());
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireUi();
    refreshGameState();
    setInterval(refreshGameState, 5000);
  });
})();
