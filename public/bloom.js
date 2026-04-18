/**
 * bloom.js — Blooming flower entry animation
 * A flower bud opens petal by petal, revealing the message
 * "Welcome to a safe place. Peace is here if you need it."
 * Then fades out and reveals the site.
 */
(function() {
  const BLOOM_KEY = 'soulSafetyBloomSeen';
  const canvas = document.getElementById('bloomCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, cx, cy;
  let startTime = 0;
  let animating = true;
  const TOTAL_DURATION = 5500; // ms total before fade
  const FADE_START = 4800;
  const PETAL_COUNT = 8;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
  }

  // Petal shape — teardrop via bezier curves
  function drawPetal(ctx, angle, openAmount, size, color, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    const petalLen = size * openAmount;
    const petalWidth = size * 0.35 * openAmount;
    const yOffset = -size * 0.15 * (1 - openAmount); // petals start close, move outward

    ctx.translate(0, yOffset);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      -petalWidth, -petalLen * 0.4,
      -petalWidth * 0.8, -petalLen * 0.9,
      0, -petalLen
    );
    ctx.bezierCurveTo(
      petalWidth * 0.8, -petalLen * 0.9,
      petalWidth, -petalLen * 0.4,
      0, 0
    );
    ctx.fillStyle = color;
    ctx.fill();

    // Subtle vein line
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -petalLen * 0.8);
    ctx.strokeStyle = 'rgba(61, 36, 22, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  // Center of flower
  function drawCenter(ctx, openAmount, size) {
    const r = size * 0.18 * Math.min(openAmount * 1.5, 1);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(218, 165, 32, 0.9)');
    grad.addColorStop(0.6, 'rgba(194, 98, 58, 0.7)');
    grad.addColorStop(1, 'rgba(194, 98, 58, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Floating particles around the bloom
  const particles = [];
  function initParticles() {
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * W * 0.6,
        y: cy + (Math.random() - 0.5) * H * 0.6,
        r: 1 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.4,
        alpha: Math.random() * 0.4,
        delay: Math.random() * 2000
      });
    }
  }

  function drawParticles(t) {
    particles.forEach(p => {
      if (t < p.delay) return;
      const age = (t - p.delay) / 1000;
      const px = p.x + p.vx * age * 60;
      const py = p.y + p.vy * age * 60;
      const a = p.alpha * Math.min((t - p.delay) / 800, 1);
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(218, 165, 32, ${a})`;
      ctx.fill();
    });
  }

  // Text rendering
  function drawText(alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    // Main message
    ctx.font = '500 clamp(18px, 4vw, 28px) "Sentient", serif';
    ctx.fillStyle = '#faf6ef';
    ctx.fillText('Welcome to a safe place', cx, cy + (Math.min(W, H) * 0.22));

    // Sub message
    ctx.font = '400 clamp(13px, 2.5vw, 17px) "General Sans", sans-serif';
    ctx.fillStyle = 'rgba(250, 246, 239, 0.7)';
    ctx.fillText('Peace is here if you need it', cx, cy + (Math.min(W, H) * 0.22) + 32);

    ctx.restore();
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function frame(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    ctx.clearRect(0, 0, W, H);

    // Background — deep warm dark
    ctx.fillStyle = 'rgba(17, 10, 7, 0.97)';
    ctx.fillRect(0, 0, W, H);

    // Subtle radial glow behind flower
    const glowR = Math.min(W, H) * 0.5;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, 'rgba(194, 98, 58, 0.08)');
    glow.addColorStop(0.5, 'rgba(107, 142, 95, 0.04)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Bloom progress (0 → 1 over first 3s)
    const bloomProgress = easeOutCubic(Math.min(elapsed / 3000, 1));
    const petalSize = Math.min(W, H) * 0.18;

    // Draw petals — outer ring (slightly delayed, lighter)
    const petalColors = [
      'rgba(194, 98, 58, 0.6)',  // terracotta
      'rgba(187, 113, 72, 0.5)',
      'rgba(194, 98, 58, 0.55)',
      'rgba(180, 100, 65, 0.5)',
      'rgba(194, 98, 58, 0.6)',
      'rgba(190, 108, 68, 0.5)',
      'rgba(194, 98, 58, 0.55)',
      'rgba(185, 105, 60, 0.5)'
    ];

    // Outer petals (delayed bloom)
    for (let i = 0; i < PETAL_COUNT; i++) {
      const delay = i * 0.06;
      const pProgress = easeOutCubic(Math.max(0, Math.min((elapsed / 3000 - delay) / (1 - delay), 1)));
      const angle = (i / PETAL_COUNT) * Math.PI * 2 - Math.PI / 2;
      drawPetal(ctx, angle, pProgress, petalSize * 1.2, petalColors[i], 0.5 * pProgress);
    }

    // Inner petals (bloom first)
    for (let i = 0; i < PETAL_COUNT; i++) {
      const angle = (i / PETAL_COUNT) * Math.PI * 2 + Math.PI / PETAL_COUNT - Math.PI / 2;
      drawPetal(ctx, angle, bloomProgress, petalSize, petalColors[i], 0.8 * bloomProgress);
    }

    // Center
    drawCenter(ctx, bloomProgress, petalSize);

    // Particles
    drawParticles(elapsed);

    // Text fades in after bloom completes (3s → 4.5s)
    const textAlpha = elapsed > 2500 ? easeInOutQuad(Math.min((elapsed - 2500) / 1200, 1)) : 0;
    drawText(textAlpha);

    // Fade out entire canvas
    if (elapsed > FADE_START) {
      const fadeProgress = Math.min((elapsed - FADE_START) / 700, 1);
      ctx.fillStyle = `rgba(17, 10, 7, ${fadeProgress})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (elapsed < TOTAL_DURATION) {
      requestAnimationFrame(frame);
    } else {
      finishBloom();
    }
  }

  function finishBloom() {
    animating = false;
    const overlay = document.getElementById('bloomOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.remove();
      }, 400);
    }
    localStorage.setItem(BLOOM_KEY, '1');
  }

  // Skip on tap/click
  function skipBloom() {
    if (!animating) return;
    finishBloom();
  }

  // Initialize
  function init() {
    // Only show bloom once per session
    if (localStorage.getItem(BLOOM_KEY)) {
      const overlay = document.getElementById('bloomOverlay');
      if (overlay) { overlay.style.display = 'none'; overlay.remove(); }
      return;
    }

    resize();
    initParticles();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', skipBloom);
    canvas.addEventListener('touchstart', skipBloom);
    requestAnimationFrame(frame);
  }

  // Wait for fonts to load
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    window.addEventListener('load', init);
  }
})();
