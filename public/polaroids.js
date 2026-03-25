/* polaroids.js — Scattered polaroid photo system for Soul Safety */
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────────
  const MAX_POLAROIDS   = 8;
  const SCAN_INTERVAL   = 30 * 1000;  // 30s: re-scan feed for new photos
  const SWAP_INTERVAL   = 60 * 1000;  // 60s: rotate one polaroid out

  // Weighted size classes: sm (3 parts), md (3 parts), lg (1 part)
  const SIZE_POOL = ['sm', 'sm', 'sm', 'md', 'md', 'md', 'lg'];

  // ── State ────────────────────────────────────────────────────────────────────
  let layer       = null;       // the fixed container div
  let known       = [];         // [{src, caption}] – all discovered photos
  let active      = [];         // [{el, src, caption}] – currently displayed

  // ── Guard: no polaroids on small screens ────────────────────────────────────
  function isMobile() {
    return window.innerWidth < 600;
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  function init() {
    if (isMobile()) return;

    // Create the fixed layer
    layer = document.createElement('div');
    layer.className = 'polaroid-layer';
    document.body.appendChild(layer);

    // Initial scan
    scanFeed();

    // Periodic re-scan for new photos
    setInterval(scanFeed, SCAN_INTERVAL);

    // Periodic swap of one polaroid
    setInterval(swapOne, SWAP_INTERVAL);

    // Re-check on resize (show/hide layer)
    window.addEventListener('resize', onResize, { passive: true });
  }

  function onResize() {
    if (!layer) return;
    layer.style.display = isMobile() ? 'none' : '';
  }

  // ── Feed scanning ────────────────────────────────────────────────────────────
  function scanFeed() {
    if (!layer || isMobile()) return;

    const feed = document.getElementById('feedContainer');
    if (!feed) return;

    // Find all <img> elements inside message cards that are photo messages
    const imgs = feed.querySelectorAll('.message-card img');
    imgs.forEach(img => {
      const src = img.src;
      if (!src || src.includes('data:')) return; // skip blank / data URIs

      // Extract sender name from the parent message card [data-user]
      const card = img.closest('[data-user]');
      const userId = card ? card.getAttribute('data-user') : null;
      const caption = userId
        ? (userId === 'raphael' ? 'Raphael' : userId === 'taylor' ? 'Taylor' : userId)
        : '';

      // Only add if we haven't seen this src before
      if (!known.find(p => p.src === src)) {
        known.push({ src, caption });
        // Immediately try to place it if we have room
        maybePlace({ src, caption });
      }
    });
  }

  // ── Placement ────────────────────────────────────────────────────────────────
  function maybePlace(photo) {
    if (!layer || isMobile()) return;
    if (active.length >= MAX_POLAROIDS) return;
    if (active.find(p => p.src === photo.src)) return; // already shown
    placePolaroid(photo);
  }

  function placePolaroid(photo) {
    const el = buildPolaroidEl(photo.src, photo.caption);
    const pos = randomPosition(el);
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';

    // Set rotation CSS variable (used by the keyframe animation)
    const rot = randomRotation();
    el.style.setProperty('--rot', rot + 'deg');
    el.style.transform = `rotate(${rot}deg)`;

    layer.appendChild(el);
    active.push({ el, src: photo.src, caption: photo.caption });

    // Trigger enter animation
    requestAnimationFrame(() => {
      el.classList.add('polaroid-enter');
      el.addEventListener('animationend', () => {
        el.classList.remove('polaroid-enter');
      }, { once: true });
    });
  }

  // ── Build DOM element ─────────────────────────────────────────────────────────
  function buildPolaroidEl(src, caption) {
    const size = SIZE_POOL[Math.floor(Math.random() * SIZE_POOL.length)];

    const el = document.createElement('div');
    el.className = `polaroid polaroid--${size}`;

    // Washi tape strip
    const tape = document.createElement('div');
    tape.className = 'polaroid-tape';
    // Slight per-polaroid tape angle variation
    tape.style.transform = `translateX(-50%) rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
    el.appendChild(tape);

    // Photo
    const img = document.createElement('img');
    img.src = src;
    img.alt = caption ? `Photo from ${caption}` : 'Shared photo';
    img.draggable = false; // prevent browser drag of the image
    el.appendChild(img);

    // Caption
    if (caption) {
      const cap = document.createElement('div');
      cap.className = 'polaroid-caption';
      cap.textContent = caption;
      el.appendChild(cap);
    }

    // Drag support
    attachDrag(el);

    return el;
  }

  // ── Position helpers ──────────────────────────────────────────────────────────
  function randomPosition(el) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Estimate polaroid rendered size (before we know exact dimensions)
    // Use the largest possible size (140px + padding) as a safe margin
    const elW = 160;
    const elH = 180;

    // Left margin: 0–15% of screen width
    // Right margin: 85–100% of screen width
    const inLeft  = Math.random() < 0.5; // 50/50 left vs right edge
    let x;
    if (inLeft) {
      // left zone: 0 to (vw * 0.15 - elW), clamped to ≥0
      x = Math.random() * Math.max(vw * 0.15 - elW, 10);
    } else {
      // right zone: vw * 0.85 to (vw - elW)
      x = vw * 0.85 + Math.random() * Math.max(vw * 0.15 - elW, 10);
      x = Math.min(x, vw - elW);
    }

    const y = Math.random() * Math.max(vh - elH, 20);

    return { x: Math.round(x), y: Math.round(y) };
  }

  function randomRotation() {
    return parseFloat((Math.random() * 16 - 8).toFixed(2)); // –8 to +8 deg
  }

  // ── Swap logic ────────────────────────────────────────────────────────────────
  function swapOne() {
    if (!layer || isMobile()) return;
    if (active.length === 0) return;

    // Find a known photo not currently shown
    const candidates = known.filter(p => !active.find(a => a.src === p.src));
    if (candidates.length === 0) return; // nothing new to swap in

    // Pick a random active polaroid to remove
    const removeIdx = Math.floor(Math.random() * active.length);
    const removeItem = active[removeIdx];

    // Fade out the old one
    fadeOut(removeItem.el, () => {
      if (removeItem.el.parentNode) removeItem.el.parentNode.removeChild(removeItem.el);
      active.splice(removeIdx, 1);

      // Place a new one
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      placePolaroid(next);
    });
  }

  function fadeOut(el, cb) {
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '0';
    setTimeout(cb, 420);
  }

  // ── Drag support ──────────────────────────────────────────────────────────────
  function attachDrag(el) {
    let dragging = false;
    let startX, startY, origLeft, origTop;

    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // left button only
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = parseInt(el.style.left, 10) || 0;
      origTop  = parseInt(el.style.top,  10) || 0;

      el.style.cursor = 'grabbing';
      el.style.zIndex = '20';
      el.style.transition = 'none';

      // Allow pointer events on layer while dragging
      if (layer) layer.style.pointerEvents = 'auto';

      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = (origLeft + dx) + 'px';
      el.style.top  = (origTop  + dy) + 'px';
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = 'grab';
      el.style.zIndex = '';
      el.style.transition = '';

      // Restore layer pointer-events to none once done
      if (layer) layer.style.pointerEvents = '';
    });

    // Touch drag support
    el.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      dragging = true;
      startX = touch.clientX;
      startY = touch.clientY;
      origLeft = parseInt(el.style.left, 10) || 0;
      origTop  = parseInt(el.style.top,  10) || 0;
      el.style.zIndex = '20';
      el.style.transition = 'none';
      if (layer) layer.style.pointerEvents = 'auto';
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      el.style.left = (origLeft + dx) + 'px';
      el.style.top  = (origTop  + dy) + 'px';
    }, { passive: true });

    el.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      el.style.zIndex = '';
      el.style.transition = '';
      if (layer) layer.style.pointerEvents = '';
    }, { passive: true });
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  /**
   * window.addPolaroid(src, caption)
   * Called by app.js when a new photo arrives in the feed.
   */
  window.addPolaroid = function (src, caption) {
    if (!src) return;
    caption = caption || '';

    // Deduplicate
    if (known.find(p => p.src === src)) return;

    const photo = { src, caption };
    known.push(photo);

    if (active.length < MAX_POLAROIDS) {
      maybePlace(photo);
    }
    // If at max, the next scheduled swap will pick it up
  };

  // ── Kick off ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also init after the app unlocks (pin gate)
  window.addEventListener('soulSafetyUnlocked', () => {
    // Give app.js a moment to render the feed first
    setTimeout(scanFeed, 800);
  });

})();
