/* immersive.js — Soul Safety depth layer
   Cursor · Smooth scroll · Ambient particles · Scroll reveals · Progress bar
   Runs after DOM is ready; gracefully no-ops if elements are missing. */

(function () {
  'use strict';

  // ── Smooth scroll (Lenis) ──────────────────────────────────────────────
  let lenis;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.08, smoothWheel: true, syncTouch: false });
    function rafLoop(time) { lenis.raf(time); requestAnimationFrame(rafLoop); }
    requestAnimationFrame(rafLoop);
  }

  // ── Scroll progress bar ───────────────────────────────────────────────
  const progressBar = document.getElementById('scrollProgress');
  if (progressBar) {
    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      progressBar.style.transform = `scaleX(${window.scrollY / max})`;
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
  }

  // ── Depth orbs: show after bloom ──────────────────────────────────────
  setTimeout(() => {
    document.getElementById('orb1')?.classList.add('visible');
    document.getElementById('orb2')?.classList.add('visible');
  }, 2800);

  // ── Ambient canvas: floating embers ───────────────────────────────────
  const canvas = document.getElementById('ambientCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const NUM = window.innerWidth < 640 ? 28 : 55;

    const rand = (a, b) => a + Math.random() * (b - a);

    function makeParticle() {
      return {
        x: rand(0, W),
        y: rand(0, H),
        r: rand(0.8, 2.2),
        vx: rand(-0.12, 0.12),
        vy: rand(-0.25, -0.05),
        alpha: rand(0.03, 0.14),
        flicker: rand(0.004, 0.012),
        flickerDir: 1,
        baseAlpha: 0,
      };
    }

    for (let i = 0; i < NUM; i++) {
      const p = makeParticle();
      p.baseAlpha = p.alpha;
      particles.push(p);
    }

    let frame = 0;
    function draw() {
      frame++;
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        // drift
        p.x += p.vx;
        p.y += p.vy;
        // flicker
        p.alpha += p.flicker * p.flickerDir;
        if (p.alpha > p.baseAlpha * 1.6 || p.alpha < p.baseAlpha * 0.3) p.flickerDir *= -1;
        // wrap
        if (p.y < -10) { p.y = H + 10; p.x = rand(0, W); }
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        // warm ember colour
        const hue = 20 + Math.sin(frame * 0.01 + p.x) * 8;
        ctx.fillStyle = `hsla(${hue}, 70%, 72%, ${p.alpha})`;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    // Show canvas after bloom completes
    setTimeout(() => {
      canvas.classList.add('visible');
      draw();
    }, 2600);
  }

  // ── Custom cursor (desktop only) ──────────────────────────────────────
  const ring = document.getElementById('cursorRing');
  const dot  = document.getElementById('cursorDot');

  if (ring && dot && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let mx = -100, my = -100; // off-screen until first move
    let rx = -100, ry = -100;
    let rafId;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px';
      dot.style.top  = my + 'px';
    }, { passive: true });

    // Ring follows with lag
    const trackRing = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
      rafId = requestAnimationFrame(trackRing);
    };
    trackRing();

    // Hover detection
    const hoverTargets = 'a,button,[role="button"],.curiosity-card,.nav-tab,.penguin-btn,.penguin-chip,.polaroid,[data-minigame-launch]';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverTargets)) ring.classList.add('is-hovering');
    }, { passive: true });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverTargets)) ring.classList.remove('is-hovering');
    }, { passive: true });

    document.addEventListener('mousedown', () => ring.classList.add('is-clicking'),  { passive: true });
    document.addEventListener('mouseup',   () => ring.classList.remove('is-clicking'), { passive: true });

    // Hide when leaving window
    document.addEventListener('mouseleave', () => {
      ring.classList.add('is-hidden'); dot.classList.add('is-hidden');
    });
    document.addEventListener('mouseenter', () => {
      ring.classList.remove('is-hidden'); dot.classList.remove('is-hidden');
    });
  } else {
    // Non-desktop: hide cursor elements safely
    if (ring) ring.style.display = 'none';
    if (dot)  dot.style.display  = 'none';
  }

  // ── Scroll-driven section reveals ────────────────────────────────────
  const revealEls = document.querySelectorAll(
    '.curiosity-shop__inner, .milanote-section__inner, .daily-spark-section, ' +
    '.word-reflection-section, .section-card, .app-section > *'
  );

  if (revealEls.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });

    revealEls.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${Math.min(i * 0.05, 0.2)}s`;
      io.observe(el);
    });
  }

  // ── Magnetic buttons (subtle pull toward cursor) ───────────────────────
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.btn-enter, .btn-primary').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width  / 2)) * 0.18;
        const dy = (e.clientY - (r.top  + r.height / 2)) * 0.18;
        btn.style.transform = `translate(${dx}px, ${dy}px) translateY(-2px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

})();
