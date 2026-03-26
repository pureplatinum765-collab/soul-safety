/* intro.js — Blooming lotus entrance animation */
(function () {
  'use strict';
  if (sessionStorage.getItem('ss-intro-seen')) return;

  const style = document.createElement('style');
  style.textContent = `
    #ss-intro {
      position:fixed; inset:0; z-index:10000;
      background:#f5f0e8; pointer-events:all;
    }
    #ss-intro canvas { position:absolute; inset:0; width:100%; height:100%; }
    #ss-intro-text {
      position:absolute; top:50%; left:50%;
      transform:translate(-50%,-50%);
      text-align:center; opacity:0;
      transition:opacity 1.4s ease; pointer-events:none; z-index:1;
    }
    #ss-intro-text.vis { opacity:1; }
    #ss-intro-text h1 {
      font-family:'Sentient',Georgia,serif;
      font-size:clamp(2rem,6vw,4.5rem);
      color:#3d2416; letter-spacing:0.05em;
      margin:0 0 0.35em; font-weight:500;
    }
    #ss-intro-text p {
      font-family:'General Sans',sans-serif;
      font-size:clamp(0.8rem,2vw,1.05rem);
      color:#7a5a40; letter-spacing:0.16em;
      text-transform:uppercase; margin:0; font-weight:400;
    }
    #ss-intro-skip {
      position:absolute; bottom:1.5rem; right:1.5rem;
      background:none; border:1px solid rgba(61,36,22,0.22);
      border-radius:999px; padding:0.35rem 0.9rem;
      font-family:'General Sans',sans-serif;
      font-size:0.75rem; color:rgba(61,36,22,0.38);
      cursor:pointer; z-index:2; transition:all 0.2s;
    }
    #ss-intro-skip:hover { color:rgba(61,36,22,0.65); border-color:rgba(61,36,22,0.4); }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'ss-intro';
  el.innerHTML = `
    <canvas id="ss-intro-canvas"></canvas>
    <div id="ss-intro-text"><h1>Soul Safety</h1><p>Peace is here if you need it</p></div>
    <button id="ss-intro-skip">skip →</button>
  `;
  document.body.insertBefore(el, document.body.firstChild);

  const canvas = document.getElementById('ss-intro-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy;

  function resize() {
    W = canvas.width = el.offsetWidth || window.innerWidth;
    H = canvas.height = el.offsetHeight || window.innerHeight;
    cx = W / 2; cy = H / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  const BLOOM_MS = 2500, HOLD_MS = 1800, EXIT_MS = 950;
  const TOTAL_MS = BLOOM_MS + HOLD_MS + EXIT_MS;
  const t0 = performance.now();
  let done = false;

  const textEl = document.getElementById('ss-intro-text');
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  const PETAL_N = 8, SEPAL_N = 5;

  function drawFlower(bloomT, exitT) {
    const maxR = Math.min(W, H) * 0.27;

    // Outer sepals (sage green, slightly behind)
    for (let i = 0; i < SEPAL_N; i++) {
      const stagger = (i / SEPAL_N) * 0.25 + 0.05;
      const t = ease(Math.max(0, Math.min((bloomT - stagger) / (1 - stagger), 1)));
      if (t <= 0) continue;
      const angle = (i / SEPAL_N) * Math.PI * 2 + (Math.PI / SEPAL_N);
      const r = maxR * 0.68 * t * (1 + exitT * 2.8);
      const w = r * 0.26 * t;
      ctx.save();
      ctx.globalAlpha = t * 0.7 * (1 - exitT * exitT);
      ctx.translate(cx, cy); ctx.rotate(angle);
      ctx.fillStyle = 'hsl(100,38%,46%)';
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.bezierCurveTo(-w, r*0.25, -w*0.5, r*0.75, 0, r);
      ctx.bezierCurveTo(w*0.5, r*0.75, w, r*0.25, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    // Main petals (terracotta to amber gradient)
    for (let i = 0; i < PETAL_N; i++) {
      const stagger = (i / PETAL_N) * 0.52 + 0.12;
      const t = ease(Math.max(0, Math.min((bloomT - stagger) / (1 - stagger), 1)));
      if (t <= 0) continue;
      const angle = (i / PETAL_N) * Math.PI * 2 - Math.PI / 2;
      const r = maxR * t * (1 + exitT * 3.2);
      const w = r * (0.28 + t * 0.18);
      const alpha = t * 0.88 * Math.max(0, 1 - exitT * exitT * 1.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy); ctx.rotate(angle);
      const hue = 14 + (i / PETAL_N) * 14;
      const grad = ctx.createLinearGradient(0, 0, 0, r);
      grad.addColorStop(0, `hsla(${hue},70%,46%,1)`);
      grad.addColorStop(0.4, `hsla(${hue+10},64%,60%,0.9)`);
      grad.addColorStop(1, `hsla(${hue+22},58%,82%,0.1)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.bezierCurveTo(-w*0.55, r*0.22, -w, r*0.62, 0, r);
      ctx.bezierCurveTo(w, r*0.62, w*0.55, r*0.22, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    // Center glow
    const ca = ease(bloomT) * Math.max(0, 1 - exitT * 1.6);
    if (ca > 0) {
      const rb = 22 + exitT * 40;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rb * 3);
      grd.addColorStop(0, `rgba(255,238,190,${ca})`);
      grd.addColorStop(0.3, `rgba(214,138,60,${ca * 0.6})`);
      grd.addColorStop(0.65, `rgba(194,98,58,${ca * 0.28})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, rb * 3, 0, Math.PI * 2); ctx.fill();
      // Solid inner dot
      ctx.beginPath(); ctx.arc(cx, cy, rb * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,238,190,${ca * 0.85})`; ctx.fill();
    }
  }

  let raf;
  function frame(now) {
    if (done) return;
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    // Background fades out during exit
    const bgA = t > BLOOM_MS + HOLD_MS ? Math.max(0, 1 - (t - BLOOM_MS - HOLD_MS) / EXIT_MS) : 1;
    ctx.fillStyle = `rgba(245,240,232,${bgA})`;
    ctx.fillRect(0, 0, W, H);
    const bloomT = Math.min(t / BLOOM_MS, 1);
    const exitT = t > BLOOM_MS + HOLD_MS ? Math.min((t - BLOOM_MS - HOLD_MS) / EXIT_MS, 1) : 0;
    drawFlower(bloomT, ease(exitT));
    // Text
    if (bloomT > 0.72 && exitT === 0) textEl.classList.add('vis');
    if (exitT > 0.18) textEl.style.opacity = String(Math.max(0, 1 - (exitT - 0.18) / 0.45));
    // Overlay
    if (exitT > 0) el.style.opacity = String(Math.max(0, 1 - exitT));
    if (t >= TOTAL_MS) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (done) return;
    done = true;
    sessionStorage.setItem('ss-intro-seen', '1');
    cancelAnimationFrame(raf);
    el.remove();
  }

  document.getElementById('ss-intro-skip').addEventListener('click', finish);
  raf = requestAnimationFrame(frame);
})();
