(function () {
  'use strict';

  /* =========================================================
     THE WANDERING PATH — Soul Safety Board Game
     Canvas-based winding path through biomes:
       Meadow (0–4) → Forest (5–9) → Mountain (10–14) → Starfield (15–19)
  ========================================================= */

  const GAME_API = window.GAME_API || '';
  const BOARD_SIZE = 20;

  /* ── Palette ─────────────────────────────────────────── */
  const COLORS = {
    terracotta: '#c2623a',
    sage:       '#6b8e5f',
    amber:      '#daa520',
    cream:      '#faf6ef',
    darkBrown:  '#3d2416',
    // Biomes
    meadow:  { bg: '#c8e6a0', mid: '#a8d080', path: '#8fba68' },
    forest:  { bg: '#5a7d4a', mid: '#3d6030', path: '#2d4e22' },
    mountain:{ bg: '#b0bec5', mid: '#90a4ae', path: '#78909c' },
    star:    { bg: '#1a1040', mid: '#2e1a6e', path: '#4b3490' },
  };

  /* ── Special spaces ──────────────────────────────────── */
  const SPECIAL = {
    5:  { type: 'bonus',  label: '⭐', desc: '+2 Forward',  color: '#ffd700', glow: 'rgba(255,215,0,0.6)' },
    9:  { type: 'hazard', label: '🌀', desc: 'Slip back 2', color: '#9c27b0', glow: 'rgba(156,39,176,0.5)' },
    10: { type: 'rest',   label: '☕', desc: 'Rest stop',   color: '#ff8a65', glow: 'rgba(255,138,101,0.5)' },
    15: { type: 'bonus',  label: '⭐', desc: '+2 Forward',  color: '#ffd700', glow: 'rgba(255,215,0,0.6)' },
    17: { type: 'hazard', label: '🌀', desc: 'Slip back 2', color: '#7b1fa2', glow: 'rgba(123,31,162,0.5)' },
    19: { type: 'finish', label: '🏁', desc: 'Enlightenment!', color: '#ff6b9d', glow: 'rgba(255,107,157,0.7)' },
  };

  /* ── Narrative texts ─────────────────────────────────── */
  const NARRATIVES = {
    raphael: {
      meadow:   ['Raphael wandered through sun-dappled meadows...', 'A butterfly landed on Raphael\'s shoulder.', 'Raphael picked a wildflower along the way.', 'The golden meadow stretched wide before Raphael.', 'Raphael hummed softly as the grass swayed.'],
      forest:   ['Raphael stepped under the ancient canopy.', 'Sunlight flickered through the forest leaves.', 'Raphael found a glowing mushroom ring!', 'The forest whispered old secrets.', 'Raphael traced moss on a weathered oak.'],
      mountain: ['Raphael climbed toward the misty peaks.', 'Cold wind swept across the rocky ridge.', 'Raphael paused to admire the view below.', 'Snow dusted the stones at Raphael\'s feet.', 'The mountain air was impossibly clear.'],
      star:     ['Raphael floated into the starfield...', 'Nebulae swirled in violet hues around Raphael.', 'A shooting star streaked past!', 'Raphael felt weightless among the cosmos.', 'The universe hummed with quiet wonder.'],
      bonus:    ['🌟 A golden light surrounded Raphael! +2 spaces!', '✨ Raphael found a sunflower shrine — blessed forward!'],
      hazard:   ['🌀 Raphael got tangled in a time eddy! Slipped back...', '💨 A mischievous wind swept Raphael backward!'],
      rest:     ['☕ Raphael settled by the campfire for a warm rest.', '🔥 A cozy rest stop — Raphael brewed something lovely.'],
      win:      ['🌻 Raphael reached enlightenment! The sunflower blooms eternal!'],
    },
    taylor: {
      meadow:   ['Taylor skipped through the bright green meadow.', 'A monarch butterfly danced ahead of Taylor.', 'Taylor braided clover as they walked.', 'The meadow smelled of rain and clover.', 'Taylor felt the soft earth beneath every step.'],
      forest:   ['Taylor disappeared into the verdant forest.', 'Ancient trees towered around Taylor.', 'Taylor spotted a hidden fairy door!', 'The forest floor was soft with fallen leaves.', 'Taylor traced lichen patterns on the bark.'],
      mountain: ['Taylor scaled the craggy mountain path.', 'Pebbles skittered as Taylor climbed higher.', 'Taylor found an eagle\'s feather on the ledge.', 'Snow crunched softly underfoot.', 'The summit clouds felt close enough to touch.'],
      star:     ['Taylor drifted through the cosmic starfield...', 'Stars spiraled into shapes around Taylor.', 'A meteor shower painted the dark!', 'Taylor felt infinity pressing gently close.', 'The starfield hummed an ancient song.'],
      bonus:    ['🌿 A sacred grove bestowed its gift on Taylor! +2 spaces!', '✨ Taylor uncovered a hidden shortcut through the leaves!'],
      hazard:   ['🌀 Taylor stepped into a swirling anomaly! Back they go...', '💫 The forest floor shifted — Taylor slipped back!'],
      rest:     ['☕ Taylor found the hearthstone clearing — time to rest.', '🌙 Taylor curled up by the ember light.'],
      win:      ['🌿 Taylor reached the cosmic clearing — enlightenment achieved!'],
    },
  };

  function getNarrative(userId, biome, eventType) {
    const n = NARRATIVES[userId] || NARRATIVES.raphael;
    if (eventType === 'win') return n.win[0];
    if (eventType === 'bonus') return n.bonus[Math.floor(Math.random() * n.bonus.length)];
    if (eventType === 'hazard') return n.hazard[Math.floor(Math.random() * n.hazard.length)];
    if (eventType === 'rest') return n.rest[Math.floor(Math.random() * n.rest.length)];
    const arr = n[biome] || n.meadow;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getBiome(pos) {
    if (pos <= 4)  return 'meadow';
    if (pos <= 9)  return 'forest';
    if (pos <= 14) return 'mountain';
    return 'star';
  }

  /* ── Auth ────────────────────────────────────────────── */
  function gameHeaders(extra = {}) {
    const token = window.authToken || window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken') || '';
    return token ? { ...extra, Authorization: 'Bearer ' + token } : extra;
  }

  async function gameGet(path) {
    const response = await fetch(GAME_API + path, { headers: gameHeaders(), credentials: 'include' });
    if (!response.ok) throw new Error('Game API error: ' + response.status);
    return response.json();
  }

  async function gamePost(path, body) {
    const response = await fetch(GAME_API + path, {
      method: 'POST',
      headers: gameHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(body)
    });
    return response.json();
  }

  function getCurrentUser() {
    return window.currentUser || document.querySelector('.user-option.active')?.dataset.user || 'raphael';
  }

  /* =========================================================
     PATH GENERATION
  ========================================================= */
  function generatePath(width, height) {
    const nodes = [];
    const padding = 44;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;

    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const x = padding + t * usableW;
      const y = (height - padding) - t * usableH + Math.sin(t * Math.PI * 3) * (usableH * 0.18);
      nodes.push({ x, y, index: i });
    }
    return nodes;
  }

  /* =========================================================
     CANVAS RENDERER
  ========================================================= */
  let canvas, ctx;
  let nodes = [];
  let canvasW = 0, canvasH = 0;

  /* Player visual state — separate from API state */
  const playerState = {
    raphael: { displayPos: 0, targetPos: 0, animT: 1, x: 0, y: 0, angle: 0 },
    taylor:  { displayPos: 0, targetPos: 0, animT: 1, x: 0, y: 0, angle: 0 },
  };

  /* Particle pool */
  const particles = [];

  function spawnParticles(x, y, type) {
    const configs = {
      bonus:  { colors: ['#ffd700', '#ffec6e', '#fff176', '#ffc107'], count: 28, speed: 160, gravity: 280 },
      hazard: { colors: ['#ce93d8', '#9c27b0', '#7b1fa2', '#ab47bc'], count: 22, speed: 120, gravity: 220 },
      rest:   { colors: ['#ff8a65', '#ffb74d', '#ffe082', '#fff9c4'], count: 18, speed: 90, gravity: 180 },
      win:    { colors: ['#c2623a', '#daa520', '#6b8e5f', '#ffd700', '#ff6b9d', '#a5d6a7'], count: 60, speed: 220, gravity: 320 },
      move:   { colors: ['#faf6ef', '#daa520', '#c2623a'], count: 8, speed: 60, gravity: 200 },
    };
    const cfg = configs[type] || configs.move;
    for (let i = 0; i < cfg.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cfg.speed * (0.4 + Math.random() * 0.6);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - cfg.speed * 0.3,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 0,
        color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
        size: 3 + Math.random() * 4,
        gravity: cfg.gravity,
        active: true,
      });
      particles[particles.length - 1].maxLife = particles[particles.length - 1].life;
    }
    // Keep pool manageable
    while (particles.length > 300) particles.shift();
  }

  function updateParticles(dt) {
    for (const p of particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.98;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const sz = p.size * alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ── Draw biome backgrounds ──────────────────────────── */
  function drawBiomeBackground() {
    if (!nodes.length) return;

    // Biome gradient strip: 4 zones from bottom-left to top-right
    const zones = [
      { start: 0, end: 4,  ...COLORS.meadow },
      { start: 5, end: 9,  ...COLORS.forest },
      { start: 10, end: 14, ...COLORS.mountain },
      { start: 15, end: 19, ...COLORS.star },
    ];

    for (const zone of zones) {
      const startNode = nodes[zone.start];
      const endNode   = nodes[zone.end];
      if (!startNode || !endNode) continue;

      // Blended background zone around those nodes
      const gradient = ctx.createLinearGradient(startNode.x, startNode.y, endNode.x, endNode.y);
      gradient.addColorStop(0, zone.bg + 'cc');
      gradient.addColorStop(1, zone.mid + '99');

      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = gradient;

      // Draw a wide rounded band
      const margin = canvasH * 0.28;
      ctx.beginPath();
      ctx.moveTo(startNode.x - margin, canvasH);
      ctx.lineTo(endNode.x + margin, canvasH);
      ctx.lineTo(endNode.x + margin, 0);
      ctx.lineTo(startNode.x - margin, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Decorative biome elements
    drawMeadowElements();
    drawForestElements();
    drawMountainElements();
    drawStarElements();
  }

  function drawMeadowElements() {
    if (!nodes[0] || !nodes[4]) return;
    const xs = nodes[0].x, xe = nodes[4].x;
    ctx.save();
    ctx.globalAlpha = 0.35;

    // Flower dots scattered in meadow zone
    const flowers = [
      { x: xs + 15, y: canvasH * 0.82 }, { x: xs + 35, y: canvasH * 0.68 },
      { x: xs + 60, y: canvasH * 0.90 }, { x: xs + 80, y: canvasH * 0.72 },
      { x: (xs + xe) / 2, y: canvasH * 0.85 }, { x: xs + 20, y: canvasH * 0.55 },
      { x: xe - 20, y: canvasH * 0.78 },
    ];
    for (const f of flowers) {
      // Petals
      ctx.fillStyle = '#ffb3ba';
      for (let a = 0; a < 5; a++) {
        const angle = (a / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(angle) * 5, f.y + Math.sin(angle) * 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gentle rolling ground
    ctx.fillStyle = '#8fba68';
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.moveTo(xs - 20, canvasH);
    ctx.quadraticCurveTo(xs + 40, canvasH * 0.88, xe + 10, canvasH);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawForestElements() {
    if (!nodes[5] || !nodes[9]) return;
    const xs = nodes[5].x, xe = nodes[9].x;
    ctx.save();
    ctx.globalAlpha = 0.32;

    // Triangle trees
    const trees = [
      { x: xs + 10, y: canvasH * 0.75 }, { x: xs + 30, y: canvasH * 0.62 },
      { x: xs + 55, y: canvasH * 0.80 }, { x: (xs + xe) / 2, y: canvasH * 0.70 },
      { x: xe - 25, y: canvasH * 0.65 }, { x: xe, y: canvasH * 0.78 },
    ];
    for (const t of trees) {
      const h = 22 + Math.random() * 12;
      const w = 12 + Math.random() * 6;
      ctx.fillStyle = '#2d5a1b';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - h);
      ctx.lineTo(t.x - w, t.y);
      ctx.lineTo(t.x + w, t.y);
      ctx.closePath();
      ctx.fill();

      // Second layer
      ctx.fillStyle = '#3d7a2a';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - h * 0.6);
      ctx.lineTo(t.x - w * 0.7, t.y + h * 0.15);
      ctx.lineTo(t.x + w * 0.7, t.y + h * 0.15);
      ctx.closePath();
      ctx.fill();
    }

    // Mushroom dots
    ctx.fillStyle = '#e53935';
    ctx.globalAlpha = 0.25;
    const shrooms = [{ x: xs + 22, y: canvasH * 0.82 }, { x: xe - 15, y: canvasH * 0.71 }];
    for (const s of shrooms) {
      ctx.beginPath();
      ctx.arc(s.x, s.y - 7, 7, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(s.x - 3, s.y - 7, 6, 9);
      ctx.fillStyle = '#e53935';
    }

    ctx.restore();
  }

  function drawMountainElements() {
    if (!nodes[10] || !nodes[14]) return;
    const xs = nodes[10].x, xe = nodes[14].x;
    ctx.save();
    ctx.globalAlpha = 0.28;

    // Rocky peaks
    const peaks = [
      { x: xs + 5, h: 55 }, { x: xs + 30, h: 70 }, { x: (xs + xe) / 2, h: 80 },
      { x: xe - 20, h: 65 }, { x: xe + 5, h: 50 },
    ];
    for (const p of peaks) {
      ctx.fillStyle = '#78909c';
      ctx.beginPath();
      ctx.moveTo(p.x, canvasH * 0.5 - p.h);
      ctx.lineTo(p.x - p.h * 0.5, canvasH * 0.5);
      ctx.lineTo(p.x + p.h * 0.5, canvasH * 0.5);
      ctx.closePath();
      ctx.fill();

      // Snow cap
      ctx.fillStyle = '#eceff1';
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(p.x, canvasH * 0.5 - p.h);
      ctx.lineTo(p.x - p.h * 0.18, canvasH * 0.5 - p.h * 0.65);
      ctx.lineTo(p.x + p.h * 0.18, canvasH * 0.5 - p.h * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.28;
    }

    // Drifting cloud
    ctx.fillStyle = '#cfd8dc';
    ctx.globalAlpha = 0.3;
    const cx = (xs + xe) / 2 - 20;
    const cy = canvasH * 0.22;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.arc(cx + 16, cy - 4, 10, 0, Math.PI * 2);
    ctx.arc(cx + 28, cy, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawStarElements() {
    if (!nodes[15] || !nodes[19]) return;
    const xs = nodes[15].x, xe = nodes[19].x;
    ctx.save();

    // Star dots
    ctx.fillStyle = '#ffffff';
    const starSeeds = [
      { x: xs + 8, y: canvasH * 0.15, r: 1.5 }, { x: xs + 22, y: canvasH * 0.40, r: 1 },
      { x: xs + 38, y: canvasH * 0.25, r: 2 }, { x: (xs + xe) / 2, y: canvasH * 0.18, r: 1.5 },
      { x: xe - 30, y: canvasH * 0.35, r: 1 }, { x: xe - 10, y: canvasH * 0.22, r: 2 },
      { x: xs + 50, y: canvasH * 0.50, r: 1 }, { x: xe - 45, y: canvasH * 0.12, r: 1.5 },
      { x: xs + 5, y: canvasH * 0.60, r: 1 }, { x: (xs + xe) / 2 + 10, y: canvasH * 0.45, r: 1.2 },
    ];
    const now = Date.now() / 1000;
    for (const s of starSeeds) {
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(now * 1.5 + s.x));
      ctx.globalAlpha = twinkle * 0.85;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nebula wisps
    ctx.globalAlpha = 0.12;
    const nebGrad = ctx.createRadialGradient(xe - 20, canvasH * 0.3, 5, xe - 20, canvasH * 0.3, 40);
    nebGrad.addColorStop(0, '#ce93d8');
    nebGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = nebGrad;
    ctx.beginPath();
    ctx.arc(xe - 20, canvasH * 0.3, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ── Draw path curve ─────────────────────────────────── */
  function drawPath() {
    if (nodes.length < 2) return;

    // Shadow/glow for path
    ctx.save();
    ctx.shadowColor = 'rgba(61,36,22,0.25)';
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const cx1 = prev.x + (curr.x - prev.x) * 0.5;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) * 0.5;
      const cy2 = curr.y;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, curr.x, curr.y);
    }

    // Outer path (dirt/stone color)
    ctx.lineWidth = 13;
    ctx.strokeStyle = 'rgba(101,67,33,0.35)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner path highlight
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const cx1 = prev.x + (curr.x - prev.x) * 0.5;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) * 0.5;
      const cy2 = curr.y;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, curr.x, curr.y);
    }
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(245,227,195,0.6)';
    ctx.stroke();
    ctx.restore();
  }

  /* ── Draw nodes ─────────────────────────────────────── */
  function drawNodes(now) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const sp = SPECIAL[i];
      const biome = getBiome(i);

      // Biome node colors
      const nodeColors = {
        meadow:   { fill: '#c8e6a0', stroke: '#6b8e5f' },
        forest:   { fill: '#81c784', stroke: '#2e7d32' },
        mountain: { fill: '#cfd8dc', stroke: '#607d8b' },
        star:     { fill: '#7e57c2', stroke: '#4527a0' },
      };
      const nc = nodeColors[biome];

      const r = sp ? 13 : 9;

      // Glow for special nodes
      if (sp) {
        ctx.save();
        const glowAnim = 0.5 + 0.5 * Math.sin(now * 2.5 + i);
        ctx.shadowColor = sp.glow;
        ctx.shadowBlur = 14 + glowAnim * 10;
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Node circle
      ctx.save();
      ctx.fillStyle = sp ? sp.color : nc.fill;
      ctx.strokeStyle = sp ? 'rgba(255,255,255,0.7)' : nc.stroke;
      ctx.lineWidth = sp ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Node number (small)
      if (!sp) {
        ctx.fillStyle = biome === 'star' ? 'rgba(255,255,255,0.7)' : 'rgba(61,36,22,0.5)';
        ctx.font = `bold ${canvasW < 400 ? 7 : 8}px "General Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i, node.x, node.y);
      }

      ctx.restore();

      // Label above special nodes
      if (sp) {
        ctx.save();
        ctx.font = `${canvasW < 400 ? 11 : 13}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(sp.label, node.x, node.y - r - 2);
        ctx.restore();
      }

      // START label
      if (i === 0) {
        ctx.save();
        ctx.font = `bold ${canvasW < 400 ? 8 : 9}px "General Sans", sans-serif`;
        ctx.fillStyle = COLORS.terracotta;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('START', node.x, node.y + 14);
        ctx.restore();
      }
    }
  }

  /* ── Draw sunflower token (Raphael) ─────────────────── */
  function drawSunflower(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const r = 9;
    // Petals
    ctx.fillStyle = '#ffd700';
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * r, Math.sin(angle) * r, 4.5, 2.5, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-1.5, -1.5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ── Draw leaf token (Taylor) ───────────────────────── */
  function drawLeaf(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#43a047';
    ctx.strokeStyle = '#1b5e20';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(9, -8, 12, 0, 7, 8);
    ctx.bezierCurveTo(3, 12, -3, 12, -7, 8);
    ctx.bezierCurveTo(-12, 0, -9, -8, 0, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vein
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 9);
    ctx.stroke();

    ctx.restore();
  }

  /* ── Lerp utility ───────────────────────────────────── */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ── Draw player tokens ─────────────────────────────── */
  function drawPlayers(now) {
    const players = ['raphael', 'taylor'];
    for (const pid of players) {
      const ps = playerState[pid];
      // Get current interpolated position
      const t = easeInOutCubic(Math.min(1, ps.animT));
      const fromNode = nodes[Math.max(0, ps.displayPos)];
      const toNode   = nodes[Math.min(19, ps.targetPos)];
      if (!fromNode || !toNode) continue;

      const tx = lerp(fromNode.x, toNode.x, t);
      const ty = lerp(fromNode.y, toNode.y, t);

      // Gentle float bobbing
      const bob = Math.sin(now * 2 + (pid === 'raphael' ? 0 : Math.PI)) * 2;

      // Token shadow
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(tx + 1, ty + 12 + bob, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Slight offset so they don't overlap when on same space
      const offsetX = pid === 'raphael' ? -8 : 8;

      if (pid === 'raphael') {
        drawSunflower(tx + offsetX, ty - 2 + bob);
      } else {
        drawLeaf(tx + offsetX, ty - 2 + bob);
      }
    }
  }

  /* ── Full render ─────────────────────────────────────── */
  let lastRenderTime = 0;
  let rafId = null;

  function render(timestamp) {
    const dt = Math.min((timestamp - lastRenderTime) / 1000, 0.05);
    lastRenderTime = timestamp;
    const now = timestamp / 1000;

    // Update particle physics
    updateParticles(dt);

    // Advance player animations
    for (const pid of ['raphael', 'taylor']) {
      const ps = playerState[pid];
      if (ps.animT < 1) {
        ps.animT += dt * 1.4; // ~0.7s animation
      }
    }

    // Clear
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#1a1210' : '#faf3e8';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw layers
    drawBiomeBackground();
    drawPath();
    drawNodes(now);
    drawParticles();
    drawPlayers(now);

    rafId = requestAnimationFrame(render);
  }

  /* ── Canvas setup & resize ──────────────────────────── */
  function setupCanvas() {
    canvas = document.getElementById('wanderingCanvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return true;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrapper = canvas.parentElement;
    const ww = wrapper ? wrapper.clientWidth : window.innerWidth;
    const maxH = window.innerWidth < 640 ? 320 : 420;
    canvasW = ww;
    canvasH = Math.min(maxH, ww * 0.55);
    canvas.width = canvasW;
    canvas.height = canvasH;
    nodes = generatePath(canvasW, canvasH);
  }

  /* =========================================================
     GAME STATE
  ========================================================= */
  let currentWhoseTurn = 'raphael';
  let gameInitialized = false;

  async function refreshGameState(animate = false, movedPlayer = null, eventType = null) {
    try {
      const state = await gameGet('/api/game/state');
      currentWhoseTurn = state.whose_turn || 'raphael';
      updateTurnIndicator(currentWhoseTurn);

      const players = state.players || [];
      for (const p of players) {
        const ps = playerState[p.user_id];
        if (!ps) continue;
        const newPos = Math.min(19, Math.max(0, Number(p.position)));

        if (animate && p.user_id === movedPlayer && newPos !== ps.targetPos) {
          ps.displayPos = ps.targetPos; // start from where we were
          ps.targetPos  = newPos;
          ps.animT      = 0;
        } else if (!gameInitialized) {
          // Silent sync on first load
          ps.displayPos = newPos;
          ps.targetPos  = newPos;
          ps.animT      = 1;
        }
      }

      gameInitialized = true;
      renderPlayerCards(players, currentWhoseTurn);
    } catch (error) {
      console.warn('Unable to refresh game state:', error);
    }
  }

  /* ── Player cards ────────────────────────────────────── */
  function renderPlayerCards(players, whoseTurn) {
    const el = document.getElementById('wanderingPlayers');
    if (!el) return;

    el.innerHTML = (players || []).map(p => {
      const isRaphael = p.user_id === 'raphael';
      const isTurn = p.user_id === whoseTurn;
      const biome = getBiome(Number(p.position));
      const biomeEmojis = { meadow: '🌸', forest: '🌲', mountain: '⛰️', star: '✨' };

      return `
        <div class="wander-player-card ${isTurn ? 'player-card--active' : ''} player-card--${p.user_id}">
          <div class="wpc-token">${isRaphael ? '🌻' : '🌿'}</div>
          <div class="wpc-info">
            <div class="wpc-name">${isRaphael ? 'Raphael' : 'Taylor'}</div>
            <div class="wpc-stats">
              <span class="wpc-biome">${biomeEmojis[biome]} ${biome.charAt(0).toUpperCase() + biome.slice(1)}</span>
              <span class="wpc-pos">Space ${p.position}</span>
              <span class="wpc-pts">${p.points} pts</span>
            </div>
          </div>
          ${isTurn ? '<div class="wpc-turn-badge">Your roll</div>' : ''}
        </div>
      `;
    }).join('');
  }

  /* ── Turn indicator ──────────────────────────────────── */
  function updateTurnIndicator(whoseTurn) {
    const currentUser = getCurrentUser();
    const isMyTurn = currentUser === whoseTurn;
    const rollBtn = document.getElementById('wanderRollBtn');
    const turnBanner = document.getElementById('turnBanner');

    if (rollBtn) {
      rollBtn.disabled = !isMyTurn;
      rollBtn.classList.toggle('btn-disabled', !isMyTurn);
    }

    if (turnBanner) {
      const name  = whoseTurn === 'raphael' ? 'Raphael' : 'Taylor';
      const emoji = whoseTurn === 'raphael' ? '🌻' : '🌿';
      if (isMyTurn) {
        turnBanner.textContent = `${emoji} Your turn — roll the dice!`;
        turnBanner.className = 'turn-banner turn-yours';
      } else {
        turnBanner.textContent = `${emoji} Waiting for ${name}...`;
        turnBanner.className = 'turn-banner turn-waiting';
      }
    }
  }

  /* =========================================================
     DICE ANIMATION (DOM-based, above canvas)
  ========================================================= */
  let diceRolling = false;

  function animateDice(finalValue) {
    return new Promise(resolve => {
      const diceEl = document.getElementById('wanderDice');
      if (!diceEl) { resolve(); return; }
      if (diceRolling) { resolve(); return; }
      diceRolling = true;

      const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      diceEl.classList.add('dice-rolling');
      diceEl.style.display = 'flex';

      let count = 0;
      const total = 14;
      const interval = setInterval(() => {
        diceEl.textContent = faces[Math.floor(Math.random() * 6)];
        count++;
        if (count >= total) {
          clearInterval(interval);
          diceEl.textContent = faces[finalValue - 1];
          diceEl.classList.remove('dice-rolling');
          diceEl.classList.add('dice-landed');
          diceRolling = false;
          setTimeout(() => {
            diceEl.classList.remove('dice-landed');
            resolve();
          }, 900);
        }
      }, 70);
    });
  }

  /* ── Narrative text ──────────────────────────────────── */
  function showNarrative(text) {
    const el = document.getElementById('wanderNarrative');
    if (!el) return;
    el.classList.remove('narrative-visible');
    void el.offsetWidth; // reflow
    el.textContent = text;
    el.classList.add('narrative-visible');
  }

  /* ── Toast ───────────────────────────────────────────── */
  function showToast(msg) {
    const existing = document.querySelector('.game-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'game-toast';
    toast.textContent = msg;
    const section = document.getElementById('gameSection');
    if (section) section.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  /* ── Win celebration ─────────────────────────────────── */
  function celebrateWin(userId) {
    // Burst confetti from all finished node
    const finishNode = nodes[19];
    if (!finishNode) return;
    spawnParticles(finishNode.x, finishNode.y, 'win');

    // Also burst from center of canvas
    spawnParticles(canvasW * 0.5, canvasH * 0.5, 'win');

    const name = userId === 'raphael' ? 'Raphael' : 'Taylor';
    showNarrative(getNarrative(userId, 'star', 'win'));

    const overlay = document.getElementById('wanderWinOverlay');
    if (overlay) {
      overlay.querySelector('.win-name').textContent = `${userId === 'raphael' ? '🌻' : '🌿'} ${name}`;
      overlay.classList.add('win-visible');
      setTimeout(() => overlay.classList.remove('win-visible'), 6000);
    }
  }

  /* ── Roll ────────────────────────────────────────────── */
  async function rollDice() {
    const user = getCurrentUser();
    const rollBtn = document.getElementById('wanderRollBtn');
    if (rollBtn) { rollBtn.disabled = true; rollBtn.textContent = 'Rolling...'; }

    let result;
    try {
      result = await gamePost('/api/game/move', { user_id: user });
    } catch (e) {
      if (rollBtn) { rollBtn.disabled = false; rollBtn.textContent = '🎲 Roll the Dice'; }
      showToast('Connection error — try again.');
      return;
    }

    if (result.error) {
      if (result.error === 'Not your turn') {
        const name = result.whose_turn === 'raphael' ? 'Raphael' : 'Taylor';
        showToast(`It's ${name}'s turn!`);
      } else {
        showToast(result.error);
      }
      if (rollBtn) { rollBtn.disabled = false; rollBtn.textContent = '🎲 Roll the Dice'; }
      return;
    }

    // Animate dice
    await animateDice(result.roll);

    // Determine narrative event type
    const newPos = Math.min(19, Math.max(0, Number(result.new_position)));
    let eventType = null;
    if (result.won) eventType = 'win';
    else if (SPECIAL[newPos]) eventType = SPECIAL[newPos].type;

    // Show narrative
    const biome = getBiome(newPos);
    const narrative = getNarrative(user, biome, eventType);
    showNarrative(narrative);

    // Refresh with animation
    await refreshGameState(true, user, eventType);

    // Wait for move animation before particles
    setTimeout(() => {
      const ps = playerState[user];
      const finalNode = nodes[ps.targetPos];
      if (!finalNode) return;

      if (result.won) {
        celebrateWin(user);
      } else if (eventType === 'bonus') {
        spawnParticles(finalNode.x, finalNode.y, 'bonus');
      } else if (eventType === 'hazard') {
        spawnParticles(finalNode.x, finalNode.y, 'hazard');
      } else if (eventType === 'rest') {
        spawnParticles(finalNode.x, finalNode.y, 'rest');
      } else {
        spawnParticles(finalNode.x, finalNode.y, 'move');
      }
    }, 500);

    if (rollBtn) rollBtn.textContent = '🎲 Roll the Dice';
  }

  /* ── Reset game ──────────────────────────────────────── */
  async function resetGame() {
    // No server-side reset endpoint — just re-sync state and clear overlay
    const overlay = document.getElementById('wanderWinOverlay');
    if (overlay) overlay.classList.remove('win-visible');
    showNarrative('Refreshing the path...');
    await refreshGameState();
    showNarrative('The journey continues...');
  }

  /* ── Wire UI ─────────────────────────────────────────── */
  function wireUi() {
    const rollBtn  = document.getElementById('wanderRollBtn');
    const resetBtn = document.getElementById('wanderResetBtn');
    if (rollBtn)  rollBtn.addEventListener('click', rollDice);
    if (resetBtn) resetBtn.addEventListener('click', resetGame);
  }

  /* Re-evaluate turn when user switches */
  const origSelectUser = window.selectUser;
  window.selectUser = function (u) {
    if (origSelectUser) origSelectUser(u);
    setTimeout(() => updateTurnIndicator(currentWhoseTurn), 50);
  };

  /* ── Boot ────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    if (!setupCanvas()) return;
    wireUi();

    // Initial narrative
    showNarrative('The wandering path awaits... roll to begin your journey.');

    // Start render loop
    requestAnimationFrame(render);

    // Load game state
    refreshGameState();
    setInterval(() => refreshGameState(), 6000);
  });

})();
