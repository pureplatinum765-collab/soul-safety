/* ambient.js — Weather canvas + wobbly cat mascot */
(function () {
  'use strict';

  // ── WEATHER CANVAS ──────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'ss-ambient';
  Object.assign(canvas.style, {
    position:'fixed', top:'0', left:'0', width:'100%', height:'100%',
    pointerEvents:'none', zIndex:'0',
  });
  // Append early but defer to DOMContentLoaded to be safe
  if (document.body) {
    document.body.appendChild(canvas);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(canvas));
  }
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);

  const TYPES = ['clear','drizzle','rain','leaves','fireflies'];
  const ICONS = { clear:'☀️', drizzle:'🌦️', rain:'🌧️', leaves:'🍂', fireflies:'✨' };
  let current = 'clear', target = 'clear', blend = 1;
  let timer = 0, nextChange = 100 + Math.random() * 120;

  let drops = [], flies = [], lvs = [];

  function mkDrop(type) {
    return {
      x: Math.random() * W, y: -12 - Math.random() * H * 0.35,
      len: type === 'rain' ? 14 + Math.random() * 18 : 7 + Math.random() * 10,
      speed: type === 'rain' ? 6 + Math.random() * 9 : 2.5 + Math.random() * 4,
      alpha: type === 'rain' ? 0.1 + Math.random() * 0.2 : 0.06 + Math.random() * 0.12,
    };
  }
  function mkFly() {
    return {
      x: Math.random() * W, y: H * 0.2 + Math.random() * H * 0.65,
      phase: Math.random() * Math.PI * 2, speed: 0.011 + Math.random() * 0.02,
      vx: (Math.random()-0.5)*0.45, vy: (Math.random()-0.5)*0.3, r: 1.4+Math.random()*1.4,
    };
  }
  function mkLeaf() {
    const fromLeft = Math.random() > 0.5;
    return {
      x: fromLeft ? -30 : W+30, y: H*0.1 + Math.random()*H*0.72,
      vx: (fromLeft?1:-1)*(0.3+Math.random()*1.3), vy: (Math.random()-0.5)*0.55,
      rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.038,
      wobble: Math.random()*Math.PI*2, wobbleA: 0.018 + Math.random()*0.016,
      size: 5+Math.random()*9, alpha: 0.28+Math.random()*0.38,
      hue: [105,28,38,46,112][Math.floor(Math.random()*5)],
    };
  }

  let lastNow = 0, frameN = 0;
  let weatherBtn;

  function tick(now) {
    const dt = Math.min((now - lastNow) / 16.67, 3);
    lastNow = now; frameN++;
    timer += dt / 60;
    if (timer > nextChange) {
      timer = 0; nextChange = 90 + Math.random() * 160;
      const opts = TYPES.filter(t => t !== current);
      target = opts[Math.floor(Math.random() * opts.length)];
      if (weatherBtn) weatherBtn.textContent = ICONS[target];
    }
    if (target !== current) {
      blend = Math.max(0, blend - dt * 0.016);
      if (blend <= 0) { current = target; blend = 0; }
    } else {
      blend = Math.min(1, blend + dt * 0.016);
    }
    const I = blend;
    ctx.clearRect(0, 0, W, H);

    // Rain / Drizzle
    if (current === 'rain' || current === 'drizzle') {
      const max = current === 'rain' ? 115 : 40;
      while (drops.length < Math.floor(max * I)) drops.push(mkDrop(current));
      for (let i = drops.length-1; i >= 0; i--) {
        const d = drops[i];
        d.y += d.speed * dt; d.x += d.speed * 0.11 * dt;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len*0.11, d.y - d.len);
        ctx.strokeStyle = `rgba(152,192,228,${d.alpha})`; ctx.lineWidth = current==='drizzle'?0.65:1.1; ctx.stroke();
        if (d.y > H+35) drops.splice(i,1);
      }
    } else drops.length = 0;

    // Fireflies
    if (current === 'fireflies') {
      while (flies.length < Math.floor(22*I)) flies.push(mkFly());
      for (const f of flies) {
        f.phase += f.speed; f.x += f.vx + Math.sin(f.phase*0.65)*0.28; f.y += f.vy + Math.cos(f.phase*0.48)*0.22;
        if (f.x < -20) f.x = W+20; if (f.x > W+20) f.x = -20;
        if (f.y < 0) f.y = H; if (f.y > H) f.y = 0;
        const g = (Math.sin(f.phase)+1)/2;
        const a = g * 0.8 * I;
        const grd = ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,13);
        grd.addColorStop(0,`rgba(188,255,88,${a})`); grd.addColorStop(0.45,`rgba(158,240,68,${a*0.32})`); grd.addColorStop(1,'transparent');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(f.x,f.y,13,0,Math.PI*2); ctx.fill();
      }
    } else flies.length = 0;

    // Leaves
    if (current === 'leaves') {
      if (frameN % 115 === 0 && lvs.length < 13) lvs.push(mkLeaf());
      for (let i = lvs.length-1; i >= 0; i--) {
        const l = lvs[i];
        l.wobble += l.wobbleA; l.x += l.vx; l.y += l.vy + Math.sin(l.wobble)*0.5; l.rot += l.rotV;
        ctx.save(); ctx.globalAlpha = l.alpha * I;
        ctx.translate(l.x, l.y + Math.sin(l.wobble)*7); ctx.rotate(l.rot);
        ctx.fillStyle = `hsl(${l.hue},40%,38%)`;
        ctx.beginPath(); ctx.ellipse(0,0,l.size*0.32,l.size,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
        if (l.x < -65 || l.x > W+65) lvs.splice(i,1);
      }
    } else lvs.length = 0;

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(t => { lastNow = t; requestAnimationFrame(tick); });

  // ── CAT MASCOT ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Remove old mascot if present
    const old = document.getElementById('mascotWidget');
    if (old) old.remove();

    // Weather button styles
    const catStyle = document.createElement('style');
    catStyle.textContent = `
      #ss-weather-btn {
        position:fixed; bottom:5.5rem; right:1rem; width:38px; height:38px;
        border-radius:50%; background:rgba(250,246,239,0.9); backdrop-filter:blur(10px);
        -webkit-backdrop-filter:blur(10px);
        border:1px solid rgba(61,36,22,0.14); cursor:pointer; z-index:100;
        font-size:1rem; box-shadow:0 2px 8px rgba(0,0,0,0.09);
        transition:transform 0.2s ease, box-shadow 0.2s;
        display:flex; align-items:center; justify-content:center;
      }
      #ss-weather-btn:hover { transform:scale(1.12); box-shadow:0 4px 14px rgba(0,0,0,0.13); }

      #ss-cat {
        position:fixed; bottom:0.8rem; left:1.4rem; z-index:200;
        cursor:pointer; user-select:none;
      }
      #ss-cat svg {
        width:64px; height:72px; overflow:visible;
        filter:drop-shadow(0 4px 8px rgba(61,36,22,0.16));
        display:block;
      }
      .ss-cat-body { animation:catBob 2.7s ease-in-out infinite; transform-origin:50% 92%; }
      @keyframes catBob {
        0%,100% { transform:translateY(0) rotate(-1.8deg); }
        50% { transform:translateY(-6px) rotate(1.8deg); }
      }
      .ss-cat-tail { animation:catTailSway 2.1s ease-in-out infinite; transform-origin:47px 52px; }
      @keyframes catTailSway {
        0%,100% { transform:rotate(0deg); }
        50% { transform:rotate(20deg); }
      }
      #ss-cat.cat-happy .ss-cat-body { animation:catWiggle 0.32s ease infinite alternate; }
      @keyframes catWiggle {
        from { transform:rotate(-7deg) scale(1); }
        to { transform:rotate(7deg) scale(1.07); }
      }
      .ss-cat-bubble {
        position:absolute; bottom:74px; left:-4px;
        background:rgba(250,246,239,0.97); backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        border:1px solid rgba(61,36,22,0.13); border-radius:12px 12px 12px 4px;
        padding:0.42rem 0.72rem; font-family:'General Sans',sans-serif;
        font-size:0.78rem; color:#3d2416; white-space:nowrap; max-width:200px;
        white-space:normal; line-height:1.4;
        box-shadow:0 4px 14px rgba(0,0,0,0.09);
        opacity:0; transform:translateY(6px) scale(0.9);
        transition:all 0.28s cubic-bezier(0.16,1,0.3,1); pointer-events:none;
      }
      .ss-cat-bubble.show { opacity:1; transform:translateY(0) scale(1); }
      .ss-float-emoji {
        position:absolute; font-size:1.1rem; pointer-events:none;
        animation:ssFloatUp 1.5s ease forwards; z-index:201;
      }
      @keyframes ssFloatUp {
        0% { opacity:1; transform:translateY(0) scale(1); }
        100% { opacity:0; transform:translateY(-58px) scale(0.5); }
      }
    `;
    document.head.appendChild(catStyle);

    // Weather toggle button
    weatherBtn = document.createElement('button');
    weatherBtn.id = 'ss-weather-btn';
    weatherBtn.setAttribute('aria-label', 'Change weather effect');
    weatherBtn.title = 'Change weather';
    weatherBtn.textContent = ICONS[current];
    document.body.appendChild(weatherBtn);
    weatherBtn.addEventListener('click', () => {
      const idx = TYPES.indexOf(current !== target ? target : current);
      target = TYPES[(idx + 1) % TYPES.length];
      weatherBtn.textContent = ICONS[target];
    });
    setInterval(() => { if (weatherBtn) weatherBtn.textContent = ICONS[current !== target ? target : current]; }, 600);

    // Cat
    const catEl = document.createElement('div');
    catEl.id = 'ss-cat';
    catEl.setAttribute('role', 'button');
    catEl.setAttribute('aria-label', 'Pet the cat');
    catEl.innerHTML = `
      <div class="ss-cat-bubble" id="ss-cat-bubble"></div>
      <svg viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Tail (behind body) -->
        <path class="ss-cat-tail" d="M 47 54 Q 61 46 58 34 Q 56 24 51 27" stroke="#c4845a" stroke-width="5.5" fill="none" stroke-linecap="round"/>
        <!-- Body + head group -->
        <g class="ss-cat-body">
          <ellipse cx="32" cy="48" rx="17.5" ry="14.5" fill="#d49870"/>
          <ellipse cx="32" cy="50" rx="9.5" ry="8" fill="#eac4a4" opacity="0.52"/>
          <ellipse cx="32" cy="25" rx="13.5" ry="13" fill="#d49870"/>
          <!-- Ears -->
          <polygon points="20,17 13,4 25,14" fill="#c4845a"/>
          <polygon points="20.5,16 16,7 24,14" fill="#f0b4a4" opacity="0.6"/>
          <polygon points="44,17 51,4 39,14" fill="#c4845a"/>
          <polygon points="43.5,16 48,7 40,14" fill="#f0b4a4" opacity="0.6"/>
          <!-- Eyes -->
          <ellipse cx="26.5" cy="24" rx="3" ry="3.6" fill="#1c1008"/>
          <ellipse cx="37.5" cy="24" rx="3" ry="3.6" fill="#1c1008"/>
          <circle cx="28" cy="22.4" r="1.1" fill="white"/>
          <circle cx="39" cy="22.4" r="1.1" fill="white"/>
          <!-- Nose -->
          <path d="M30.5 29 Q32 31 33.5 29" fill="#ce6050" stroke="none"/>
          <!-- Mouth -->
          <path d="M29 30.5 Q32 34 35 30.5" stroke="#a04840" stroke-width="1.1" fill="none" stroke-linecap="round"/>
          <!-- Cheek blush -->
          <ellipse cx="22" cy="28" rx="3" ry="2" fill="#e8a090" opacity="0.32"/>
          <ellipse cx="42" cy="28" rx="3" ry="2" fill="#e8a090" opacity="0.32"/>
          <!-- Whiskers L -->
          <line x1="17" y1="27.5" x2="27" y2="29" stroke="#a87060" stroke-width="0.8" opacity="0.5"/>
          <line x1="17" y1="30.5" x2="27" y2="30.5" stroke="#a87060" stroke-width="0.8" opacity="0.5"/>
          <!-- Whiskers R -->
          <line x1="47" y1="27.5" x2="37" y2="29" stroke="#a87060" stroke-width="0.8" opacity="0.5"/>
          <line x1="47" y1="30.5" x2="37" y2="30.5" stroke="#a87060" stroke-width="0.8" opacity="0.5"/>
          <!-- Paws -->
          <ellipse cx="21" cy="60" rx="5.5" ry="3.5" fill="#c48060"/>
          <ellipse cx="43" cy="60" rx="5.5" ry="3.5" fill="#c48060"/>
          <!-- Toe beans -->
          <ellipse cx="19" cy="61.5" rx="1.6" ry="1.1" fill="#b07050" opacity="0.65"/>
          <ellipse cx="21.5" cy="62.5" rx="1.6" ry="1.1" fill="#b07050" opacity="0.65"/>
          <ellipse cx="24" cy="61.5" rx="1.6" ry="1.1" fill="#b07050" opacity="0.65"/>
          <ellipse cx="41" cy="61.5" rx="1.6" ry="1.1" fill="#b07050" opacity="0.65"/>
          <ellipse cx="43.5" cy="62.5" rx="1.6" ry="1.1" fill="#b07050" opacity="0.65"/>
          <ellipse cx="46" cy="61.5" rx="1.6" ry="1.1" fill="#b07050" opacity="0.65"/>
        </g>
      </svg>
    `;
    document.body.appendChild(catEl);

    const bubble = document.getElementById('ss-cat-bubble');
    let bTimer = null, pets = 0;
    const MSGS = [
      'mrrrow 🐾','pets pls?','you\'re doing great ✨','softly purring...','*happy blep*',
      'soul friends 💛','zzzz... oh hi!','biscuits for you 🍪','*wobbly wiggle*',
      'stay cozy 🌿','mew mew mew~','are you okay? 🌸','head bonk 🐾',
      'you smell like home','*kneads invisible bread*',
    ];

    function showBubble(msg) {
      bubble.textContent = msg;
      bubble.classList.add('show');
      clearTimeout(bTimer);
      bTimer = setTimeout(() => bubble.classList.remove('show'), 2800);
    }

    catEl.addEventListener('click', () => {
      pets++;
      catEl.classList.add('cat-happy');
      setTimeout(() => catEl.classList.remove('cat-happy'), 1100);
      const pool = pets > 6 ? ['💫','⭐','🌟','✨'] : ['💛','💕','✨','🌿','🍃','🐾'];
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const h = document.createElement('div');
          h.className = 'ss-float-emoji';
          h.textContent = pool[Math.floor(Math.random() * pool.length)];
          h.style.left = (6 + Math.random() * 50) + 'px';
          h.style.bottom = (68 + Math.random() * 14) + 'px';
          catEl.appendChild(h);
          setTimeout(() => h.remove(), 1600);
        }, i * 160);
      }
      const secret = pets >= 8
        ? ['you found the secret! 🌟','infinite love unlocked 💛','true soul friend 🐾'][Math.floor(Math.random()*3)]
        : null;
      showBubble(secret || MSGS[Math.floor(Math.random() * MSGS.length)]);
    });

    // Wander
    function wander() {
      const vw = window.innerWidth;
      const max = Math.min(vw * 0.5, 380);
      const newL = 20 + Math.random() * Math.max(40, max - 70);
      catEl.style.transition = 'left 5.5s cubic-bezier(0.45,0,0.55,1)';
      catEl.style.left = newL + 'px';
      if (Math.random() > 0.5) setTimeout(() => showBubble(MSGS[Math.floor(Math.random()*MSGS.length)]), 2000);
      setTimeout(wander, 18000 + Math.random() * 22000);
    }
    setTimeout(wander, 14000);
    setTimeout(() => showBubble('hello there 🐾 click me!'), 4200);
  });

  // Public API
  window.ssWeather = {
    set(w) { if (TYPES.includes(w)) target = w; },
    cycle() {
      const idx = TYPES.indexOf(current !== target ? target : current);
      target = TYPES[(idx + 1) % TYPES.length];
    },
  };
})();
