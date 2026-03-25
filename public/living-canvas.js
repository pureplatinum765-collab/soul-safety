/**
 * living-canvas.js — Soul Safety living background
 * A gentle, magical forest window: rain, pollen, and tiny animal friends.
 * Self-contained IIFE, no dependencies.
 */
(function () {
  'use strict';

  // ─── Setup ────────────────────────────────────────────────────────────────

  const canvas = document.createElement('canvas');
  canvas.id = 'livingCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ─── Reduced-motion ───────────────────────────────────────────────────────

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Time-of-day ──────────────────────────────────────────────────────────

  function getTimeOfDay() {
    const h = new Date().getHours();
    if (h >= 6  && h < 12) return 'morning';
    if (h >= 12 && h < 18) return 'afternoon';
    if (h >= 18 && h < 21) return 'evening';
    return 'night';
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // ─── Rain ─────────────────────────────────────────────────────────────────

  const RAIN_COUNT = 70;
  const drops = [];

  function makeRaindrop() {
    return {
      x:     Math.random() * (W + 200) - 100,
      y:     Math.random() * H,
      len:   2 + Math.random() * 2,        // 2–4 px
      speed: 1.2 + Math.random() * 0.8,    // slow drift
      drift: (Math.random() - 0.5) * 0.4,  // gentle wind
    };
  }

  function initRain() {
    drops.length = 0;
    for (let i = 0; i < RAIN_COUNT; i++) drops.push(makeRaindrop());
  }

  function drawRain(tod, dark) {
    const isNight = tod === 'night';
    const alpha   = isNight ? (dark ? 0.18 : 0.10) : (dark ? 0.15 : 0.07);
    const count   = isNight ? Math.floor(RAIN_COUNT * 0.5) : RAIN_COUNT;

    ctx.save();
    ctx.strokeStyle = dark ? `rgba(200,220,255,${alpha})` : `rgba(140,160,200,${alpha})`;
    ctx.lineWidth   = 1;

    for (let i = 0; i < count; i++) {
      const d = drops[i];
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.drift * d.len * 2, d.y + d.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateRain() {
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y += d.speed;
      d.x += d.drift;
      if (d.y > H + 10) {
        drops[i] = makeRaindrop();
        drops[i].y = -10;
      }
    }
  }

  // ─── Floating particles / pollen / fireflies ──────────────────────────────

  const PARTICLE_COUNT = 25;
  const particles = [];

  function makeParticle(tod) {
    const isNight   = tod === 'night';
    const isMorning = tod === 'morning';
    const isEvening = tod === 'evening';

    let r, g, b;
    if (isNight)        { r = 180; g = 220; b = 255; }  // cool blue-white firefly
    else if (isMorning) { r = 255; g = 220; b = 100; }  // warm gold
    else if (isEvening) { r = 218; g = 165; b = 32;  }  // amber #daa520
    else                { r = 210; g = 185; b = 100; }  // gentle pollen

    return {
      x:     Math.random() * W,
      y:     Math.random() * H,
      radius: 1 + Math.random() * 2,
      baseAlpha: isNight ? 0.5 : 0.28,
      alpha: 0,
      r, g, b,
      speedX: (Math.random() - 0.5) * 0.25,
      speedY: -0.1 - Math.random() * 0.15,
      sinOffset: Math.random() * Math.PI * 2,
      sinAmp:    8 + Math.random() * 12,
      sinFreq:   0.003 + Math.random() * 0.004,
      glowing:   Math.random() < (isNight ? 0.6 : 0.3),
      age:       Math.random() * 400,      // start at random phase
      lifespan:  300 + Math.random() * 400,
    };
  }

  function initParticles(tod) {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = makeParticle(tod);
      p.alpha = Math.random() * p.baseAlpha; // pre-populate at random opacity
      particles.push(p);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      if (p.alpha <= 0) continue;

      const x = p.x + Math.sin(p.age * p.sinFreq + p.sinOffset) * p.sinAmp;

      if (p.glowing) {
        // soft glow
        const grad = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.radius * 4);
        grad.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${p.alpha})`);
        grad.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
        ctx.beginPath();
        ctx.arc(x, p.y, p.radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`;
      ctx.fill();
    }
  }

  function updateParticles(tod) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age++;
      p.x += p.speedX;
      p.y += p.speedY;

      // fade in then out over lifespan
      const phase = p.age / p.lifespan;
      if (phase < 0.2)      p.alpha = p.baseAlpha * (phase / 0.2);
      else if (phase < 0.7) p.alpha = p.baseAlpha;
      else                  p.alpha = p.baseAlpha * (1 - (phase - 0.7) / 0.3);

      if (p.age >= p.lifespan || p.y < -20 || p.x < -50 || p.x > W + 50) {
        particles[i] = makeParticle(tod);
        particles[i].y = H + 10; // enter from bottom
      }
    }
  }

  // ─── Night stars ──────────────────────────────────────────────────────────

  const STAR_COUNT = 40;
  const stars = [];

  function initStars() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x:       Math.random() * W,
        y:       Math.random() * H * 0.6,  // top 60% of sky
        r:       0.5 + Math.random() * 1.2,
        alpha:   0.2 + Math.random() * 0.5,
        twinkle: Math.random() * Math.PI * 2,
        speed:   0.015 + Math.random() * 0.03,
      });
    }
  }

  function drawStars(dark) {
    const baseAlpha = dark ? 0.8 : 0.4;
    for (const s of stars) {
      const a = s.alpha * baseAlpha * (0.6 + 0.4 * Math.sin(s.twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,245,255,${a})`;
      ctx.fill();
    }
  }

  function updateStars() {
    for (const s of stars) {
      s.twinkle += s.speed;
    }
  }

  // ─── Animal: Frog ─────────────────────────────────────────────────────────

  const frog = {
    x: 0, y: 0,
    wobble: 0,
    wobbleDir: 1,
    wobbleSpeed: 0.018,
    wobbleMax: 0.04,
    scale: 1,
    breathe: 0,
  };

  function initFrog() {
    frog.x = W * 0.12;
    frog.y = H - 42;
    frog.wobble = 0;
  }

  function drawFrog(alpha) {
    const { x, y, wobble } = frog;
    const breatheScale = 1 + 0.025 * Math.sin(frog.breathe);
    const size = 18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(wobble);
    ctx.scale(breatheScale, breatheScale);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, size * 0.7, size * 0.9, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fill();

    // Body — round green circle
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = '#5a8f45';
    ctx.fill();

    // Belly highlight
    ctx.beginPath();
    ctx.ellipse(0, size * 0.25, size * 0.6, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#8fc472';
    ctx.fill();

    // Left eye bump
    ctx.beginPath();
    ctx.arc(-size * 0.4, -size * 0.55, size * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#5a8f45';
    ctx.fill();

    // Right eye bump
    ctx.beginPath();
    ctx.arc(size * 0.4, -size * 0.55, size * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#5a8f45';
    ctx.fill();

    // Left eye white
    ctx.beginPath();
    ctx.arc(-size * 0.4, -size * 0.58, size * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f5e8';
    ctx.fill();

    // Right eye white
    ctx.beginPath();
    ctx.arc(size * 0.4, -size * 0.58, size * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f5e8';
    ctx.fill();

    // Pupils
    ctx.beginPath();
    ctx.arc(-size * 0.4, -size * 0.6, size * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(size * 0.4, -size * 0.6, size * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // Tiny smile
    ctx.beginPath();
    ctx.arc(0, -size * 0.1, size * 0.3, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = '#3d6b2e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  function updateFrog() {
    frog.wobble += frog.wobbleSpeed * frog.wobbleDir;
    if (Math.abs(frog.wobble) >= frog.wobbleMax) frog.wobbleDir *= -1;
    frog.breathe += 0.022;
    if (frog.x > W * 0.22) { frog.x = W * 0.12; }
  }

  // ─── Animal: Bunny ────────────────────────────────────────────────────────

  const bunny = {
    x: 0, y: 0,
    baseY: 0,
    hopOffset: 0,
    hopProgress: 0,   // 0..1 during hop
    hopping: false,
    hopTimer: 0,
    hopInterval: 9000 + Math.random() * 3000,
    wobble: 0,
    wobbleDir: 1,
    breathe: 0,
  };

  function initBunny() {
    bunny.x = W * 0.82;
    bunny.y = H - 45;
    bunny.baseY = bunny.y;
  }

  function drawBunny(alpha) {
    const { x, y, wobble } = bunny;
    const breatheScale = 1 + 0.02 * Math.sin(bunny.breathe);
    const size = 14;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(wobble);
    ctx.scale(breatheScale, breatheScale);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, size * 0.9, size * 0.85, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fill();

    // Left ear (tall oval)
    ctx.save();
    ctx.translate(-size * 0.35, -size * 1.1);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.22, size * 0.7, -0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#d4c4b8';
    ctx.fill();
    // Inner ear
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.1, size * 0.5, -0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#e8b4b4';
    ctx.fill();
    ctx.restore();

    // Right ear
    ctx.save();
    ctx.translate(size * 0.35, -size * 1.1);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.22, size * 0.7, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#d4c4b8';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.1, size * 0.5, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#e8b4b4';
    ctx.fill();
    ctx.restore();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, size * 0.25, size * 0.75, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e0d4c8';
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, -size * 0.15, size * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = '#e8dcd0';
    ctx.fill();

    // Eyes
    ctx.beginPath();
    ctx.arc(-size * 0.22, -size * 0.28, size * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#2a1a1a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(size * 0.22, -size * 0.28, size * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#2a1a1a';
    ctx.fill();

    // Nose dot
    ctx.beginPath();
    ctx.arc(0, -size * 0.05, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#d4849a';
    ctx.fill();

    // Fluffy tail
    ctx.beginPath();
    ctx.arc(size * 0.6, size * 0.5, size * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f0ea';
    ctx.fill();

    ctx.restore();
  }

  function updateBunny(dt) {
    bunny.breathe += 0.028;

    // Gentle side wobble when not hopping
    if (!bunny.hopping) {
      bunny.wobble += 0.012 * bunny.wobbleDir;
      if (Math.abs(bunny.wobble) > 0.03) bunny.wobbleDir *= -1;
    }

    // Hop timing
    bunny.hopTimer += dt;
    if (!bunny.hopping && bunny.hopTimer >= bunny.hopInterval) {
      bunny.hopping = true;
      bunny.hopProgress = 0;
      bunny.hopTimer = 0;
      bunny.hopInterval = 9000 + Math.random() * 3000;
    }

    if (bunny.hopping) {
      bunny.hopProgress += 0.04;
      // Parabolic hop arc
      const t = bunny.hopProgress;
      bunny.hopOffset = -Math.sin(t * Math.PI) * 18;
      if (bunny.hopProgress >= 1) {
        bunny.hopping = false;
        bunny.hopOffset = 0;
        bunny.x += 14; // move a tiny bit forward
        if (bunny.x > W * 0.92) bunny.x = W * 0.12;
      }
      bunny.y = bunny.baseY + bunny.hopOffset;
    }
  }

  // ─── Animal: Bird ─────────────────────────────────────────────────────────

  const bird = {
    x: 0, y: 0,
    speed: 0.55,
    wingAngle: 0,
    wingDir: 1,
    wobble: 0,
  };

  function initBird() {
    bird.x = -30;
    bird.y = H * 0.12 + Math.random() * H * 0.1;
  }

  function drawBird(alpha) {
    const { x, y, wingAngle } = bird;
    const size = 16;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // Body — tapered teardrop facing right
    ctx.beginPath();
    ctx.moveTo(size * 0.9, 0);
    ctx.bezierCurveTo(size * 0.5, -size * 0.28, -size * 0.5, -size * 0.22, -size * 0.9, 0);
    ctx.bezierCurveTo(-size * 0.5, size * 0.18, size * 0.5, size * 0.22, size * 0.9, 0);
    ctx.fillStyle = '#8b6f47';
    ctx.fill();

    // Wing (flapping) — upper arc
    ctx.save();
    ctx.translate(-size * 0.1, -size * 0.05);
    ctx.rotate(-wingAngle);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.65, size * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#6b5235';
    ctx.fill();
    ctx.restore();

    // Beak — tiny triangle
    ctx.beginPath();
    ctx.moveTo(size * 0.9, -size * 0.04);
    ctx.lineTo(size * 1.25, 0);
    ctx.lineTo(size * 0.9, size * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#c8a04a';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(size * 0.55, -size * 0.1, size * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1208';
    ctx.fill();

    // White eye glint
    ctx.beginPath();
    ctx.arc(size * 0.58, -size * 0.13, size * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.restore();
  }

  function updateBird() {
    bird.x += bird.speed;
    bird.wingAngle += 0.12 * bird.wingDir;
    if (Math.abs(bird.wingAngle) > 0.35) bird.wingDir *= -1;
    // gentle sine drift in altitude
    bird.y += Math.sin(bird.x * 0.008) * 0.3;

    if (bird.x > W + 40) {
      bird.x = -40;
      bird.y = H * 0.08 + Math.random() * H * 0.12;
    }
  }

  // ─── Animal: Snail ────────────────────────────────────────────────────────

  const snail = {
    x: 0, y: 0,
    speed: 0.08,
    bobble: 0,
    wobble: 0,
    spiralAngle: 0,
  };

  function initSnail() {
    snail.x = W * 0.45;
    snail.y = H - 32;
    snail.speed = 0.08 + Math.random() * 0.04;
  }

  function drawSnail(alpha) {
    const { x, y, bobble } = snail;
    const size = 13;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + bobble);

    // Body — small elongated blob
    ctx.beginPath();
    ctx.ellipse(-size * 0.4, size * 0.2, size * 0.85, size * 0.32, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#b5945a';
    ctx.fill();

    // Head — small circle at front
    ctx.beginPath();
    ctx.arc(size * 0.45, size * 0.08, size * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#c8a86a';
    ctx.fill();

    // Antennae (two thin lines + dots)
    ctx.strokeStyle = '#a07848';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size * 0.4, -size * 0.08);
    ctx.lineTo(size * 0.22, -size * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.52, -size * 0.08);
    ctx.lineTo(size * 0.7, -size * 0.55);
    ctx.stroke();
    // Antenna tips
    ctx.beginPath();
    ctx.arc(size * 0.22, -size * 0.58, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1208';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.7, -size * 0.58, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1208';
    ctx.fill();

    // Shell — half-circle with spiral
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.05, size * 0.72, Math.PI, 0, false);
    ctx.closePath();
    ctx.fillStyle = '#8b5e3c';
    ctx.fill();

    // Shell highlight arc
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.05, size * 0.52, Math.PI + 0.3, -0.3, false);
    ctx.strokeStyle = '#c08050';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Spiral (3 arcs, shrinking)
    for (let i = 3; i >= 1; i--) {
      const r = size * 0.18 * i;
      ctx.beginPath();
      ctx.arc(-size * 0.25, -size * 0.05, r, Math.PI * 0.2, Math.PI * 1.8, false);
      ctx.strokeStyle = `rgba(60,30,10,${0.15 + i * 0.06})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  function updateSnail() {
    snail.x += snail.speed;
    snail.bobble = Math.sin(snail.x * 0.25) * 0.8;
    snail.spiralAngle += 0.01;
    if (snail.x > W + 30) {
      snail.x = -30;
      snail.y = H - 28 - Math.random() * 10;
    }
  }

  // ─── Animal opacity by theme ───────────────────────────────────────────────

  function animalAlpha(dark) {
    return dark ? 0.48 : 0.38;
  }

  // ─── Static scene (reduced-motion) ────────────────────────────────────────

  function drawStaticScene() {
    const tod  = getTimeOfDay();
    const dark = isDark();
    const a    = animalAlpha(dark);

    ctx.clearRect(0, 0, W, H);

    // A handful of static particles
    for (let i = 0; i < 12; i++) {
      const px = (W / 13) * i + 30;
      const py = 80 + (i % 4) * 60 + Math.sin(i) * 40;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = tod === 'night' ? 'rgba(180,220,255,0.3)' : 'rgba(218,165,32,0.25)';
      ctx.fill();
    }

    if (tod === 'night') {
      initStars();
      drawStars(dark);
    }

    initFrog();  drawFrog(a);
    initBunny(); drawBunny(a);
    initBird();  drawBird(a);
    initSnail(); drawSnail(a);
  }

  // ─── Main animation loop ───────────────────────────────────────────────────

  let lastTime = 0;
  let tod = getTimeOfDay();
  let todUpdateTimer = 0;

  // Re-evaluate time-of-day every 5 minutes
  const TOD_UPDATE_INTERVAL = 5 * 60 * 1000;

  function init() {
    tod = getTimeOfDay();
    initRain();
    initParticles(tod);
    if (tod === 'night') initStars();
    initFrog();
    initBunny();
    initBird();
    initSnail();
  }

  function frame(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    // Periodically refresh time-of-day bucket
    todUpdateTimer += dt;
    if (todUpdateTimer >= TOD_UPDATE_INTERVAL) {
      tod = getTimeOfDay();
      todUpdateTimer = 0;
      // Reinit night stars if needed
      if (tod === 'night' && stars.length === 0) initStars();
    }

    const dark = isDark();
    ctx.clearRect(0, 0, W, H);

    // Stars (night only)
    if (tod === 'night') {
      drawStars(dark);
      updateStars();
    }

    // Rain
    drawRain(tod, dark);
    updateRain();

    // Particles
    drawParticles();
    updateParticles(tod);

    // Animals
    const a = animalAlpha(dark);
    drawFrog(a);   updateFrog();
    drawBunny(a);  updateBunny(dt);
    drawBird(a);   updateBird();
    drawSnail(a);  updateSnail();

    requestAnimationFrame(frame);
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  if (reducedMotion) {
    drawStaticScene();
  } else {
    init();
    requestAnimationFrame(frame);
  }

  // Observe theme changes and re-init stars when switching to night
  const themeObserver = new MutationObserver(() => {
    tod = getTimeOfDay();
    if (tod === 'night' && stars.length === 0) initStars();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

})();
