/* garden.js — Our Garden: a collaborative growing world */
(function () {
  'use strict';

  // Garden items triggered by special messages: [GARDEN:type:variant?]
  const ITEM_DEFS = {
    seed:      { emoji:'🌱', label:'Seed',      color:'#6b7f5e' },
    flower:    { emoji:'🌸', label:'Flower',     color:'#d4829b' },
    sunflower: { emoji:'🌻', label:'Sunflower',  color:'#c9922a' },
    tree:      { emoji:'🌳', label:'Tree',       color:'#4a6741' },
    mushroom:  { emoji:'🍄', label:'Mushroom',   color:'#b85c38' },
    stone:     { emoji:'🪨', label:'Stone',      color:'#9a8f84' },
    lantern:   { emoji:'🏮', label:'Lantern',    color:'#c2623a' },
    butterfly: { emoji:'🦋', label:'Butterfly',  color:'#7b68b5' },
    rain:      { emoji:'🌧️', label:'Rain',       color:'#6b9eb5' },
    sun:       { emoji:'☀️', label:'Sunshine',   color:'#d4a020' },
    moon:      { emoji:'🌙', label:'Moonrise',   color:'#8888cc' },
    bird:      { emoji:'🐦', label:'Bird',       color:'#7aa8c0' },
    snail:     { emoji:'🐌', label:'Snail',      color:'#a07850' },
    path:      { emoji:'🪨', label:'Path stone', color:'#bbb0a4' },
    wish:      { emoji:'⭐', label:'Wish',        color:'#d4c060' },
  };

  const ACTIONS = [
    { type:'seed',      emoji:'🌱', label:'Plant seed'     },
    { type:'flower',    emoji:'🌸', label:'Add flower'     },
    { type:'sunflower', emoji:'🌻', label:'Sunflower'      },
    { type:'tree',      emoji:'🌳', label:'Plant tree'     },
    { type:'butterfly', emoji:'🦋', label:'Release'        },
    { type:'lantern',   emoji:'🏮', label:'Light lantern'  },
    { type:'stone',     emoji:'🪨', label:'Place stone'    },
    { type:'wish',      emoji:'⭐', label:'Make wish'       },
    { type:'bird',      emoji:'🐦', label:'Call a bird'    },
    { type:'mushroom',  emoji:'🍄', label:'Grow mushroom'  },
    { type:'rain',      emoji:'🌧️', label:'Summon rain'    },
    { type:'sun',       emoji:'☀️', label:'Bring sunshine' },
  ];

  const GARDEN_PREFIX = '[GARDEN:';
  let gardenItems = []; // { type, user, ts, x, y }
  let lastTs = 0;
  let loadInterval = null;

  function getToken() {
    return window.authToken
      || window.SOUL_SAFETY_BEARER_TOKEN
      || localStorage.getItem('soulSafetyBearerToken')
      || '';
  }

  function getCurrentUser() {
    return window.currentUser
      || document.querySelector('.user-option.active')?.dataset.user
      || 'raphael';
  }

  // ── Parse garden messages from feed ──────────────────────────────
  function parseGardenMsgs(msgs) {
    const items = [];
    (msgs || []).forEach(m => {
      const text = m.text || m.content || '';
      if (!text.startsWith(GARDEN_PREFIX)) return;
      const inner = text.slice(GARDEN_PREFIX.length, -1); // strip [GARDEN: and ]
      const parts = inner.split(':');
      const type = parts[0];
      if (!ITEM_DEFS[type]) return;
      items.push({
        type,
        user: m.user_id || m.sender_id || 'raphael',
        ts: m.created_at || m.timestamp || m.id || Date.now(),
        id: m.id,
      });
    });
    return items;
  }

  // Stable pseudo-random position from item id/ts
  function stablePos(seed) {
    const s = String(seed);
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
    const x = 5 + ((Math.abs(h) % 1000) / 1000) * 90;
    const y = 15 + ((Math.abs(h >> 8) % 1000) / 1000) * 70;
    return { x, y };
  }

  // ── Render garden ─────────────────────────────────────────────────
  function renderGarden() {
    const scene = document.getElementById('gardenScene');
    if (!scene) return;

    // Keep existing elements, only add new ones
    const existing = new Set(
      Array.from(scene.querySelectorAll('.gn-item')).map(el => el.dataset.id)
    );

    gardenItems.forEach(item => {
      const itemId = String(item.id || item.ts);
      if (existing.has(itemId)) return;

      const def = ITEM_DEFS[item.type] || ITEM_DEFS.seed;
      const { x, y } = stablePos(itemId);

      const el = document.createElement('div');
      el.className = 'gn-item';
      el.dataset.id = itemId;
      el.style.cssText = `left:${x}%;top:${y}%;`;
      el.title = `${def.label} by ${item.user === 'raphael' ? '🌻 Raphael' : '🌿 Taylor'}`;

      const userDot = item.user === 'raphael' ? 'gn-dot-r' : 'gn-dot-t';
      el.innerHTML = `<span class="gn-emoji">${def.emoji}</span><span class="gn-dot ${userDot}"></span>`;

      scene.appendChild(el);
      // Trigger entrance
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('gn-visible'));
      });
    });

    // Update count
    const counter = document.getElementById('gardenCount');
    if (counter) counter.textContent = gardenItems.length;

    // Update empty state
    const empty = document.getElementById('gardenEmpty');
    if (empty) empty.style.display = gardenItems.length ? 'none' : 'block';
  }

  // ── Load messages from API ────────────────────────────────────────
  async function loadGardenMessages() {
    const tok = getToken();
    if (!tok) return;
    try {
      const r = await fetch('/api/messages', {
        headers: { Authorization: 'Bearer ' + tok }
      });
      if (!r.ok) return;
      const data = await r.json();
      const msgs = data.messages || data || [];
      gardenItems = parseGardenMsgs(msgs);
      renderGarden();
    } catch (_) {}
  }

  // ── Send a garden contribution ────────────────────────────────────
  async function contributeGarden(type) {
    const tok = getToken();
    if (!tok) return;
    const user = getCurrentUser();
    const text = `[GARDEN:${type}]`;

    const btn = document.querySelector(`.gn-action-btn[data-type="${type}"]`);
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      setTimeout(() => { btn.disabled = false; btn.style.opacity = ''; }, 2500);
    }

    try {
      await fetch('/api/messages/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + tok
        },
        body: JSON.stringify({ text, user_id: user, sender_id: user })
      });
      // Optimistic local add
      const def = ITEM_DEFS[type];
      const tempId = 'local-' + Date.now();
      gardenItems.push({ type, user, ts: Date.now(), id: tempId });
      renderGarden();
      showGardenToast(`${def.emoji} ${def.label} added to your garden!`);
      // Reload after short delay to get real id
      setTimeout(loadGardenMessages, 1500);
    } catch (_) {
      showGardenToast('Couldn\'t reach the garden right now.');
    }
  }

  function showGardenToast(msg) {
    const old = document.querySelector('.gn-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'gn-toast';
    t.textContent = msg;
    document.getElementById('gardenSection')?.appendChild(t);
    requestAnimationFrame(() => t.classList.add('gn-toast-in'));
    setTimeout(() => {
      t.classList.remove('gn-toast-in');
      setTimeout(() => t.remove(), 400);
    }, 2800);
  }

  // ── Build DOM ─────────────────────────────────────────────────────
  function buildGardenUI() {
    const section = document.getElementById('gardenSection');
    if (!section || section.dataset.built) return;
    section.dataset.built = '1';

    section.innerHTML = `
      <div class="gn-inner vine-border">
        <div class="gn-header">
          <div class="feed-label">Our Garden</div>
          <span class="gn-count-wrap">
            <span id="gardenCount">0</span> things growing
          </span>
        </div>
        <p class="gn-desc">A world you build together — one small thing at a time.</p>

        <div class="gn-stage">
          <div class="gn-scene" id="gardenScene">
            <div class="gn-ground"></div>
            <div class="gn-sky"></div>
            <p class="gn-empty-msg" id="gardenEmpty">
              Your garden is waiting.<br>Add something to get it started 🌱
            </p>
          </div>
        </div>

        <div class="gn-actions" id="gardenActions">
          ${ACTIONS.map(a => `
            <button class="gn-action-btn" data-type="${a.type}" title="${a.label}">
              <span class="gn-action-emoji">${a.emoji}</span>
              <span class="gn-action-label">${a.label}</span>
            </button>
          `).join('')}
        </div>

        <div class="gn-legend">
          <span class="gn-dot gn-dot-r"></span> Raphael &nbsp;
          <span class="gn-dot gn-dot-t"></span> Taylor
        </div>
      </div>
    `;

    section.querySelectorAll('.gn-action-btn').forEach(btn => {
      btn.addEventListener('click', () => contributeGarden(btn.dataset.type));
    });
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    buildGardenUI();
    loadGardenMessages();
    // Poll for new garden messages every 30s
    if (!loadInterval) {
      loadInterval = setInterval(loadGardenMessages, 30000);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (getToken()) init();
  });
  window.addEventListener('soulSafetyUnlocked', init);

})();
