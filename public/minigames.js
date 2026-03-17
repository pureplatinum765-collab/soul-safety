(function () {
  const MINIGAME_API = window.MINIGAME_API || '';

  function apiHeaders(extra = {}) {
    const token = window.authToken || window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken') || '';
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  }

  async function post(path, body) {
    const response = await fetch(`${MINIGAME_API}${path}`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Minigame API error: ${response.status}`);
    return response.json();
  }

  async function get(path) {
    const response = await fetch(`${MINIGAME_API}${path}`, { headers: apiHeaders(), credentials: 'include' });
    if (!response.ok) throw new Error(`Minigame API error: ${response.status}`);
    return response.json();
  }

  function currentUser() {
    return window.currentUser || document.querySelector('.user-option.active')?.dataset.user || 'raphael';
  }

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
  }

  async function createChallenge(game) {
    const challenger = currentUser();
    const opponent = challenger === 'raphael' ? 'taylor' : 'raphael';
    const challenge = await post('/api/challenge', { challenger, opponent, game });
    const banner = document.getElementById('challengeBanner');
    if (banner) {
      banner.hidden = false;
      banner.textContent = `Challenge sent: ${game} (${challenger} → ${opponent})`;
    }
    openModal('Challenge Sent', `<p>${challenger} challenged ${opponent} to ${game}.</p><button id="challengeAcceptBtn" class="btn-game">Accept</button><button id="challengeDeclineBtn" class="btn-game">Decline</button>`);

    document.getElementById('challengeAcceptBtn')?.addEventListener('click', async () => {
      await post(`/api/challenge/${challenge.id}/respond`, { response: 'accept', user_id: opponent });
      closeModal();
    });

    document.getElementById('challengeDeclineBtn')?.addEventListener('click', async () => {
      await post(`/api/challenge/${challenge.id}/respond`, { response: 'decline', user_id: opponent });
      closeModal();
    });
  }

  async function openLuckyWord() {
    const date = new Date().toISOString().slice(0, 10);
    const reflections = await get(`/api/word-reflection?date=${date}`);
    openModal('Lucky Word Reflection', `
      <p>Word of the day: <strong>Home</strong></p>
      <textarea id="wordReflectionInput" class="input-text" rows="3" placeholder="Write a reflection..."></textarea>
      <button id="saveWordReflection" class="btn-game">Save reflection</button>
      <div class="word-reflection-list">${Object.entries(reflections).map(([user, text]) => `<p><strong>${user}</strong>: ${text}</p>`).join('') || '<p>No reflections yet.</p>'}</div>
    `);

    document.getElementById('saveWordReflection')?.addEventListener('click', async () => {
      const reflection = document.getElementById('wordReflectionInput')?.value?.trim();
      if (!reflection) return;
      await post('/api/word-reflection', { user_id: currentUser(), reflection, date });
      closeModal();
    });
  }

  // Expose closeModal globally for inline onclick fallback
  window.closeMinigameModal = closeModal;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-minigame-launch]').forEach((button) => {
      button.addEventListener('click', async () => {
        const type = button.getAttribute('data-minigame-launch');
        try {
          if (type === 'lucky-word') await openLuckyWord();
          else await createChallenge(type);
        } catch (error) {
          console.warn('Unable to launch minigame:', error);
        }
      });
    });

    document.querySelector('[data-minigame-close]')?.addEventListener('click', closeModal);
    document.getElementById('minigameOverlay')?.addEventListener('click', (event) => {
      if (event.target.id === 'minigameOverlay') closeModal();
    });

    // Escape key handler
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
  });
})();
