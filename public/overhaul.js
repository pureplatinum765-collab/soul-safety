/* ============================================================
   overhaul.js — Soul Safety Immersive Visual Overhaul
   Factoids, Scene Illustrations, Portal Effect, Constellation
   ============================================================ */
(function () {
  'use strict';

  /* ── CONSTANTS ── */
  var API_BASE = '/api/messages'; // reuse messages endpoint for factoids via query
  var FACTOID_POSITIONS = [
    { top: '12%', left: '3%', rot: -3 },
    { top: '28%', right: '2%', rot: 2 },
    { top: '45%', left: '1%', rot: -1.5 },
    { top: '62%', right: '4%', rot: 3 },
    { top: '78%', left: '5%', rot: -2 },
    { top: '18%', right: '6%', rot: 1.5 },
    { top: '55%', left: '2%', rot: -4 },
    { top: '85%', right: '3%', rot: 2.5 },
    { top: '35%', left: '4%', rot: -0.5 },
    { top: '70%', right: '1%', rot: -1 },
  ];

  /* Default factoids (shown when no Supabase data) */
  var DEFAULT_FACTOIDS = [
    { author: 'raphael', about: 'taylor', content: 'Taylor always hums when she\'s thinking' },
    { author: 'taylor', about: 'raphael', content: 'Raphael makes the best playlists for road trips' },
    { author: 'raphael', about: 'taylor', content: 'Taylor finds the coolest little shops everywhere she goes' },
    { author: 'taylor', about: 'raphael', content: 'Raphael sees beauty in everything, even the mundane' },
    { author: 'raphael', about: '', content: 'I believe every sunset is a love letter from the universe' },
    { author: 'taylor', about: '', content: 'Curiosity is my compass, wonder is my map' },
    { author: 'raphael', about: 'taylor', content: 'Taylor\'s laugh could brighten the darkest room' },
    { author: 'taylor', about: 'raphael', content: 'Raphael\'s energy is like a warm campfire on a cold night' },
  ];

  /* ── FACTOIDS LAYER ── */
  function createFactoidLayer() {
    var layer = document.createElement('div');
    layer.className = 'factoid-layer';
    layer.id = 'factoidLayer';
    document.body.appendChild(layer);
    return layer;
  }

  function renderFactoids(factoids) {
    var layer = document.getElementById('factoidLayer') || createFactoidLayer();
    layer.innerHTML = '';

    // Only show up to 8 factoids at a time for elegance
    var items = factoids.slice(0, 8);
    var pageH = document.documentElement.scrollHeight;

    items.forEach(function (f, i) {
      var note = document.createElement('div');
      note.className = 'factoid-note';

      var pos = FACTOID_POSITIONS[i % FACTOID_POSITIONS.length];
      var rotation = pos.rot + (Math.random() - 0.5) * 3;
      var targetOpacity = 0.4 + Math.random() * 0.25;

      note.style.setProperty('--rotation', rotation + 'deg');
      note.style.setProperty('--delay', (i * 0.3 + 0.5) + 's');
      note.style.setProperty('--target-opacity', targetOpacity);

      // Distribute factoids along the page height
      var verticalOffset = 15 + (i / items.length) * 65; // 15% to 80% of page
      note.style.top = verticalOffset + '%';

      // Alternate left/right with slight randomness
      if (i % 2 === 0) {
        note.style.left = (1 + Math.random() * 4) + '%';
      } else {
        note.style.right = (1 + Math.random() * 4) + '%';
      }

      var content = document.createTextNode('"' + f.content + '"');
      note.appendChild(content);

      var authorEl = document.createElement('span');
      authorEl.className = 'factoid-author';
      var aboutText = f.about ? ' about ' + f.about : '';
      authorEl.textContent = '— ' + f.author + aboutText;
      note.appendChild(authorEl);

      layer.appendChild(note);
    });
  }

  async function loadFactoids() {
    // Try to load from Supabase via factoids endpoint
    try {
      var token = window.authToken || localStorage.getItem('soulSafetyBearerToken') || '';
      var resp = await fetch('/api/messages/factoids', {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (resp.ok) {
        var data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          var factoids = data.map(function (f) {
            return { author: f.user_id, about: f.about || '', content: f.text };
          });
          renderFactoids(factoids);
          return;
        }
      }
    } catch (e) {
      // fallback to defaults
    }
    renderFactoids(DEFAULT_FACTOIDS);
  }

  /* ── FACTOID COMPOSE UI ── */
  function createComposeModal() {
    var modal = document.createElement('div');
    modal.className = 'factoid-compose';
    modal.id = 'factoidCompose';
    modal.innerHTML =
      '<div class="factoid-compose-card">' +
        '<h3>Add a Factoid</h3>' +
        '<textarea id="factoidText" placeholder="Write something about yourself or your friend..." maxlength="200"></textarea>' +
        '<div class="about-selector">' +
          '<button class="about-option selected" data-about="">About myself</button>' +
          '<button class="about-option" data-about="taylor">About Taylor</button>' +
          '<button class="about-option" data-about="raphael">About Raphael</button>' +
        '</div>' +
        '<div class="compose-actions">' +
          '<button class="compose-cancel" type="button">Cancel</button>' +
          '<button class="compose-submit" type="button">Add</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // Event handlers
    var aboutBtns = modal.querySelectorAll('.about-option');
    var selectedAbout = '';

    aboutBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        aboutBtns.forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedAbout = btn.dataset.about;
      });
    });

    modal.querySelector('.compose-cancel').addEventListener('click', function () {
      modal.classList.remove('open');
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('open');
    });

    modal.querySelector('.compose-submit').addEventListener('click', async function () {
      var text = document.getElementById('factoidText').value.trim();
      if (!text) return;

      var currentUser = window.currentUser || 'raphael';
      var token = window.authToken || localStorage.getItem('soulSafetyBearerToken') || '';

      // Save via factoids API
      try {
        await fetch('/api/messages/factoids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? 'Bearer ' + token : ''
          },
          body: JSON.stringify({
            user_id: currentUser,
            text: text,
            about: selectedAbout || currentUser
          })
        });
      } catch (e) {
        // Store locally as fallback
      }

      // Add to display immediately
      DEFAULT_FACTOIDS.unshift({ author: currentUser, about: selectedAbout, content: text });
      renderFactoids(DEFAULT_FACTOIDS);

      document.getElementById('factoidText').value = '';
      modal.classList.remove('open');
    });

    return modal;
  }

  function createAddButton() {
    var btn = document.createElement('button');
    btn.className = 'factoid-add-btn';
    btn.id = 'factoidAddBtn';
    btn.setAttribute('aria-label', 'Add a factoid');
    btn.title = 'Add a factoid about you or your friend';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
    document.body.appendChild(btn);

    btn.addEventListener('click', function () {
      var modal = document.getElementById('factoidCompose') || createComposeModal();
      modal.classList.add('open');
      setTimeout(function () {
        var textarea = document.getElementById('factoidText');
        if (textarea) textarea.focus();
      }, 100);
    });
  }

  /* ── SVG SCENE ILLUSTRATIONS ── */
  function injectBotanicalSVGs() {
    var hero = document.querySelector('.hero');
    if (!hero) return;

    // Top-left vine/botanical
    var tlSvg = document.createElement('div');
    tlSvg.className = 'hero-botanical hero-botanical--tl';
    tlSvg.innerHTML = '<svg width="120" height="200" viewBox="0 0 120 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M10 0 C10 40, 30 60, 20 100 C10 140, 40 160, 30 200" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>' +
      '<path d="M20 30 C35 25, 45 35, 40 50 C35 65, 20 60, 20 45" stroke="currentColor" stroke-width="1" fill="currentColor" opacity="0.08"/>' +
      '<path d="M15 80 C0 75, -5 85, 5 95 C15 105, 25 95, 15 85" stroke="currentColor" stroke-width="1" fill="currentColor" opacity="0.06"/>' +
      '<circle cx="25" cy="55" r="2" fill="currentColor" opacity="0.15"/>' +
      '<circle cx="10" cy="120" r="1.5" fill="currentColor" opacity="0.1"/>' +
      '<path d="M18 140 C30 130, 45 140, 35 155 C25 165, 12 155, 18 145" stroke="currentColor" stroke-width="1" fill="currentColor" opacity="0.05"/>' +
      '</svg>';
    hero.appendChild(tlSvg);

    // Top-right (mirrored)
    var trSvg = tlSvg.cloneNode(true);
    trSvg.className = 'hero-botanical hero-botanical--tr';
    hero.appendChild(trSvg);

    // Bottom-left small accent
    var blSvg = document.createElement('div');
    blSvg.className = 'hero-botanical hero-botanical--bl';
    blSvg.innerHTML = '<svg width="80" height="100" viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 100 C5 70, 20 50, 15 30 C10 10, 30 0, 40 20" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>' +
      '<circle cx="15" cy="45" r="3" fill="currentColor" opacity="0.08"/>' +
      '<path d="M20 60 C30 50, 40 55, 35 68 C30 80, 15 75, 20 65" stroke="currentColor" stroke-width="1" fill="currentColor" opacity="0.06"/>' +
      '</svg>';
    hero.appendChild(blSvg);

    var brSvg = blSvg.cloneNode(true);
    brSvg.className = 'hero-botanical hero-botanical--br';
    hero.appendChild(brSvg);
  }

  /* ── FLOATING LANTERNS ── */
  function createFloatingLanterns() {
    var sections = document.querySelectorAll('.curiosity-shop, .game-section, .feed-section');
    sections.forEach(function (section, i) {
      if (section.querySelector('.floating-lantern')) return;

      var lantern = document.createElement('div');
      lantern.className = 'floating-lantern';
      lantern.style.animationDelay = (-i * 2.5) + 's';

      // Position varies per section
      if (i % 2 === 0) {
        lantern.style.right = '2rem';
        lantern.style.top = '1rem';
      } else {
        lantern.style.left = '2rem';
        lantern.style.top = '1.5rem';
      }

      lantern.innerHTML = '<svg width="28" height="44" viewBox="0 0 28 44" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M14 0 L14 6" stroke="currentColor" stroke-width="1" opacity="0.4"/>' +
        '<rect x="6" y="6" width="16" height="4" rx="2" fill="currentColor" opacity="0.2"/>' +
        '<path d="M7 10 C7 10, 4 20, 6 30 C8 36, 20 36, 22 30 C24 20, 21 10, 21 10" fill="rgba(255,170,60,0.15)" stroke="currentColor" stroke-width="1" opacity="0.3"/>' +
        '<ellipse cx="14" cy="22" rx="4" ry="6" fill="rgba(255,170,60,0.2)"/>' +
        '<ellipse cx="14" cy="22" rx="2" ry="3" fill="rgba(255,200,100,0.3)"/>' +
        '</svg>';
      section.style.position = 'relative';
      section.appendChild(lantern);
    });
  }

  /* ── CONSTELLATION BACKGROUND ── */
  function createConstellationCanvas() {
    var canvas = document.createElement('canvas');
    canvas.className = 'constellation-layer';
    canvas.id = 'constellationCanvas';
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext('2d');
    var W, H;
    var stars = [];

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Generate stars
    var NUM_STARS = Math.min(80, Math.floor(window.innerWidth / 15));
    for (var i = 0; i < NUM_STARS; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.5 + Math.random() * 1.5,
        alpha: 0.1 + Math.random() * 0.4,
        twinkleSpeed: 0.003 + Math.random() * 0.008,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    // Draw connections between nearby stars
    function draw(time) {
      ctx.clearRect(0, 0, W, H);

      // Stars
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var twinkle = Math.sin(time * s.twinkleSpeed + s.twinkleOffset) * 0.5 + 0.5;
        var a = s.alpha * (0.3 + twinkle * 0.7);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240,228,210,' + a + ')';
        ctx.fill();
      }

      // Constellation lines (connect nearby stars)
      ctx.strokeStyle = 'rgba(240,228,210,0.04)';
      ctx.lineWidth = 0.5;
      for (var j = 0; j < stars.length; j++) {
        for (var k = j + 1; k < stars.length; k++) {
          var dx = stars[j].x - stars[k].x;
          var dy = stars[j].y - stars[k].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            var lineAlpha = (1 - dist / 120) * 0.06;
            ctx.strokeStyle = 'rgba(240,228,210,' + lineAlpha + ')';
            ctx.beginPath();
            ctx.moveTo(stars[j].x, stars[j].y);
            ctx.lineTo(stars[k].x, stars[k].y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    // Start after bloom
    setTimeout(function () {
      canvas.style.opacity = '1';
      canvas.style.transition = 'opacity 2s ease';
      requestAnimationFrame(draw);
    }, 3000);
  }

  /* ── PORTAL EFFECT FOR GAME SECTION ── */
  function setupPortalEffect() {
    var gameSection = document.getElementById('gameSection');
    if (!gameSection || !('IntersectionObserver' in window)) return;

    // Add frame corners to game section
    var inner = gameSection.querySelector('.game-section__inner');
    if (inner) {
      var bl = document.createElement('div');
      bl.className = 'game-frame-corner-bl';
      inner.appendChild(bl);

      var br = document.createElement('div');
      br.className = 'game-frame-corner-br';
      inner.appendChild(br);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          gameSection.classList.add('portal-active');
        } else {
          gameSection.classList.remove('portal-active');
        }
      });
    }, { threshold: 0.15 });

    io.observe(gameSection);
  }

  /* ── ENHANCED SECTION REVEALS ── */
  function setupSectionReveals() {
    var sections = document.querySelectorAll(
      '.curiosity-shop, .milanote-section, .game-section, .mood-section, .daily-spark-inline'
    );

    if (!sections.length || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('reveal-section', 'revealed');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.05 });

    sections.forEach(function (el) {
      el.classList.add('reveal-section');
      io.observe(el);
    });
  }

  /* ── SECTION WASH DIVIDERS ── */
  function addSectionWashes() {
    var targets = document.querySelectorAll('.curiosity-shop, .game-section');
    targets.forEach(function (section) {
      if (section.previousElementSibling && !section.previousElementSibling.classList.contains('section-wash')) {
        var wash = document.createElement('div');
        wash.className = 'section-wash';
        section.parentNode.insertBefore(wash, section);
      }
    });
  }

  /* ── INIT ── */
  function init() {
    // Wait for auth
    var isAuthed = !!window.authToken || !!localStorage.getItem('soulSafetyBearerToken');

    function doInit() {
      createConstellationCanvas();
      injectBotanicalSVGs();
      createFloatingLanterns();
      setupPortalEffect();
      setupSectionReveals();
      addSectionWashes();
      createAddButton();

      // Load factoids after a delay for smooth entry
      setTimeout(loadFactoids, 1500);
    }

    if (isAuthed) {
      // Small delay to let page settle after bloom
      setTimeout(doInit, 2000);
    } else {
      // Wait for unlock
      window.addEventListener('soulSafetyUnlocked', function () {
        setTimeout(doInit, 1500);
      });
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
