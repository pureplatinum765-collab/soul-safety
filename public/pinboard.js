// pinboard.js — Soul Safety built-in pinboard
// Self-contained; initialised by initPinboard() called after auth.

(function () {
  'use strict';

  const COLORS = ['terracotta', 'sage', 'cream', 'blush', 'lavender'];

  let currentUser = null; // set from window context
  let pinsState = [];     // local cache
  let isLoading = false;

  // ------------------------------------------------------------------ helpers

  function authHeaders(extra = {}) {
    const token =
      window.SOUL_SAFETY_BEARER_TOKEN ||
      localStorage.getItem('soulSafetyBearerToken') ||
      '';
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  }

  function resolveCurrentUser() {
    // currentUser is set by app.js as a global or we read from local storage
    return (
      window.currentUser ||
      (function () {
        try {
          const snap = JSON.parse(localStorage.getItem('soulSafetyAppStateV1') || '{}');
          return snap.currentUser || null;
        } catch { return null; }
      })()
    );
  }

  // ------------------------------------------------------------------ API

  async function apiFetchPins() {
    const res = await fetch('/api/pins', {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) throw new Error('Failed to load pins');
    return res.json();
  }

  async function apiCreatePin(payload) {
    const res = await fetch('/api/pins', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create pin');
    }
    return res.json();
  }

  async function apiDeletePin(id) {
    const res = await fetch(`/api/pins/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete pin');
  }

  // ------------------------------------------------------------------ render

  function renderGrid(container) {
    const grid = container.querySelector('.pinboard-grid');
    const empty = container.querySelector('.pinboard-empty');

    if (!grid) return;

    // Clear
    grid.innerHTML = '';

    if (pinsState.length === 0) {
      grid.style.display = 'none';
      if (empty) empty.style.display = '';
      return;
    }

    grid.style.display = '';
    if (empty) empty.style.display = 'none';

    for (const pin of pinsState) {
      grid.appendChild(createPinCard(pin));
    }
  }

  function createPinCard(pin) {
    const color = COLORS.includes(pin.color) ? pin.color : 'cream';
    const card = document.createElement('div');
    card.className = 'pin-card';
    card.dataset.color = color;
    card.dataset.id = pin.id;

    // Color strip
    const strip = document.createElement('div');
    strip.className = 'pin-card__color-strip';
    card.appendChild(strip);

    // Optional image
    if (pin.image_url) {
      const img = document.createElement('img');
      img.className = 'pin-card__image';
      img.src = pin.image_url;
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = function () { this.style.display = 'none'; };
      card.appendChild(img);
    }

    // Text
    const textEl = document.createElement('div');
    textEl.className = 'pin-card__text';
    textEl.textContent = pin.text;
    card.appendChild(textEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'pin-card__footer';

    const userEl = document.createElement('span');
    userEl.className = 'pin-card__user';
    userEl.textContent = pin.user_id || '';
    footer.appendChild(userEl);

    const del = document.createElement('button');
    del.className = 'pin-card__delete';
    del.title = 'Delete pin';
    del.setAttribute('aria-label', 'Delete pin');
    del.innerHTML = `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M5 5l10 10M15 5L5 15"/>
    </svg>`;
    del.addEventListener('click', () => handleDelete(pin.id, card));
    footer.appendChild(del);

    card.appendChild(footer);
    return card;
  }

  // ------------------------------------------------------------------ skeleton

  function renderSkeletons(container) {
    const grid = container.querySelector('.pinboard-grid');
    const empty = container.querySelector('.pinboard-empty');
    if (!grid) return;
    if (empty) empty.style.display = 'none';
    grid.style.display = '';
    grid.innerHTML = '';

    for (let i = 0; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'pin-card pin-card--skeleton';
      card.innerHTML = `
        <div class="pin-card__color-strip"></div>
        <div class="pin-card__text-placeholder" style="width:90%"></div>
        <div class="pin-card__text-placeholder" style="width:75%"></div>
        <div class="pin-card__text-placeholder" style="width:55%"></div>
      `;
      grid.appendChild(card);
    }
  }

  // ------------------------------------------------------------------ load

  async function loadPins(container) {
    if (isLoading) return;
    isLoading = true;
    renderSkeletons(container);
    try {
      pinsState = await apiFetchPins();
      renderGrid(container);
    } catch (err) {
      console.warn('[Pinboard] Failed to load pins:', err);
      pinsState = [];
      renderGrid(container);
    } finally {
      isLoading = false;
    }
  }

  // ------------------------------------------------------------------ delete

  async function handleDelete(id, cardEl) {
    if (!confirm('Remove this pin?')) return;
    cardEl.style.opacity = '0.4';
    cardEl.style.pointerEvents = 'none';
    try {
      await apiDeletePin(id);
      pinsState = pinsState.filter((p) => p.id !== id);
      // Animate removal
      cardEl.style.transition = 'opacity 0.2s, transform 0.2s';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'scale(0.9)';
      setTimeout(() => {
        cardEl.remove();
        const container = document.querySelector('.pinboard-board');
        if (container && pinsState.length === 0) renderGrid(container);
      }, 200);
    } catch (err) {
      console.error('[Pinboard] Delete failed:', err);
      cardEl.style.opacity = '1';
      cardEl.style.pointerEvents = '';
    }
  }

  // ------------------------------------------------------------------ modal

  function openAddModal() {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'pinboard-modal-backdrop';

    let selectedColor = 'cream';

    backdrop.innerHTML = `
      <div class="pinboard-modal" role="dialog" aria-modal="true" aria-label="Add a pin">
        <div class="pinboard-modal__title">Add a Pin</div>

        <div class="pinboard-modal__field">
          <label class="pinboard-modal__label" for="pb-text">Note</label>
          <textarea class="pinboard-modal__textarea" id="pb-text" placeholder="Write something…" maxlength="600"></textarea>
        </div>

        <div class="pinboard-modal__field">
          <label class="pinboard-modal__label" for="pb-image">Image URL <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>
          <input class="pinboard-modal__input" id="pb-image" type="url" placeholder="https://…" />
        </div>

        <div class="pinboard-modal__field">
          <div class="pinboard-modal__label">Colour</div>
          <div class="pinboard-color-swatches">
            ${COLORS.map(
              (c) =>
                `<button class="pinboard-swatch${c === selectedColor ? ' selected' : ''}" data-color="${c}" title="${c}" aria-label="${c}" type="button"></button>`
            ).join('')}
          </div>
        </div>

        <div class="pinboard-modal__error" id="pb-error"></div>

        <div class="pinboard-modal__actions">
          <button class="pinboard-modal__cancel" type="button">Cancel</button>
          <button class="pinboard-modal__submit" type="button">Add Pin</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    // Focus text area
    const textarea = backdrop.querySelector('#pb-text');
    setTimeout(() => textarea && textarea.focus(), 50);

    // Swatch selection
    backdrop.querySelectorAll('.pinboard-swatch').forEach((sw) => {
      sw.addEventListener('click', () => {
        selectedColor = sw.dataset.color;
        backdrop.querySelectorAll('.pinboard-swatch').forEach((s) => s.classList.remove('selected'));
        sw.classList.add('selected');
      });
    });

    // Cancel / close
    function closeModal() {
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 160);
    }

    backdrop.querySelector('.pinboard-modal__cancel').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Escape key
    function onKey(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); }
    }
    document.addEventListener('keydown', onKey);

    // Submit
    backdrop.querySelector('.pinboard-modal__submit').addEventListener('click', async () => {
      const errorEl = backdrop.querySelector('#pb-error');
      const text = textarea.value.trim();
      const imageUrl = backdrop.querySelector('#pb-image').value.trim();
      const submitBtn = backdrop.querySelector('.pinboard-modal__submit');

      errorEl.textContent = '';

      if (!text) {
        errorEl.textContent = 'Please write something for your pin.';
        textarea.focus();
        return;
      }

      const me = resolveCurrentUser();
      const userId = me || 'raphael';

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';

      try {
        const newPin = await apiCreatePin({
          text,
          image_url: imageUrl || null,
          color: selectedColor,
          user_id: userId,
        });

        pinsState.unshift(newPin);
        const container = document.querySelector('.pinboard-board');
        if (container) renderGrid(container);

        document.removeEventListener('keydown', onKey);
        closeModal();
      } catch (err) {
        errorEl.textContent = err.message || 'Failed to save pin. Try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Pin';
      }
    });
  }

  // ------------------------------------------------------------------ init

  function buildPinboardUI(section) {
    section.innerHTML = `
      <div class="pinboard-board">
        <div class="pinboard-toolbar">
          <div class="feed-label" style="margin-bottom:0;flex:1">Pinboard</div>
          <button class="pinboard-add-btn" id="pbAddBtn" type="button">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
            Add Pin
          </button>
        </div>

        <div class="pinboard-empty" style="display:none">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <p>No pins yet. Add your first one!</p>
        </div>

        <div class="pinboard-grid"></div>
      </div>
    `;

    section.querySelector('#pbAddBtn').addEventListener('click', openAddModal);
    loadPins(section.querySelector('.pinboard-board').parentElement || section);
  }

  // ------------------------------------------------------------------ public

  window.initPinboard = function () {
    const section = document.getElementById('pinboard-mount');
    if (!section) {
      console.warn('[Pinboard] Mount point #pinboard-mount not found');
      return;
    }
    buildPinboardUI(section);
  };

  // Auto-init: try immediately, or wait for unlock event
  function tryInit() {
    const token =
      window.SOUL_SAFETY_BEARER_TOKEN ||
      localStorage.getItem('soulSafetyBearerToken');
    if (token) {
      window.initPinboard();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }

  window.addEventListener('soulSafetyUnlocked', () => {
    // Slight delay to let token propagate
    setTimeout(window.initPinboard, 100);
  });
})();
