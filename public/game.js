(function () {
  'use strict';

  /* =========================================================
     THE WANDERING PATH v3 — Strategic Edition
     Three.js board game for Soul Safety (Raphael & Taylor)
     
     New in v3:
     - 25 tiles with a fork at tile 7
     - Mountain Pass (upper) vs Forest Trail (lower) paths
     - Item system: Herb, Spark, Crystal (max 3 per player)
     - Tile types: item, challenge, story, rest, warp, trap
     - Fork choice modal, challenge choice modal
     - Inventory UI per player card
  ========================================================= */

  /* ── 1. CONSTANTS ─────────────────────────────────────── */
  const BOARD_SIZE = 25; /* tiles 0-24, tile 24 is finish */

  /* Fork system: tile 7 is the fork point, paths diverge 8-14,
     rejoin at tile 15. Upper = Mountain Pass, Lower = Forest Trail */
  const FORK_TILE    = 7;
  const MERGE_TILE   = 15;
  const UPPER_PATH   = 'mountain'; /* 4 tiles: 8u,9u,10u,11u → 15 */
  const LOWER_PATH   = 'forest';   /* 5 tiles: 8l,9l,10l,11l,12l → 15 */

  const BIOME_COLORS = {
    meadow:   { hex: '#7ec850', three: 0x7ec850, dark: 0x5aa835 },
    forest:   { hex: '#2d5c23', three: 0x2d5c23, dark: 0x1e3e18 },
    mountain: { hex: '#8b9eb7', three: 0x8b9eb7, dark: 0x6a7f99 },
    star:     { hex: '#1a0a3e', three: 0x1a0a3e, dark: 0x0d051f },
  };

  /* Item definitions */
  const ITEMS = {
    herb:    { icon: '🌿', name: 'Herb',    desc: 'Heals and skips the next hazard or trap' },
    spark:   { icon: '⚡', name: 'Spark',   desc: 'Roll twice and pick the better result' },
    crystal: { icon: '🔮', name: 'Crystal', desc: 'Peek at the next 3 tiles before choosing a fork' },
  };

  /* Tile type definitions */
  /* 
     Main path: 0-7, 15-24
     Fork upper (Mountain Pass): indices mu0..mu3  → 4 tiles
     Fork lower (Forest Trail):  indices ml0..ml4  → 5 tiles
  */

  /*
     TILE_POSITIONS layout:
     Index 0-7   : main path before fork (meadow → forest approach)
     Index 8-11  : upper (Mountain Pass) fork tiles
     Index 12-16 : lower (Forest Trail) fork tiles
     Index 17-24 : main path after merge (star field to finish)
     
     We store logical tile positions; the player's "pos" integer maps to
     one of these depending on path_choice after tile 7.
     
     Logical board for movement:
     pos 0-7 : before fork (shared)
     pos 7   : fork tile (prompt shown)
     pos 8-11: if mountain path (4 tiles)
     pos 8-12: if forest path  (5 tiles)
     pos 12/13 (mountain) or 13 (forest): merge back to pos 15 in logical space
     
     We keep it simpler: after fork, path_choice determines which
     TILE_POSITIONS sub-array to use. We track logical_pos separately.
     
     Simplified approach:
     - player.pos: 0..24 (logical board position)
     - player.path_choice: null | 'mountain' | 'forest'
     - For pos <= 7 or pos >= 15: shared main path positions
     - For pos 8..14 with mountain: use FORK_UPPER_POSITIONS (4 tiles)
     - For pos 8..14 with forest:   use FORK_LOWER_POSITIONS (5 tiles)
     - Mountain path moves: 8,9,10,11 then jump to 15
     - Forest path moves:   8,9,10,11,12 then jump to 15
     
     Visual offset: upper path z = -3 (closer camera), lower path z = +3
  */

  /* Main path tile positions (shared, before fork and after merge) */
  const MAIN_POSITIONS = (function () {
    var pos = [];
    /* Tiles 0-4: Meadow — horizontal row at z=7 */
    for (var i = 0; i <= 4; i++) {
      pos.push({ x: -5.6 + i * 2.8, z: 7.0, y: 0, biome: 'meadow' });
    }
    /* Tiles 5-7: Forest approach — curve up, z: 4.5 to 2.0 */
    pos.push({ x: 5.6, z: 4.5, y: 0.3, biome: 'forest' }); /* 5 */
    pos.push({ x: 6.2, z: 2.5, y: 0.6, biome: 'forest' }); /* 6 */
    pos.push({ x: 6.0, z: 0.5, y: 0.8, biome: 'forest' }); /* 7 — FORK */
    return pos;
  }());

  /* Fork Upper: Mountain Pass — 4 tiles (8..11), then merges at 15 */
  /* Offset z by -3 (above centre) for visual split */
  const FORK_UPPER_POSITIONS = [
    { x: 4.0,  z: -2.5, y: 1.8, biome: 'mountain' }, /* fork upper 0 */
    { x: 1.5,  z: -4.5, y: 2.8, biome: 'mountain' }, /* fork upper 1 */
    { x: -1.5, z: -4.5, y: 3.2, biome: 'mountain' }, /* fork upper 2 */
    { x: -4.0, z: -2.5, y: 2.0, biome: 'mountain' }, /* fork upper 3 */
  ];

  /* Fork Lower: Forest Trail — 5 tiles (8..12), then merges at 15 */
  /* Offset z by +3 (below centre) for visual split */
  const FORK_LOWER_POSITIONS = [
    { x: 4.0,  z: 3.5,  y: 0.5, biome: 'forest' }, /* fork lower 0 */
    { x: 1.5,  z: 5.0,  y: 0.4, biome: 'forest' }, /* fork lower 1 */
    { x: -1.0, z: 5.5,  y: 0.3, biome: 'forest' }, /* fork lower 2 */
    { x: -3.5, z: 5.0,  y: 0.4, biome: 'forest' }, /* fork lower 3 */
    { x: -5.5, z: 3.5,  y: 0.5, biome: 'forest' }, /* fork lower 4 */
  ];

  /* After merge: tiles 15..24 (indices 0..9 here) */
  const MERGE_POSITIONS = (function () {
    var pos = [];
    /* 15: merge point */
    pos.push({ x: -6.0, z: 0.5, y: 1.2, biome: 'mountain' }); /* 15 merge */
    /* 16-18: mountain descent */
    pos.push({ x: -6.5, z: -1.5, y: 1.8, biome: 'mountain' }); /* 16 */
    pos.push({ x: -5.5, z: -3.5, y: 2.2, biome: 'mountain' }); /* 17 */
    pos.push({ x: -4.0, z: -5.5, y: 2.5, biome: 'mountain' }); /* 18 */
    /* 19-24: starfield */
    pos.push({ x: -1.5, z: -6.5, y: 2.2, biome: 'star' }); /* 19 */
    pos.push({ x:  1.0, z: -6.5, y: 1.8, biome: 'star' }); /* 20 */
    pos.push({ x:  3.5, z: -5.5, y: 1.4, biome: 'star' }); /* 21 */
    pos.push({ x:  5.5, z: -4.0, y: 1.0, biome: 'star' }); /* 22 */
    pos.push({ x:  6.5, z: -2.0, y: 0.6, biome: 'star' }); /* 23 */
    pos.push({ x:  6.5, z:  0.0, y: 0.2, biome: 'star' }); /* 24 — FINISH */
    return pos;
  }());

  /* Tile type definitions per logical position:
     Main path 0-7: 0=start(story), 1-4=mix, 5=item, 6=story, 7=fork
     Upper fork 8-11: harder — more traps/challenges
     Lower fork 8-12: safer  — more rests/items
     After merge 15-24: mixed with increasing rewards towards finish */
  const TILE_TYPES = {
    /* Main path */
    0:  { type: 'story',     label: '📖', desc: 'The journey begins',  color: 0x7b9cde },
    1:  { type: 'item',      label: '🍄', desc: 'Collect an item',     color: 0xe8a84c },
    2:  { type: 'rest',      label: '☕', desc: 'Rest stop',           color: 0xff8a65 },
    3:  { type: 'challenge', label: '⚔️', desc: 'Face a challenge',    color: 0xe05a5a },
    4:  { type: 'story',     label: '📖', desc: 'A sight to behold',   color: 0x7b9cde },
    5:  { type: 'item',      label: '🍄', desc: 'Collect an item',     color: 0xe8a84c },
    6:  { type: 'warp',      label: '🌀', desc: 'Warp forward!',       color: 0x9c27b0 },
    7:  { type: 'fork',      label: '🔱', desc: 'Choose your path',    color: 0xffd700 },
    /* Upper fork (Mountain Pass) — harder */
    'u0': { type: 'challenge', label: '⚔️', desc: 'Mountain hazard',   color: 0xe05a5a },
    'u1': { type: 'trap',      label: '💀', desc: 'Loose stones!',     color: 0xcc3333 },
    'u2': { type: 'challenge', label: '⚔️', desc: 'Storm approaches',  color: 0xe05a5a },
    'u3': { type: 'item',      label: '🍄', desc: 'Summit reward!',    color: 0xe8a84c },
    /* Lower fork (Forest Trail) — safer */
    'l0': { type: 'rest',      label: '☕', desc: 'Mossy resting spot', color: 0xff8a65 },
    'l1': { type: 'item',      label: '🍄', desc: 'Forest treasure',   color: 0xe8a84c },
    'l2': { type: 'story',     label: '📖', desc: 'Ancient grove',     color: 0x7b9cde },
    'l3': { type: 'rest',      label: '☕', desc: 'Firefly clearing',   color: 0xff8a65 },
    'l4': { type: 'item',      label: '🍄', desc: 'Hidden cache',      color: 0xe8a84c },
    /* After merge */
    15: { type: 'story',     label: '📖', desc: 'Paths reunite',      color: 0x7b9cde },
    16: { type: 'trap',      label: '💀', desc: 'Loose footing',      color: 0xcc3333 },
    17: { type: 'challenge', label: '⚔️', desc: 'The descent',        color: 0xe05a5a },
    18: { type: 'item',      label: '🍄', desc: 'Mountain gift',      color: 0xe8a84c },
    19: { type: 'warp',      label: '🌀', desc: 'Cosmic rift!',       color: 0x9c27b0 },
    20: { type: 'story',     label: '📖', desc: 'Stars whisper',      color: 0x7b9cde },
    21: { type: 'challenge', label: '⚔️', desc: 'Final test',         color: 0xe05a5a },
    22: { type: 'rest',      label: '☕', desc: 'Nebula rest',        color: 0xff8a65 },
    23: { type: 'item',      label: '🍄', desc: 'Cosmic gift',        color: 0xe8a84c },
    24: { type: 'finish',    label: '🏁', desc: 'Enlightenment!',     color: 0xff6b9d },
  };

  /* Challenge definitions — rotate through these */
  const CHALLENGES = [
    {
      text: 'A fork in the mist...',
      detail: 'Go LEFT (safe +1) or RIGHT (risky: roll 4+ = +3, else -2)?',
      options: [
        { label: '← Left (safe)', action: 'challenge_safe' },
        { label: '→ Right (risky)', action: 'challenge_risky' },
      ],
    },
    {
      text: 'A wandering merchant appears!',
      detail: 'Trade an item for +3 spaces, or keep walking?',
      options: [
        { label: '🎒 Trade item (+3)', action: 'challenge_trade', requiresItem: true },
        { label: '🚶 Keep walking', action: 'challenge_walk' },
      ],
    },
    {
      text: 'A sleeping guardian blocks the way!',
      detail: 'Sneak past (50% chance to avoid turn loss) or find another route (lose 1 turn)?',
      options: [
        { label: '🤫 Sneak past', action: 'challenge_sneak' },
        { label: '🔄 Find another route', action: 'challenge_reroute' },
      ],
    },
    {
      text: 'The ground trembles beneath you!',
      detail: 'Stand firm (50% chance: +2 or -1) or retreat to safety (+0)?',
      options: [
        { label: '💪 Stand firm', action: 'challenge_stand' },
        { label: '🏃 Retreat safely', action: 'challenge_retreat' },
      ],
    },
    {
      text: 'A riddle from the ancient stones...',
      detail: '"I have cities, but no houses live there." Accept the riddle for +3 or decline?',
      options: [
        { label: '🧩 Accept (risky)', action: 'challenge_riddle' },
        { label: '🙅 Decline', action: 'challenge_walk' },
      ],
    },
  ];

  const NARRATIVES = {
    raphael: {
      meadow:    ['Raphael wandered through sun-dappled meadows...', 'A butterfly landed on Raphael\'s shoulder.', 'Raphael picked a wildflower along the way.', 'The golden meadow stretched wide before Raphael.', 'Raphael hummed softly as the grass swayed.'],
      forest:    ['Raphael stepped under the ancient canopy.', 'Sunlight flickered through the forest leaves.', 'Raphael found a glowing mushroom ring!', 'The forest whispered old secrets.', 'Raphael traced moss on a weathered oak.'],
      mountain:  ['Raphael climbed toward the misty peaks.', 'Cold wind swept across the rocky ridge.', 'Raphael paused to admire the view below.', 'Snow dusted the stones at Raphael\'s feet.', 'The mountain air was impossibly clear.'],
      star:      ['Raphael floated into the starfield...', 'Nebulae swirled in violet hues around Raphael.', 'A shooting star streaked past!', 'Raphael felt weightless among the cosmos.', 'The universe hummed with quiet wonder.'],
      item:      ['🍄 Raphael discovered a glowing item on the path!', '✨ Something catches Raphael\'s eye — an item!', '🌟 Raphael bends down and finds a treasure!'],
      challenge: ['⚔️ A moment of decision looms for Raphael...', '🌫️ The path grows uncertain — Raphael must choose.'],
      rest:      ['☕ Raphael settled by the campfire for a warm rest. Next hazard skipped!', '🌿 Raphael found a mossy clearing — time to breathe.'],
      warp:      ['🌀 A shimmering portal pulls Raphael forward!', '💫 Space folds — Raphael warps ahead!'],
      trap:      ['💀 A trap springs from the shadows!', '⚠️ The ground gives way under Raphael\'s feet!'],
      fork:      ['🔱 The path splits before Raphael — a fateful choice awaits.'],
      win:       ['🌻 Raphael reached enlightenment! The sunflower blooms eternal!'],
    },
    taylor: {
      meadow:    ['Taylor skipped through the bright green meadow.', 'A monarch butterfly danced ahead of Taylor.', 'Taylor braided clover as they walked.', 'The meadow smelled of rain and clover.'],
      forest:    ['Taylor disappeared into the verdant forest.', 'Ancient trees towered around Taylor.', 'Taylor spotted a hidden fairy door!', 'The forest floor was soft with fallen leaves.'],
      mountain:  ['Taylor scaled the craggy mountain path.', 'Pebbles skittered as Taylor climbed higher.', 'Taylor found an eagle\'s feather on the ledge.', 'Snow crunched softly underfoot.'],
      star:      ['Taylor drifted through the cosmic starfield...', 'Stars spiraled into shapes around Taylor.', 'A meteor shower painted the dark!', 'Taylor felt infinity pressing gently close.'],
      item:      ['🍄 Taylor spotted something sparkling off the path!', '✨ An item appears at Taylor\'s feet!', '🌟 Taylor reaches down and finds a secret treasure!'],
      challenge: ['⚔️ A test of will arises for Taylor...', '🌫️ The forest grows thick — Taylor faces a choice.'],
      rest:      ['☕ Taylor found the hearthstone clearing — time to rest. Next hazard skipped!', '🌿 Taylor sits beneath an ancient fern — breathing deeply.'],
      warp:      ['🌀 A rift of light pulls Taylor through space!', '💫 The stars rearrange themselves — Taylor warps forward!'],
      trap:      ['💀 Something lurked in the shadows for Taylor!', '⚠️ The moss gives way — Taylor stumbles!'],
      fork:      ['🔱 Two paths stretch before Taylor — the journey deepens.'],
      win:       ['🌿 Taylor reached the cosmic clearing — enlightenment achieved!'],
    },
  };

  /* ── 2. TILE POSITION RESOLVER ───────────────────────── */
  /* Given a logical pos (0-24) and path_choice, return world position */
  function getWorldPos(logicalPos, pathChoice) {
    if (logicalPos < 0) logicalPos = 0;
    /* Main path before fork */
    if (logicalPos <= 7) {
      return MAIN_POSITIONS[logicalPos];
    }
    /* After merge */
    if (logicalPos >= 15) {
      var mergeIdx = logicalPos - 15;
      return MERGE_POSITIONS[Math.min(mergeIdx, MERGE_POSITIONS.length - 1)];
    }
    /* Fork paths: pos 8-14 */
    if (pathChoice === 'mountain') {
      /* Mountain: 4 fork tiles (positions 8,9,10,11) */
      var upperIdx = logicalPos - 8;
      return FORK_UPPER_POSITIONS[Math.min(upperIdx, FORK_UPPER_POSITIONS.length - 1)];
    } else {
      /* Forest: 5 fork tiles (positions 8,9,10,11,12) */
      var lowerIdx = logicalPos - 8;
      return FORK_LOWER_POSITIONS[Math.min(lowerIdx, FORK_LOWER_POSITIONS.length - 1)];
    }
  }

  /* Get the tile type key for the current player state */
  function getTileTypeKey(logicalPos, pathChoice) {
    if (logicalPos <= 7 || logicalPos >= 15) {
      return logicalPos;
    }
    if (pathChoice === 'mountain') {
      var ui = logicalPos - 8;
      return 'u' + ui;
    } else {
      var li = logicalPos - 8;
      return 'l' + li;
    }
  }

  function getTileType(logicalPos, pathChoice) {
    var key = getTileTypeKey(logicalPos, pathChoice);
    return TILE_TYPES[key] || { type: 'story', label: '📖', desc: '', color: 0x7b9cde };
  }

  /* Maximum logical position for each path */
  function getMaxForkPos(pathChoice) {
    return pathChoice === 'mountain' ? 11 : 12;
  }

  /* After reaching max fork pos, next step goes to 15 */
  function advancePos(currentPos, steps, pathChoice) {
    var newPos = currentPos + steps;
    /* If in fork zone and exceeds max, clamp to 15 */
    if (currentPos >= 8 && currentPos < 15) {
      var maxFork = getMaxForkPos(pathChoice);
      if (newPos > maxFork) {
        newPos = 15 + (newPos - maxFork - 1);
      }
    }
    return Math.min(24, newPos);
  }

  function getBiomeFromPos(logicalPos, pathChoice) {
    var wp = getWorldPos(logicalPos, pathChoice || 'forest');
    return wp.biome;
  }

  function getNarrative(userId, biome, eventType) {
    var n = NARRATIVES[userId] || NARRATIVES.raphael;
    if (eventType === 'win')       return n.win[0];
    if (eventType === 'item')      return n.item[Math.floor(Math.random() * n.item.length)];
    if (eventType === 'challenge') return n.challenge[Math.floor(Math.random() * n.challenge.length)];
    if (eventType === 'rest')      return n.rest[Math.floor(Math.random() * n.rest.length)];
    if (eventType === 'warp')      return n.warp[Math.floor(Math.random() * n.warp.length)];
    if (eventType === 'trap')      return n.trap[Math.floor(Math.random() * n.trap.length)];
    if (eventType === 'fork')      return n.fork[0];
    var arr = n[biome] || n.meadow;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ── 3. API ───────────────────────────────────────────── */
  function gameGet() {
    var token = window.authToken || (typeof localStorage !== 'undefined' && localStorage.getItem('soulSafetyBearerToken')) || '';
    return fetch('/api/game/state', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      credentials: 'include',
    }).then(function (r) { return r.json(); });
  }

  function gamePost(endpoint, body) {
    var token = window.authToken || (typeof localStorage !== 'undefined' && localStorage.getItem('soulSafetyBearerToken')) || '';
    return fetch('/api/' + endpoint, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      credentials: 'include',
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  }

  function getCurrentUser() {
    return window.currentUser || (document.querySelector('.user-option.active') && document.querySelector('.user-option.active').dataset.user) || 'raphael';
  }

  /* ── 4. THREE.JS SCENE INIT ──────────────────────────── */
  var THREE;

  function init() {
    var canvasWrap = document.querySelector('.wander-canvas-wrap');
    if (!canvasWrap) return;

    THREE = window.THREE;
    if (!THREE) {
      console.error('[WanderingPath v3] THREE.js not loaded');
      return;
    }

    /* Remove old canvas */
    var oldCanvas = document.getElementById('wanderingCanvas');
    if (oldCanvas) oldCanvas.style.display = 'none';

    /* Renderer */
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width   = '100%';
    renderer.domElement.style.height  = '100%';
    canvasWrap.appendChild(renderer.domElement);

    /* Scene */
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060318);
    scene.fog = new THREE.FogExp2(0x060318, 0.020);

    /* Camera */
    var aspect = canvasWrap.clientWidth / Math.max(canvasWrap.clientHeight, 1);
    var camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 200);
    camera.position.set(0, 18, 22);
    camera.lookAt(0, 0, 0);

    var clock = new THREE.Clock();

    /* ── 5. LIGHTING ──────────────────────────────────── */
    var dirLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    dirLight.position.set(8, 20, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width  = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far  = 60;
    dirLight.shadow.camera.left   = -22;
    dirLight.shadow.camera.right  =  22;
    dirLight.shadow.camera.top    =  22;
    dirLight.shadow.camera.bottom = -22;
    scene.add(dirLight);

    var ambient = new THREE.AmbientLight(0x6080ff, 0.5);
    scene.add(ambient);

    var hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.55);
    scene.add(hemi);

    var purpleLight = new THREE.PointLight(0x6622aa, 0.6, 30);
    purpleLight.position.set(-8, 10, -8);
    scene.add(purpleLight);

    var amberLight = new THREE.PointLight(0xff8844, 0.4, 25);
    amberLight.position.set(8, 8, 5);
    scene.add(amberLight);

    /* ── 6. TILE LABEL TEXTURE ──────────────────────── */
    function makeTileLabel(num, typeInfo) {
      var c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      var bgColor = typeInfo ? '#' + typeInfo.color.toString(16).padStart(6, '0') : 'rgba(255,255,255,0.85)';
      ctx.fillStyle = typeInfo ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.85)';
      ctx.fill();
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#3d2416';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(num), 32, 33);
      return new THREE.CanvasTexture(c);
    }

    /* ── 7. BOARD GENERATION ────────────────────────── */
    var tileGroup   = new THREE.Group();
    var bridgeGroup = new THREE.Group();
    scene.add(tileGroup);
    scene.add(bridgeGroup);

    var tileMeshMap = {}; /* key: 'main_N', 'upper_N', 'lower_N', 'merge_N' */
    var allTileMeshes = []; /* for animation loop */
    var specialRings = [];

    var tileMats = {
      meadow:   new THREE.MeshPhongMaterial({ color: 0x7ec850, shininess: 30 }),
      forest:   new THREE.MeshPhongMaterial({ color: 0x2d5c23, shininess: 20 }),
      mountain: new THREE.MeshPhongMaterial({ color: 0x8b9eb7, shininess: 40 }),
      star:     new THREE.MeshPhongMaterial({ color: 0x1a0a3e, shininess: 80, emissive: 0x220055, emissiveIntensity: 0.4 }),
    };

    function makeTileMesh(tp, typeInfo, labelNum) {
      var baseMat = tileMats[tp.biome].clone();
      if (typeInfo) {
        if (typeInfo.type === 'item')      { baseMat.emissive = new THREE.Color(0x443300); baseMat.emissiveIntensity = 0.4; }
        if (typeInfo.type === 'challenge') { baseMat.emissive = new THREE.Color(0x440000); baseMat.emissiveIntensity = 0.5; }
        if (typeInfo.type === 'rest')      { baseMat.emissive = new THREE.Color(0x442200); baseMat.emissiveIntensity = 0.4; }
        if (typeInfo.type === 'warp')      { baseMat.emissive = new THREE.Color(0x220044); baseMat.emissiveIntensity = 0.6; }
        if (typeInfo.type === 'trap')      { baseMat.emissive = new THREE.Color(0x330000); baseMat.emissiveIntensity = 0.6; }
        if (typeInfo.type === 'fork')      { baseMat.emissive = new THREE.Color(0x443300); baseMat.emissiveIntensity = 0.7; }
        if (typeInfo.type === 'finish')    { baseMat.emissive = new THREE.Color(0x440022); baseMat.emissiveIntensity = 0.7; }
      }
      var tileGeo  = new THREE.BoxGeometry(2.2, 0.4, 2.2);
      var tileMesh = new THREE.Mesh(tileGeo, baseMat);
      tileMesh.position.set(tp.x, tp.y, tp.z);
      tileMesh.castShadow    = true;
      tileMesh.receiveShadow = true;
      tileMesh._baseY  = tp.y;
      tileMesh._biome  = tp.biome;

      /* Trim */
      var trimMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.25, 0.08, 2.25),
        new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })
      );
      trimMesh.position.y = 0.22;
      tileMesh.add(trimMesh);

      /* Label */
      if (labelNum !== undefined) {
        var labelMat = new THREE.MeshBasicMaterial({ map: makeTileLabel(labelNum, typeInfo), transparent: true, depthWrite: false });
        var labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.65), labelMat);
        labelMesh.rotation.x = -Math.PI / 2;
        labelMesh.position.set(0, 0.22, 0);
        tileMesh.add(labelMesh);
      }

      /* Type icon */
      if (typeInfo && typeInfo.label) {
        var iconCanvas = document.createElement('canvas');
        iconCanvas.width = 48; iconCanvas.height = 48;
        var ictx = iconCanvas.getContext('2d');
        ictx.font = '34px sans-serif';
        ictx.textAlign = 'center';
        ictx.textBaseline = 'middle';
        ictx.fillText(typeInfo.label, 24, 26);
        var iconMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.85, 0.85),
          new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(iconCanvas), transparent: true, depthWrite: false })
        );
        iconMesh.rotation.x = -Math.PI / 2;
        iconMesh.position.set(0, 0.5, 0);
        tileMesh.add(iconMesh);
      }

      /* Pulsing ring for special tiles */
      if (typeInfo && typeInfo.type !== 'story') {
        var ringGeo = new THREE.TorusGeometry(1.3, 0.045, 8, 32);
        var ringMat = new THREE.MeshPhongMaterial({
          color: typeInfo.color, emissive: typeInfo.color,
          emissiveIntensity: 0.8, transparent: true, opacity: 0.65,
        });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(tp.x, tp.y + 0.25, tp.z);
        ring._phase = Math.random() * Math.PI * 2;
        scene.add(ring);
        specialRings.push(ring);
      }

      tileGroup.add(tileMesh);
      allTileMeshes.push(tileMesh);
      return tileMesh;
    }

    /* Build main path tiles 0-7 */
    for (var mi = 0; mi < MAIN_POSITIONS.length; mi++) {
      var mtp = MAIN_POSITIONS[mi];
      var mtype = TILE_TYPES[mi];
      var mesh = makeTileMesh(mtp, mtype, mi);
      tileMeshMap['main_' + mi] = mesh;
    }

    /* Build upper fork tiles */
    for (var ui = 0; ui < FORK_UPPER_POSITIONS.length; ui++) {
      var utp = FORK_UPPER_POSITIONS[ui];
      var utype = TILE_TYPES['u' + ui];
      var umesh = makeTileMesh(utp, utype, 'u' + (8 + ui));
      tileMeshMap['upper_' + ui] = umesh;
    }

    /* Build lower fork tiles */
    for (var li = 0; li < FORK_LOWER_POSITIONS.length; li++) {
      var ltp = FORK_LOWER_POSITIONS[li];
      var ltype = TILE_TYPES['l' + li];
      var lmesh = makeTileMesh(ltp, ltype, 'l' + (8 + li));
      tileMeshMap['lower_' + li] = lmesh;
    }

    /* Build merge path tiles 15-24 */
    for (var mgi = 0; mgi < MERGE_POSITIONS.length; mgi++) {
      var mgtp = MERGE_POSITIONS[mgi];
      var mgtype = TILE_TYPES[15 + mgi];
      var mgmesh = makeTileMesh(mgtp, mgtype, 15 + mgi);
      tileMeshMap['merge_' + mgi] = mgmesh;
    }

    /* ── 8. PATH BRIDGES ────────────────────────────── */
    function addBridge(a, b) {
      var dx = b.x - a.x; var dz = b.z - a.z; var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dz * dz + dy * dy);
      var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 0.02, z: (a.z + b.z) / 2 };
      var brgMat = new THREE.MeshPhongMaterial({ color: BIOME_COLORS[a.biome].three, opacity: 0.65, transparent: true });
      var brgMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, len - 0.15), brgMat);
      brgMesh.position.set(mid.x, mid.y, mid.z);
      brgMesh.lookAt(b.x, mid.y, b.z);
      brgMesh.receiveShadow = true;
      bridgeGroup.add(brgMesh);
    }

    /* Main path bridges */
    for (var bmi = 0; bmi < MAIN_POSITIONS.length - 1; bmi++) {
      addBridge(MAIN_POSITIONS[bmi], MAIN_POSITIONS[bmi + 1]);
    }
    /* Fork from tile 7 to upper[0] and lower[0] */
    addBridge(MAIN_POSITIONS[7], FORK_UPPER_POSITIONS[0]);
    addBridge(MAIN_POSITIONS[7], FORK_LOWER_POSITIONS[0]);
    /* Upper fork internal */
    for (var bui = 0; bui < FORK_UPPER_POSITIONS.length - 1; bui++) {
      addBridge(FORK_UPPER_POSITIONS[bui], FORK_UPPER_POSITIONS[bui + 1]);
    }
    /* Upper last → merge 0 */
    addBridge(FORK_UPPER_POSITIONS[FORK_UPPER_POSITIONS.length - 1], MERGE_POSITIONS[0]);
    /* Lower fork internal */
    for (var bli = 0; bli < FORK_LOWER_POSITIONS.length - 1; bli++) {
      addBridge(FORK_LOWER_POSITIONS[bli], FORK_LOWER_POSITIONS[bli + 1]);
    }
    /* Lower last → merge 0 */
    addBridge(FORK_LOWER_POSITIONS[FORK_LOWER_POSITIONS.length - 1], MERGE_POSITIONS[0]);
    /* Merge path bridges */
    for (var bmgi = 0; bmgi < MERGE_POSITIONS.length - 1; bmgi++) {
      addBridge(MERGE_POSITIONS[bmgi], MERGE_POSITIONS[bmgi + 1]);
    }

    /* ── 9. BIOME DECORATIONS ───────────────────────── */
    var decoGroup = new THREE.Group();
    scene.add(decoGroup);

    /* Meadow: hills + wildflowers */
    (function () {
      var hillMat = new THREE.MeshPhongMaterial({ color: 0x5aae35, transparent: true, opacity: 0.7 });
      [[-7, 0, 8.5], [-3, 0, 9.5], [1, 0, 9.8], [5, 0, 8.5]].forEach(function (hp) {
        var r = 1.8 + Math.random() * 1.1;
        var hm = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMat.clone());
        hm.position.set(hp[0], -0.2, hp[2]);
        hm.receiveShadow = true;
        decoGroup.add(hm);
      });
      for (var fi = 0; fi < 14; fi++) {
        var fx = -7 + Math.random() * 14;
        var fz = 5.5 + Math.random() * 5;
        var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5), new THREE.MeshPhongMaterial({ color: 0x4a8f30 }));
        stem.position.set(fx, 0.25, fz);
        var fc = [0xff6b9d, 0xffd700, 0xff9966, 0xffffff];
        var flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshPhongMaterial({ color: fc[fi % fc.length], emissive: 0x221100, emissiveIntensity: 0.2 }));
        flower.position.y = 0.3;
        stem.add(flower);
        decoGroup.add(stem);
      }
    }());

    /* Forest: tall cone trees — clustered around upper & lower fork areas */
    (function () {
      var treeData = [
        [7.5, -1.2], [8.5, -3.5], [7.8, -5.0], [9.0, -2.5],
        [7.3,  1.5], [8.8, -0.5], [9.5, -4.5],
        /* Around lower fork */
        [5.0,  4.5], [3.0,  6.5], [0.0,  7.0], [-3.0, 6.5], [-6.0, 4.5],
      ];
      var greens = [0x1e4d14, 0x2a6620, 0x367a28, 0x1a3d10];
      treeData.forEach(function (td, idx) {
        var h = 2.5 + Math.random() * 2.5;
        var tg = new THREE.Group();
        tg.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h * 0.35, 7), new THREE.MeshPhongMaterial({ color: 0x5c3a1e })), { position: { x: 0, y: h * 0.175, z: 0 }, castShadow: true }));
        for (var layer = 0; layer < 3; layer++) {
          var cone = new THREE.Mesh(new THREE.ConeGeometry(0.9 - layer * 0.2, h * 0.45, 8), new THREE.MeshPhongMaterial({ color: greens[(idx + layer) % greens.length] }));
          cone.position.y = h * (0.38 + layer * 0.22);
          cone.castShadow = true;
          tg.add(cone);
        }
        tg.position.set(td[0], 0, td[1]);
        decoGroup.add(tg);
      });
    }());

    /* Mountain: rocky peaks with snow caps — around upper fork */
    (function () {
      var peaks = [
        [-7.5, -6.5, 5.0], [-4.5, -7.0, 6.5], [0, -7.5, 7.0],
        [4, -7.0, 6.5],    [7.5, -6.5, 5.5],
        /* Upper fork vicinity */
        [5.5, -3.5, 4.0], [3.0, -5.5, 5.5], [-1.0, -6.0, 5.8], [-5.0, -3.5, 4.2],
      ];
      peaks.forEach(function (pd) {
        var pg = new THREE.Group();
        var ph = pd[2];
        var pm = new THREE.Mesh(new THREE.ConeGeometry(1.0 + Math.random() * 0.5, ph, 7), new THREE.MeshPhongMaterial({ color: 0x708090, shininess: 5 }));
        pm.position.y = ph / 2;
        pm.castShadow = true;
        pg.add(pm);
        var sm = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshPhongMaterial({ color: 0xfafcff, shininess: 60 }));
        sm.position.y = ph * 0.84;
        sm.scale.y = 0.55;
        pg.add(sm);
        pg.position.set(pd[0], 0, pd[1]);
        decoGroup.add(pg);
      });
    }());

    /* Starfield: particles + nebulae */
    var starPoints, dustParticles;
    (function () {
      var nm = new THREE.Mesh(new THREE.SphereGeometry(8, 20, 16), new THREE.MeshPhongMaterial({ color: 0x5a0099, emissive: 0x330066, emissiveIntensity: 1.0, transparent: true, opacity: 0.22, side: THREE.BackSide }));
      nm.position.set(3, 3, -5);
      decoGroup.add(nm);
      var nm2 = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshPhongMaterial({ color: 0x663300, emissive: 0x442200, emissiveIntensity: 0.6, transparent: true, opacity: 0.12, side: THREE.BackSide }));
      nm2.position.set(-2, 5, -3);
      decoGroup.add(nm2);

      var sc = 400, sg = new THREE.BufferGeometry(), sp = new Float32Array(sc * 3);
      for (var si = 0; si < sc; si++) { sp[si*3]=(Math.random()-0.5)*44; sp[si*3+1]=Math.random()*16; sp[si*3+2]=(Math.random()-0.5)*44; }
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      starPoints = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
      decoGroup.add(starPoints);

      var dc = 80, dg = new THREE.BufferGeometry(), dp = new Float32Array(dc * 3);
      for (var di = 0; di < dc; di++) { dp[di*3]=(Math.random()-0.5)*20; dp[di*3+1]=0.3+Math.random()*6; dp[di*3+2]=(Math.random()-0.5)*20; }
      dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      dustParticles = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffcc66, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.5 }));
      decoGroup.add(dustParticles);

      for (var fsi = 0; fsi < 20; fsi++) {
        var fsm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 5), new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 1.0 }));
        fsm.position.set((Math.random()-0.5)*18, 0.5+Math.random()*5, (Math.random()-0.5)*18);
        fsm._floatPhase = Math.random() * Math.PI * 2;
        decoGroup.add(fsm);
      }
    }());

    /* Fork sign post at tile 7 */
    (function () {
      var ft = MAIN_POSITIONS[7];
      var postMat = new THREE.MeshPhongMaterial({ color: 0x8b6340 });
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 2.0, 8), postMat);
      post.position.set(ft.x - 1.4, ft.y + 1.0, ft.z);
      post.castShadow = true;
      scene.add(post);

      /* Sign boards */
      function makeSign(label, color, rotY) {
        var sg = new THREE.Group();
        var board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.08), new THREE.MeshPhongMaterial({ color: color }));
        sg.add(board);
        var c2 = document.createElement('canvas'); c2.width=128; c2.height=48;
        var cx2 = c2.getContext('2d');
        cx2.fillStyle = '#fff'; cx2.font = 'bold 20px sans-serif'; cx2.textAlign='center'; cx2.textBaseline='middle';
        cx2.fillText(label, 64, 24);
        var tm = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c2), transparent: true }));
        tm.position.z = 0.05;
        sg.add(tm);
        sg.rotation.y = rotY;
        return sg;
      }
      var s1 = makeSign('🏔️ Mountain', 0x8b9eb7, 0.4);
      s1.position.set(ft.x - 1.4, ft.y + 1.8, ft.z);
      scene.add(s1);
      var s2 = makeSign('🌲 Forest', 0x2d5c23, -0.3);
      s2.position.set(ft.x - 1.4, ft.y + 1.3, ft.z);
      scene.add(s2);
    }());

    /* ── 10. PLAYER TOKENS ──────────────────────────── */
    function createRaphaelToken() {
      var group = new THREE.Group();
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.0, 8), new THREE.MeshPhongMaterial({ color: 0x8B4513 }));
      body.position.y = 0.5; body.castShadow = true;
      group.add(body);
      var head = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16), new THREE.MeshPhongMaterial({ color: 0xDAA520, emissive: 0x443300, emissiveIntensity: 0.3 }));
      head.position.y = 1.05; head.castShadow = true;
      group.add(head);
      for (var pi = 0; pi < 8; pi++) {
        var petal = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshPhongMaterial({ color: 0xFFD700 }));
        petal.position.set(Math.cos(pi * Math.PI / 4) * 0.65, 1.05, Math.sin(pi * Math.PI / 4) * 0.65);
        group.add(petal);
      }
      var center = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12), new THREE.MeshPhongMaterial({ color: 0x4a2f00 }));
      center.position.y = 1.12;
      group.add(center);
      group.scale.set(0.55, 0.55, 0.55);
      return group;
    }

    function createTaylorToken() {
      var group = new THREE.Group();
      var lPoints = [];
      for (var lp = 0; lp <= 10; lp++) {
        var lt = lp / 10;
        lPoints.push(new THREE.Vector2(Math.sin(lt * Math.PI) * 0.35, lt * 1.0 - 0.5));
      }
      var body = new THREE.Mesh(new THREE.LatheGeometry(lPoints, 12), new THREE.MeshPhongMaterial({ color: 0x5a9e4a, shininess: 60 }));
      body.position.y = 0.5; body.castShadow = true;
      group.add(body);
      var vein = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.04), new THREE.MeshPhongMaterial({ color: 0x3a7030 }));
      vein.position.y = 0.55;
      group.add(vein);
      var tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), new THREE.MeshPhongMaterial({ color: 0x3a7030 }));
      tip.position.y = 1.05; tip.rotation.z = 0.1;
      group.add(tip);
      group.scale.set(0.55, 0.55, 0.55);
      return group;
    }

    var raphael3D = createRaphaelToken();
    var taylor3D  = createTaylorToken();
    raphael3D._baseY = 0.2;
    taylor3D._baseY  = 0.2;
    scene.add(raphael3D);
    scene.add(taylor3D);

    /* ── 11. 3D DICE ────────────────────────────────── */
    function drawDots(ctx, num) {
      ctx.fillStyle = '#3d2416';
      var dotR = 9;
      var positions = {
        1: [[64, 64]],
        2: [[36, 36], [92, 92]],
        3: [[36, 36], [64, 64], [92, 92]],
        4: [[36, 36], [92, 36], [36, 92], [92, 92]],
        5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
        6: [[36, 36], [92, 36], [36, 64], [92, 64], [36, 92], [92, 92]],
      };
      (positions[num] || positions[1]).forEach(function (d) {
        ctx.beginPath(); ctx.arc(d[0], d[1], dotR, 0, Math.PI * 2); ctx.fill();
      });
    }

    function create3DDice() {
      var geo  = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      var mats = [1,2,3,4,5,6].map(function (num) {
        var c = document.createElement('canvas'); c.width = 128; c.height = 128;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#faf6ef';
        ctx.beginPath(); ctx.roundRect(4, 4, 120, 120, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(194,98,58,0.3)'; ctx.lineWidth = 3; ctx.stroke();
        drawDots(ctx, num);
        return new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c), shininess: 60 });
      });
      return new THREE.Mesh(geo, mats);
    }

    var diceMesh = create3DDice();
    diceMesh.position.set(8, 3, 8);
    diceMesh.visible = false;
    diceMesh.castShadow = true;
    scene.add(diceMesh);

    /* ── 12. GAME STATE ─────────────────────────────── */
    var gameState = {
      raphael: { pos: 0, pts: 0, inventory: [], path_choice: null, skip_hazard: false },
      taylor:  { pos: 0, pts: 0, inventory: [], path_choice: null, skip_hazard: false },
      currentTurn: 'raphael',
      rolling: false,
      winner: null,
      pendingChallenge: null, /* { uid, challengeIdx } */
      pendingFork: null,      /* { uid } */
      pendingSparkRoll: null, /* { uid, roll1, roll2 } */
      pendingTrade: null,     /* { uid } */
    };

    var isAnimating  = false;
    var diceRolling  = false;
    var diceRollT    = 0;
    var diceRollDuration = 1.5;
    var diceResult   = 0;
    var camTween     = null;
    var tokenAnim    = null;
    var winParticles = [];

    /* ── 13. UI ELEMENT REFS ────────────────────────── */
    var narrativeEl  = document.getElementById('wanderNarrative');
    var turnBanner   = document.getElementById('turnBanner');
    var diceEl       = document.getElementById('wanderDice');
    var rollBtn      = document.getElementById('wanderRollBtn');
    var resetBtn     = document.getElementById('wanderResetBtn');
    var playersEl    = document.getElementById('wanderingPlayers');
    var winOverlay   = document.getElementById('wanderWinOverlay');
    var forkModal    = document.getElementById('wanderForkModal');
    var challengeModal = document.getElementById('wanderChallengeModal');
    var sparkBtnWrap = document.getElementById('wanderSparkBtnWrap');
    var rollAgainBtn = document.getElementById('wanderRollAgainBtn');
    var itemBtnArea  = document.getElementById('wanderItemBtnArea');
    var peekOverlay  = document.getElementById('wanderPeekOverlay');

    /* ── 14. NARRATIVE & BANNER ─────────────────────── */
    function setNarrative(text) {
      if (!narrativeEl) return;
      narrativeEl.classList.remove('narrative-visible');
      setTimeout(function () {
        narrativeEl.textContent = text;
        narrativeEl.classList.add('narrative-visible');
      }, 160);
    }

    function updateTurnBanner(turn) {
      if (!turnBanner) return;
      if (turn === 'raphael') {
        turnBanner.textContent = '🌻 Raphael\'s Turn';
        turnBanner.className = 'turn-banner turn-yours';
      } else {
        turnBanner.textContent = '🌿 Taylor\'s Turn';
        turnBanner.className = 'turn-banner turn-waiting';
      }
    }

    /* ── 15. INVENTORY UI ───────────────────────────── */
    function renderInventorySlots(uid, inv) {
      var slots = '';
      for (var i = 0; i < 3; i++) {
        var item = inv[i];
        if (item) {
          slots += '<div class="inv-slot inv-slot--filled" data-uid="' + uid + '" data-item="' + item + '" title="' + ITEMS[item].name + ': ' + ITEMS[item].desc + '">' + ITEMS[item].icon + '</div>';
        } else {
          slots += '<div class="inv-slot inv-slot--empty"></div>';
        }
      }
      return '<div class="inv-slots">' + slots + '</div>';
    }

    /* ── 16. PLAYER CARDS ───────────────────────────── */
    function updatePlayerCards() {
      if (!playersEl) return;
      var names = { raphael: '🌻 Raphael', taylor: '🌿 Taylor' };
      var biomeNames = { meadow: '🌸 Meadow', forest: '🌲 Forest', mountain: '⛰️ Mountain', star: '✨ Starfield' };
      var html = '';
      ['raphael', 'taylor'].forEach(function (uid) {
        var st = gameState[uid];
        var isActive = gameState.currentTurn === uid;
        var biome = getBiomeFromPos(st.pos, st.path_choice);
        var pathLabel = '';
        if (st.pos >= 8 && st.pos < 15) {
          pathLabel = st.path_choice === 'mountain' ? '🏔️ Mountain Pass' : '🌲 Forest Trail';
        }
        html += '<div class="wander-player-card' + (isActive ? ' player-card--active' : '') + '">';
        html += '<div class="wpc-token">' + (uid === 'raphael' ? '🌻' : '🌿') + '</div>';
        html += '<div class="wpc-info">';
        html += '<div class="wpc-name">' + names[uid] + '</div>';
        html += '<div class="wpc-stats">';
        html += '<span class="wpc-pos">Tile ' + st.pos + '/24</span>';
        if (pathLabel) html += '<span class="wpc-path">' + pathLabel + '</span>';
        else html += '<span class="wpc-biome">' + biomeNames[biome] + '</span>';
        if (st.skip_hazard) html += '<span class="wpc-shield">🛡️ Shielded</span>';
        html += '</div>';
        html += renderInventorySlots(uid, st.inventory);
        html += '</div>';
        if (isActive) html += '<div class="wpc-turn-badge">YOUR TURN</div>';
        html += '</div>';
      });
      playersEl.innerHTML = html;
    }

    /* ── 17. ITEM BUTTON AREA ───────────────────────── */
    function updateItemButtons() {
      if (!itemBtnArea) return;
      var curUser = getCurrentUser();
      var isTurn  = curUser === gameState.currentTurn;
      var inv     = gameState[curUser] ? gameState[curUser].inventory : [];

      if (!isTurn || isAnimating || diceRolling || gameState.winner ||
          gameState.pendingChallenge || gameState.pendingFork || gameState.pendingSparkRoll) {
        itemBtnArea.innerHTML = '';
        return;
      }

      var html = '';
      if (inv.length > 0) {
        html += '<div class="item-use-label">Use item:</div>';
        inv.forEach(function (itemKey) {
          var it = ITEMS[itemKey];
          if (!it) return;
          html += '<button class="btn-item" data-use-item="' + itemKey + '" title="' + it.desc + '">'
               + it.icon + ' ' + it.name + '</button>';
        });
      }
      itemBtnArea.innerHTML = html;

      /* Attach listeners */
      itemBtnArea.querySelectorAll('[data-use-item]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = this.dataset.useItem;
          useItem(curUser, key);
        });
      });
    }

    function useItem(uid, itemKey) {
      var inv = gameState[uid].inventory;
      var idx = inv.indexOf(itemKey);
      if (idx === -1) return;
      inv.splice(idx, 1);

      if (itemKey === 'herb') {
        gameState[uid].skip_hazard = true;
        setNarrative('🌿 Herb used! Your next trap or hazard is blocked.');
        updatePlayerCards();
        updateItemButtons();
      } else if (itemKey === 'crystal') {
        showCrystalPeek(uid);
      } else if (itemKey === 'spark') {
        /* Mark that next roll gets two dice */
        gameState[uid]._sparkActive = true;
        setNarrative('⚡ Spark ready! Your next roll will pick the better of two dice.');
        updatePlayerCards();
        updateItemButtons();
      }
      syncInventoryToServer(uid);
    }

    function showCrystalPeek(uid) {
      if (!peekOverlay) return;
      var pos  = gameState[uid].pos;
      var pc   = gameState[uid].path_choice;
      var html = '<div class="peek-title">🔮 Crystal Vision — Next 3 Tiles</div><div class="peek-tiles">';
      for (var pi = 1; pi <= 3; pi++) {
        var ppos  = advancePos(pos, pi, pc || 'forest');
        var ptype = getTileType(ppos, pc);
        html += '<div class="peek-tile"><div class="peek-num">Tile ' + ppos + '</div>'
              + '<div class="peek-icon">' + ptype.label + '</div>'
              + '<div class="peek-name">' + ptype.desc + '</div></div>';
      }
      html += '</div><button class="btn-game btn-game--secondary" id="peekCloseBtn">Close</button>';
      peekOverlay.innerHTML = html;
      peekOverlay.classList.add('peek-visible');
      document.getElementById('peekCloseBtn').addEventListener('click', function () {
        peekOverlay.classList.remove('peek-visible');
      });
    }

    function syncInventoryToServer(uid) {
      gamePost('game/move', {
        user_id: uid,
        sync_inventory: true,
        inventory: gameState[uid].inventory,
        skip_hazard: gameState[uid].skip_hazard,
      }).catch(function () {});
    }

    /* ── 18. DICE UI ────────────────────────────────── */
    function showDiceResult(num) {
      if (!diceEl) return;
      diceEl.textContent = num;
      diceEl.classList.remove('dice-rolling', 'dice-landed');
      diceEl.style.display = 'flex';
      void diceEl.offsetWidth;
      diceEl.classList.add('dice-landed');
    }

    function setRollBtnEnabled(enabled) {
      if (!rollBtn) return;
      if (enabled) {
        rollBtn.classList.remove('btn-disabled');
        rollBtn.disabled = false;
      } else {
        rollBtn.classList.add('btn-disabled');
        rollBtn.disabled = true;
      }
    }

    /* ── 19. CAMERA TWEEN ───────────────────────────── */
    function tweenCameraTo(tx, ty, tz, dur) {
      camTween = {
        duration: dur, elapsed: 0,
        startX: camera.position.x, startY: camera.position.y, startZ: camera.position.z,
        targetX: tx, targetY: ty, targetZ: tz,
      };
    }

    function updateCameraTween(dt) {
      if (!camTween) return;
      camTween.elapsed += dt;
      var t = Math.min(1, camTween.elapsed / camTween.duration);
      var ease = 1 - Math.pow(1 - t, 3);
      camera.position.x = camTween.startX + (camTween.targetX - camTween.startX) * ease;
      camera.position.y = camTween.startY + (camTween.targetY - camTween.startY) * ease;
      camera.position.z = camTween.startZ + (camTween.targetZ - camTween.startZ) * ease;
      camera.lookAt(0, 0, 0);
      if (t >= 1) camTween = null;
    }

    /* ── 20. TOKEN MOVE ANIMATION ───────────────────── */
    function getTokenWorldPos(logicalPos, pathChoice, offset) {
      var tp = getWorldPos(logicalPos, pathChoice);
      var ox = (offset || 0) * 0.5;
      return { x: tp.x + ox, y: tp.y + 0.2, z: tp.z };
    }

    function snapTokenToTile(mesh, logicalPos, pathChoice, offset) {
      var wp = getTokenWorldPos(logicalPos, pathChoice, offset);
      mesh.position.set(wp.x, wp.y, wp.z);
      mesh._baseY = wp.y;
    }

    function animateMoveToken(mesh, fromPos, toPos, pathChoice, offset, onDone) {
      var steps = [];
      var cur = fromPos;
      var dir = fromPos <= toPos ? 1 : -1;
      for (var s = fromPos; s !== toPos; s += dir) {
        steps.push(s + dir);
      }
      if (steps.length === 0) { if (onDone) onDone(); return; }

      tokenAnim = {
        mesh: mesh, steps: steps, pathChoice: pathChoice,
        stepIdx: 0, stepT: 0, stepDuration: 0.38, offset: offset, onDone: onDone,
        fromWP: getTokenWorldPos(fromPos, pathChoice, offset),
        toWP:   getTokenWorldPos(steps[0], pathChoice, offset),
      };
    }

    function updateTokenAnim(dt) {
      if (!tokenAnim) return;
      var a = tokenAnim;
      a.stepT += dt;
      var t = Math.min(1, a.stepT / a.stepDuration);
      var ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      var arcY = Math.sin(t * Math.PI) * 1.5;
      a.mesh.position.set(
        a.fromWP.x + (a.toWP.x - a.fromWP.x) * ease,
        a.fromWP.y + (a.toWP.y - a.fromWP.y) * ease + arcY,
        a.fromWP.z + (a.toWP.z - a.fromWP.z) * ease
      );
      if (t > 0.9) a.mesh.scale.y = Math.max(0.7, 1-(1-t)*10*0.3);
      else a.mesh.scale.y = 1;

      if (t >= 1) {
        a.mesh.position.set(a.toWP.x, a.toWP.y, a.toWP.z);
        a.mesh.scale.y = 1;
        a.stepIdx++;
        if (a.stepIdx >= a.steps.length) {
          a.mesh._baseY = a.toWP.y;
          tokenAnim = null;
          if (a.onDone) a.onDone();
        } else {
          a.fromWP = a.toWP;
          a.toWP   = getTokenWorldPos(a.steps[a.stepIdx], a.pathChoice, a.offset);
          a.stepT  = 0;
        }
      }
    }

    /* ── 21. DICE ROLL ANIMATION ────────────────────── */
    function startDiceRoll(resultNum) {
      diceResult   = resultNum;
      diceRolling  = true;
      diceRollT    = 0;
      diceMesh.visible = true;
      var curPos = MAIN_POSITIONS[Math.min(7, gameState[gameState.currentTurn].pos)];
      diceMesh.position.set(curPos.x + 1.5, curPos.y + 2.5, curPos.z);
      if (diceEl) {
        diceEl.textContent = '🎲';
        diceEl.classList.add('dice-rolling');
        diceEl.style.display = 'flex';
      }
    }

    function updateDiceAnim(dt) {
      if (!diceRolling) return;
      diceRollT += dt;
      diceMesh.rotation.x += dt * (8 + Math.random() * 6);
      diceMesh.rotation.y += dt * (6 + Math.random() * 8);
      diceMesh.rotation.z += dt * (5 + Math.random() * 4);
      if (diceRollT >= diceRollDuration) {
        diceRolling = false;
        diceMesh.rotation.set(0, 0, 0);
        diceMesh.visible = false;
        showDiceResult(diceResult);
        processDiceResult(diceResult);
      }
    }

    /* ── 22. ITEM COLLECTION ────────────────────────── */
    function giveRandomItem(uid) {
      var inv = gameState[uid].inventory;
      if (inv.length >= 3) {
        setNarrative('🎒 Inventory full! You couldn\'t carry the item.');
        return;
      }
      var keys = Object.keys(ITEMS);
      var pick = keys[Math.floor(Math.random() * keys.length)];
      inv.push(pick);
      setNarrative(getNarrative(uid, 'meadow', 'item') + ' Got: ' + ITEMS[pick].icon + ' ' + ITEMS[pick].name + '!');
      updatePlayerCards();
      updateItemButtons();
      syncInventoryToServer(uid);
    }

    /* ── 23. WARP TILE ──────────────────────────────── */
    function applyWarp(uid, fromPos) {
      var pc  = gameState[uid].path_choice;
      var warpDist = 3 + Math.floor(Math.random() * 3); /* 3-5 */
      var toPos = advancePos(fromPos, warpDist, pc);
      setNarrative(getNarrative(uid, 'star', 'warp') + ' Warped ' + warpDist + ' tiles!');
      var mesh   = uid === 'raphael' ? raphael3D : taylor3D;
      var offset = uid === 'raphael' ? -0.35 : 0.35;
      animateMoveToken(mesh, fromPos, toPos, pc, offset, function () {
        gameState[uid].pos = toPos;
        afterMove(uid, toPos, null, true);
      });
    }

    /* ── 24. TRAP TILE ──────────────────────────────── */
    function applyTrap(uid, pos) {
      var pc = gameState[uid].path_choice;
      if (gameState[uid].skip_hazard) {
        gameState[uid].skip_hazard = false;
        setNarrative('🛡️ Your shield blocked the trap!');
        updatePlayerCards();
        endTurn(uid);
        return;
      }
      var fallback = 1 + Math.floor(Math.random() * 3); /* 1-3 back */
      var newPos = Math.max(0, pos - fallback);
      setNarrative(getNarrative(uid, getBiomeFromPos(pos, pc), 'trap') + ' Fell back ' + fallback + ' tiles!');
      var mesh   = uid === 'raphael' ? raphael3D : taylor3D;
      var offset = uid === 'raphael' ? -0.35 : 0.35;
      animateMoveToken(mesh, pos, newPos, pc, offset, function () {
        gameState[uid].pos = newPos;
        endTurn(uid);
      });
    }

    /* ── 25. CHALLENGE MODAL ────────────────────────── */
    function showChallengeModal(uid, challengeIdx) {
      if (!challengeModal) return;
      var ch = CHALLENGES[challengeIdx % CHALLENGES.length];
      var inv = gameState[uid].inventory;
      var html = '<div class="modal-title">⚔️ Challenge!</div>';
      html += '<div class="modal-text">' + ch.text + '</div>';
      html += '<div class="modal-detail">' + ch.detail + '</div>';
      html += '<div class="modal-choices">';
      ch.options.forEach(function (opt) {
        var disabled = (opt.requiresItem && inv.length === 0) ? ' disabled' : '';
        var dis2 = opt.requiresItem && inv.length === 0 ? ' btn-disabled' : '';
        html += '<button class="btn-challenge' + dis2 + '" data-action="' + opt.action + '"' + disabled + '>' + opt.label + '</button>';
      });
      html += '</div>';
      challengeModal.innerHTML = html;
      challengeModal.classList.add('modal-visible');

      challengeModal.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var action = this.dataset.action;
          challengeModal.classList.remove('modal-visible');
          resolveChallengeAction(uid, action);
        });
      });
    }

    function resolveChallengeAction(uid, action) {
      var pos = gameState[uid].pos;
      var pc  = gameState[uid].path_choice;
      var mesh   = uid === 'raphael' ? raphael3D : taylor3D;
      var offset = uid === 'raphael' ? -0.35 : 0.35;

      if (action === 'challenge_safe') {
        var safePos = advancePos(pos, 1, pc);
        setNarrative('← Safe path taken. +1 tile.');
        animateMoveToken(mesh, pos, safePos, pc, offset, function () {
          gameState[uid].pos = safePos;
          endTurn(uid);
        });
      } else if (action === 'challenge_risky') {
        var roll = Math.floor(Math.random() * 6) + 1;
        if (roll >= 4) {
          var riskyPos = advancePos(pos, 3, pc);
          setNarrative('→ Risk paid off! Roll ' + roll + ' → +3 tiles!');
          animateMoveToken(mesh, pos, riskyPos, pc, offset, function () {
            gameState[uid].pos = riskyPos;
            endTurn(uid);
          });
        } else {
          var backPos = Math.max(0, pos - 2);
          setNarrative('→ Too risky! Roll ' + roll + ' → back 2 tiles.');
          animateMoveToken(mesh, pos, backPos, pc, offset, function () {
            gameState[uid].pos = backPos;
            endTurn(uid);
          });
        }
      } else if (action === 'challenge_trade') {
        var inv = gameState[uid].inventory;
        if (inv.length > 0) {
          inv.splice(0, 1); /* Remove first item */
          syncInventoryToServer(uid);
          var tradePos = advancePos(pos, 3, pc);
          setNarrative('🎒 Trade accepted! +3 spaces forward.');
          animateMoveToken(mesh, pos, tradePos, pc, offset, function () {
            gameState[uid].pos = tradePos;
            endTurn(uid);
          });
        } else {
          setNarrative('No items to trade. Kept walking.');
          endTurn(uid);
        }
      } else if (action === 'challenge_walk') {
        setNarrative('Kept walking without incident.');
        endTurn(uid);
      } else if (action === 'challenge_sneak') {
        if (Math.random() >= 0.5) {
          setNarrative('🤫 Sneaked past the guardian without waking them!');
          endTurn(uid);
        } else {
          setNarrative('💤 The guardian stirred — you lose your next turn!');
          gameState[uid]._skipTurn = true;
          endTurn(uid);
        }
      } else if (action === 'challenge_reroute') {
        setNarrative('🔄 Found another route. Lose 1 turn but safe.');
        gameState[uid]._skipTurn = true;
        endTurn(uid);
      } else if (action === 'challenge_stand') {
        if (Math.random() >= 0.5) {
          var stPos = advancePos(pos, 2, pc);
          setNarrative('💪 You held firm! +2 spaces.');
          animateMoveToken(mesh, pos, stPos, pc, offset, function () {
            gameState[uid].pos = stPos;
            endTurn(uid);
          });
        } else {
          var slipPos = Math.max(0, pos - 1);
          setNarrative('💪 Ground shook too hard... -1 space.');
          animateMoveToken(mesh, pos, slipPos, pc, offset, function () {
            gameState[uid].pos = slipPos;
            endTurn(uid);
          });
        }
      } else if (action === 'challenge_retreat') {
        setNarrative('🏃 Retreated safely. No change.');
        endTurn(uid);
      } else if (action === 'challenge_riddle') {
        /* Answer is "a map" */
        var ridPos = advancePos(pos, 3, pc);
        setNarrative('🧩 Answer: A Map! The stones reward you. +3 tiles!');
        animateMoveToken(mesh, pos, ridPos, pc, offset, function () {
          gameState[uid].pos = ridPos;
          endTurn(uid);
        });
      } else {
        endTurn(uid);
      }
    }

    /* ── 26. FORK MODAL ─────────────────────────────── */
    function showForkModal(uid) {
      if (!forkModal) return;
      setNarrative(getNarrative(uid, 'forest', 'fork'));
      var html = '<div class="modal-title">🔱 Choose Your Path</div>';
      html += '<div class="modal-text">The road splits before you. Which way calls to you?</div>';
      html += '<div class="modal-choices modal-choices--fork">';
      html += '<button class="btn-fork btn-fork--mountain" data-fork="mountain">';
      html += '<div class="fork-icon">🏔️</div>';
      html += '<div class="fork-name">Mountain Pass</div>';
      html += '<div class="fork-desc">Shorter but treacherous — 4 tiles of challenges and higher rewards</div>';
      html += '</button>';
      html += '<button class="btn-fork btn-fork--forest" data-fork="forest">';
      html += '<div class="fork-icon">🌲</div>';
      html += '<div class="fork-name">Forest Trail</div>';
      html += '<div class="fork-desc">Longer but gentler — 5 tiles of rest stops and items</div>';
      html += '</button>';
      html += '</div>';
      forkModal.innerHTML = html;
      forkModal.classList.add('modal-visible');

      forkModal.querySelectorAll('[data-fork]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var choice = this.dataset.fork;
          forkModal.classList.remove('modal-visible');
          applyForkChoice(uid, choice);
        });
      });
    }

    function applyForkChoice(uid, choice) {
      gameState[uid].path_choice = choice;
      var label = choice === 'mountain' ? 'Mountain Pass 🏔️' : 'Forest Trail 🌲';
      setNarrative('You chose the ' + label + '! The path ahead shifts...');
      /* Move to tile 8 of the chosen fork */
      var mesh   = uid === 'raphael' ? raphael3D : taylor3D;
      var offset = uid === 'raphael' ? -0.35 : 0.35;
      var fromPos = MAIN_POSITIONS[7]; /* tile 7 world pos */
      var toWP   = getTokenWorldPos(8, choice, offset);
      /* Animate directly to fork tile 8 */
      tokenAnim = null;
      gameState[uid].pos = 8;
      snapTokenToTile(mesh, 8, choice, offset);

      /* Camera pans toward chosen path */
      if (choice === 'mountain') tweenCameraTo(-1, 16, 18, 1.2);
      else tweenCameraTo(0, 16, 20, 1.2);

      updatePlayerCards();
      gamePost('game/move', { user_id: uid, path_choice: choice, new_pos: 8 }).catch(function () {});

      /* Apply tile 8 effect after a short pause */
      setTimeout(function () {
        isAnimating = false;
        applyTileEffect(uid, 8);
      }, 600);
    }

    /* ── 27. SPARK ROLL AGAIN ───────────────────────── */
    function showSparkRollAgain(uid, roll1, roll2) {
      if (!sparkBtnWrap) return;
      gameState.pendingSparkRoll = { uid: uid, roll1: roll1, roll2: roll2 };
      var html = '<div class="spark-info">⚡ Spark — pick your roll:</div>';
      html += '<div class="spark-rolls">';
      html += '<button class="btn-spark" data-roll="' + roll1 + '">Roll 1: ' + roll1 + '</button>';
      html += '<button class="btn-spark" data-roll="' + roll2 + '">Roll 2: ' + roll2 + '</button>';
      html += '</div>';
      sparkBtnWrap.innerHTML = html;
      sparkBtnWrap.style.display = 'flex';

      sparkBtnWrap.querySelectorAll('[data-roll]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var chosen = parseInt(this.dataset.roll);
          sparkBtnWrap.style.display = 'none';
          sparkBtnWrap.innerHTML = '';
          gameState.pendingSparkRoll = null;
          processRollWithSteps(uid, chosen);
        });
      });
    }

    /* ── 28. TILE EFFECT PROCESSOR ──────────────────── */
    function applyTileEffect(uid, pos) {
      var pc      = gameState[uid].path_choice;
      var ttype   = getTileType(pos, pc);
      var biome   = getBiomeFromPos(pos, pc);
      var tileKey = getTileTypeKey(pos, pc);

      /* Skip hazard shield check for trap */
      if (ttype.type === 'trap' && gameState[uid].skip_hazard) {
        gameState[uid].skip_hazard = false;
        setNarrative('🛡️ Your herb shielded you from the trap!');
        updatePlayerCards();
        endTurn(uid);
        return;
      }

      switch (ttype.type) {
        case 'item':
          giveRandomItem(uid);
          endTurn(uid);
          break;
        case 'rest':
          gameState[uid].skip_hazard = true;
          setNarrative(getNarrative(uid, biome, 'rest'));
          updatePlayerCards();
          endTurn(uid);
          break;
        case 'warp':
          isAnimating = true;
          applyWarp(uid, pos);
          break;
        case 'trap':
          isAnimating = true;
          applyTrap(uid, pos);
          break;
        case 'challenge':
          var cIdx = Math.floor(Math.random() * CHALLENGES.length);
          gameState.pendingChallenge = { uid: uid, challengeIdx: cIdx };
          setNarrative(getNarrative(uid, biome, 'challenge'));
          isAnimating = false; /* Allow UI interaction */
          showChallengeModal(uid, cIdx);
          break;
        case 'fork':
          gameState.pendingFork = { uid: uid };
          isAnimating = false;
          showForkModal(uid);
          break;
        case 'finish':
          gameState[uid].pos = 24;
          checkWin(uid);
          break;
        case 'story':
        default:
          setNarrative(getNarrative(uid, biome, null));
          endTurn(uid);
          break;
      }
    }

    /* ── 29. PROCESS DICE RESULT ────────────────────── */
    function processDiceResult(roll) {
      processRollWithSteps(gameState.currentTurn, roll);
    }

    function processRollWithSteps(uid, roll) {
      var oldPos = gameState[uid].pos;
      var pc     = gameState[uid].path_choice;
      var newPos = advancePos(oldPos, roll, pc || 'forest');

      /* If we were at/past fork but haven't chosen, clamp to fork */
      if (oldPos === 7) {
        /* Shouldn't normally happen; fork modal intercepts */
        gameState.pendingFork = { uid: uid };
        showForkModal(uid);
        return;
      }

      var mesh   = uid === 'raphael' ? raphael3D : taylor3D;
      var offset = uid === 'raphael' ? -0.35 : 0.35;
      isAnimating = true;
      setRollBtnEnabled(false);

      /* Camera follow */
      var wp = getWorldPos(newPos, pc || 'forest');
      tweenCameraTo(wp.x * 0.25, 16, 20 + wp.z * 0.25, 1.2);

      animateMoveToken(mesh, oldPos, newPos, pc || 'forest', offset, function () {
        gameState[uid].pos = newPos;

        /* If this is the fork tile, show modal before ending */
        if (newPos === FORK_TILE) {
          isAnimating = false;
          setNarrative(getNarrative(uid, 'forest', 'fork'));
          showForkModal(uid);
          return;
        }

        /* Apply tile effect */
        applyTileEffect(uid, newPos);
      });
    }

    /* ── 30. END TURN ───────────────────────────────── */
    function endTurn(uid) {
      isAnimating = false;
      gameState.pendingChallenge = null;
      gameState.pendingFork      = null;

      /* Pulse landing tile */
      var pos = gameState[uid].pos;
      var pc  = gameState[uid].path_choice;
      /* Find the correct tile mesh */
      var landedMesh = null;
      if (pos <= 7) landedMesh = tileMeshMap['main_' + pos];
      else if (pos < 15 && pc === 'mountain') landedMesh = tileMeshMap['upper_' + (pos - 8)];
      else if (pos < 15) landedMesh = tileMeshMap['lower_' + (pos - 8)];
      else landedMesh = tileMeshMap['merge_' + (pos - 15)];
      if (landedMesh) {
        var origY = landedMesh._baseY;
        landedMesh._baseY = origY + 0.25;
        setTimeout(function () { landedMesh._baseY = origY; }, 600);
      }

      if (!checkWin(uid)) {
        /* Handle skip turn */
        var nextUid = uid === 'raphael' ? 'taylor' : 'raphael';
        if (gameState[nextUid]._skipTurn) {
          gameState[nextUid]._skipTurn = false;
          setNarrative((nextUid === 'raphael' ? 'Raphael' : 'Taylor') + ' loses their turn!');
          gameState.currentTurn = uid; /* Stay with same player */
        } else {
          gameState.currentTurn = nextUid;
        }
        updateTurnBanner(gameState.currentTurn);
        updatePlayerCards();
        updateItemButtons();

        var curUser = getCurrentUser();
        setRollBtnEnabled(curUser === gameState.currentTurn);
      }

      /* Save state */
      gamePost('game/move', {
        user_id: uid,
        sync_state: true,
        raphael_pos: gameState.raphael.pos,
        taylor_pos: gameState.taylor.pos,
        current_turn: gameState.currentTurn,
        raphael_path: gameState.raphael.path_choice,
        taylor_path: gameState.taylor.path_choice,
        raphael_inventory: gameState.raphael.inventory,
        taylor_inventory: gameState.taylor.inventory,
      }).catch(function () {});
    }

    /* ── 31. WIN DETECTION ──────────────────────────── */
    function checkWin(uid) {
      if (gameState[uid].pos >= 24) {
        gameState[uid].pos = 24;
        gameState.winner = uid;
        setNarrative(getNarrative(uid, 'star', 'win'));
        if (winOverlay) {
          var wn = winOverlay.querySelector('.win-name');
          if (wn) wn.textContent = uid === 'raphael' ? 'Raphael 🌻' : 'Taylor 🌿';
          winOverlay.classList.add('win-visible');
        }
        spawnWinParticles();
        setRollBtnEnabled(false);
        updatePlayerCards();
        return true;
      }
      return false;
    }

    /* ── 32. WIN PARTICLES ──────────────────────────── */
    function spawnWinParticles() {
      var colors = [0xffd700, 0xff6b9d, 0x7ec850, 0xffffff, 0xc2623a];
      for (var wpi = 0; wpi < 50; wpi++) {
        var geo  = new THREE.SphereGeometry(0.06, 5, 5);
        var mat  = new THREE.MeshPhongMaterial({ color: colors[wpi % colors.length], emissive: colors[wpi % colors.length], emissiveIntensity: 0.5 });
        var mesh = new THREE.Mesh(geo, mat);
        var angle = Math.random() * Math.PI * 2;
        mesh.position.set(0, 2, 0);
        mesh._vel = { x: Math.cos(angle)*(1+Math.random()*3), y: 2+Math.random()*5, z: Math.sin(angle)*(1+Math.random()*3) };
        mesh._life = 3 + Math.random();
        mesh._maxLife = mesh._life;
        scene.add(mesh);
        winParticles.push(mesh);
      }
    }

    function updateWinParticles(dt) {
      for (var wi = winParticles.length - 1; wi >= 0; wi--) {
        var wp = winParticles[wi];
        wp._life -= dt;
        wp._vel.y -= 4 * dt;
        wp.position.x += wp._vel.x * dt;
        wp.position.y += wp._vel.y * dt;
        wp.position.z += wp._vel.z * dt;
        wp.material.opacity = Math.max(0, wp._life / wp._maxLife);
        wp.material.transparent = true;
        if (wp._life <= 0) { scene.remove(wp); wp.geometry.dispose(); wp.material.dispose(); winParticles.splice(wi, 1); }
      }
    }

    /* ── 33. API SYNC ───────────────────────────────── */
    function applyServerState(data) {
      if (!data) return;
      var gs = data.gameState || data;
      if (!gs) return;

      if (gs.raphael !== undefined) gameState.raphael.pos = Math.max(0, Math.min(24, gs.raphael || 0));
      if (gs.taylor  !== undefined) gameState.taylor.pos  = Math.max(0, Math.min(24, gs.taylor  || 0));
      if (gs.currentTurn) gameState.currentTurn = gs.currentTurn;
      if (gs.winner) gameState.winner = gs.winner;
      if (gs.raphaelPts !== undefined) gameState.raphael.pts = gs.raphaelPts || 0;
      if (gs.taylorPts  !== undefined) gameState.taylor.pts  = gs.taylorPts  || 0;
      if (gs.raphael_path) gameState.raphael.path_choice = gs.raphael_path;
      if (gs.taylor_path)  gameState.taylor.path_choice  = gs.taylor_path;
      if (gs.raphael_inventory) gameState.raphael.inventory = gs.raphael_inventory;
      if (gs.taylor_inventory)  gameState.taylor.inventory  = gs.taylor_inventory;

      if (!isAnimating && !tokenAnim) {
        snapTokenToTile(raphael3D, gameState.raphael.pos, gameState.raphael.path_choice || 'forest', -0.35);
        snapTokenToTile(taylor3D,  gameState.taylor.pos,  gameState.taylor.path_choice  || 'forest',  0.35);
      }

      updateTurnBanner(gameState.currentTurn);
      updatePlayerCards();
      updateItemButtons();

      if (gameState.winner) {
        setRollBtnEnabled(false);
        if (winOverlay && !winOverlay.classList.contains('win-visible')) {
          var wn = winOverlay.querySelector('.win-name');
          if (wn) wn.textContent = gameState.winner === 'raphael' ? 'Raphael 🌻' : 'Taylor 🌿';
          winOverlay.classList.add('win-visible');
        }
      } else {
        var curUser = getCurrentUser();
        setRollBtnEnabled(curUser === gameState.currentTurn && !isAnimating);
      }
    }

    function loadGameState() {
      gameGet().then(function (data) {
        applyServerState(data);
      }).catch(function (e) {
        console.warn('[WanderingPath v3] Could not load game state:', e.message);
        snapTokenToTile(raphael3D, 0, 'forest', -0.35);
        snapTokenToTile(taylor3D,  0, 'forest',  0.35);
        updateTurnBanner('raphael');
        updatePlayerCards();
        updateItemButtons();
        setRollBtnEnabled(true);
      });
    }

    /* Poll every 5 seconds */
    setInterval(function () {
      if (!isAnimating && !diceRolling) {
        gameGet().then(function (data) { applyServerState(data); }).catch(function () {});
      }
    }, 5000);

    /* ── 34. ROLL BUTTON ────────────────────────────── */
    if (rollBtn) {
      rollBtn.addEventListener('click', function () {
        if (gameState.rolling || isAnimating || diceRolling || gameState.winner) return;
        if (gameState.pendingChallenge || gameState.pendingFork || gameState.pendingSparkRoll) return;
        var curUser = getCurrentUser();
        if (curUser !== gameState.currentTurn) {
          setNarrative('It\'s ' + (gameState.currentTurn === 'raphael' ? 'Raphael\'s' : 'Taylor\'s') + ' turn!');
          return;
        }
        gameState.rolling = true;
        setRollBtnEnabled(false);
        updateItemButtons();

        var sparkActive = gameState[curUser]._sparkActive;
        if (sparkActive) { gameState[curUser]._sparkActive = false; }

        gamePost('game/move', { user_id: curUser }).then(function (data) {
          gameState.rolling = false;
          var roll = (data && data.roll) ? data.roll : Math.floor(Math.random() * 6) + 1;
          if (sparkActive) {
            var roll2 = Math.floor(Math.random() * 6) + 1;
            setNarrative('⚡ Spark! Rolled ' + roll + ' and ' + roll2 + '. Choose one!');
            showSparkRollAgain(curUser, roll, roll2);
            if (data) applyServerState(data);
          } else {
            startDiceRoll(roll);
            if (data) applyServerState(data);
          }
        }).catch(function () {
          gameState.rolling = false;
          var roll = Math.floor(Math.random() * 6) + 1;
          if (sparkActive) {
            var roll2 = Math.floor(Math.random() * 6) + 1;
            setNarrative('⚡ Spark! Rolled ' + roll + ' and ' + roll2 + '. Choose one!');
            showSparkRollAgain(curUser, roll, roll2);
          } else {
            startDiceRoll(roll);
          }
        });
      });
    }

    /* ── 35. RESET BUTTON ───────────────────────────── */
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (isAnimating) return;
        gamePost('game/move', { user_id: 'raphael', reset: true }).then(function (data) {
          resetLocal();
          if (data) applyServerState(data);
        }).catch(function () { resetLocal(); });
      });
    }

    function resetLocal() {
      gameState.raphael = { pos: 0, pts: 0, inventory: [], path_choice: null, skip_hazard: false };
      gameState.taylor  = { pos: 0, pts: 0, inventory: [], path_choice: null, skip_hazard: false };
      gameState.currentTurn = 'raphael';
      gameState.winner   = null;
      gameState.rolling  = false;
      gameState.pendingChallenge = null;
      gameState.pendingFork      = null;
      gameState.pendingSparkRoll = null;
      isAnimating  = false;
      tokenAnim    = null;
      diceRolling  = false;
      diceMesh.visible = false;

      if (forkModal)    forkModal.classList.remove('modal-visible');
      if (challengeModal) challengeModal.classList.remove('modal-visible');
      if (sparkBtnWrap) { sparkBtnWrap.style.display='none'; sparkBtnWrap.innerHTML=''; }
      if (peekOverlay)  peekOverlay.classList.remove('peek-visible');
      if (diceEl)       { diceEl.textContent=''; diceEl.style.display='none'; }
      if (winOverlay)   winOverlay.classList.remove('win-visible');

      winParticles.forEach(function (wp) { scene.remove(wp); wp.geometry.dispose(); wp.material.dispose(); });
      winParticles.length = 0;

      snapTokenToTile(raphael3D, 0, 'forest', -0.35);
      snapTokenToTile(taylor3D,  0, 'forest',  0.35);

      updateTurnBanner('raphael');
      updatePlayerCards();
      updateItemButtons();
      setNarrative('The wandering path awaits...');
      setRollBtnEnabled(true);
      tweenCameraTo(0, 18, 22, 1.0);
    }

    /* ── 36. ANIMATION LOOP ─────────────────────────── */
    var elapsedTotal = 0;

    function animate() {
      requestAnimationFrame(animate);
      renderer.info.reset();
      var dt = Math.min(clock.getDelta(), 0.1);
      elapsedTotal += dt;

      /* Token idle bob */
      if (!tokenAnim) {
        raphael3D.position.y = raphael3D._baseY + Math.sin(elapsedTotal * 2.0) * 0.12;
        taylor3D.position.y  = taylor3D._baseY  + Math.sin(elapsedTotal * 2.0 + 1) * 0.12;
      }

      updateTokenAnim(dt);
      updateDiceAnim(dt);
      updateCameraTween(dt);
      updateWinParticles(dt);

      /* Tile gentle oscillation */
      allTileMeshes.forEach(function (tile, i) {
        tile.position.y = tile._baseY + Math.sin(elapsedTotal * 0.8 + i * 0.28) * 0.02;
      });

      /* Special rings pulse */
      specialRings.forEach(function (ring) {
        ring._phase += dt * 1.5;
        var s = 0.9 + Math.sin(ring._phase) * 0.14;
        ring.scale.set(s, s, s);
        ring.material.opacity = 0.4 + Math.sin(ring._phase) * 0.32;
        ring.position.y += Math.sin(ring._phase * 0.7) * dt * 0.08;
        ring.position.y = Math.max(ring.position.y, -5); /* clamp from drifting */
      });

      if (starPoints) starPoints.rotation.y += dt * 0.05;

      if (dustParticles) {
        dustParticles.rotation.y += dt * 0.02;
        var dp2 = dustParticles.geometry.attributes.position.array;
        for (var dpi = 0; dpi < dp2.length; dpi += 3) {
          dp2[dpi + 1] += Math.sin(elapsedTotal * 0.5 + dpi) * dt * 0.15;
          if (dp2[dpi + 1] > 7) dp2[dpi + 1] = 0.3;
        }
        dustParticles.geometry.attributes.position.needsUpdate = true;
      }

      if (purpleLight) purpleLight.intensity = 0.6 + Math.sin(elapsedTotal * 0.5) * 0.15;
      if (amberLight)  amberLight.intensity  = 0.4 + Math.sin(elapsedTotal * 0.7 + 1) * 0.1;

      decoGroup.children.forEach(function (ch) {
        if (ch._floatPhase !== undefined) {
          ch.position.y += Math.sin(elapsedTotal * 1.2 + ch._floatPhase) * dt * 0.3;
        }
      });

      renderer.render(scene, camera);
    }

    /* ── 37. RESIZE HANDLER ─────────────────────────── */
    function onResize() {
      var w = canvasWrap.clientWidth;
      var h = canvasWrap.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    window.addEventListener('resize', onResize);
    onResize();

    /* ── 38. START ──────────────────────────────────── */
    setNarrative('The wandering path awaits...');
    updateTurnBanner('raphael');
    updatePlayerCards();
    updateItemButtons();
    snapTokenToTile(raphael3D, 0, 'forest', -0.35);
    snapTokenToTile(taylor3D,  0, 'forest',  0.35);
    loadGameState();
    animate();

    /* Debug helpers */
    window.renderGameToText = function () {
      return JSON.stringify({
        currentTurn: gameState.currentTurn,
        raphael: gameState.raphael,
        taylor: gameState.taylor,
        winner: gameState.winner || null,
        rolling: gameState.rolling || diceRolling,
        animating: isAnimating,
      }, null, 2);
    };

    window.advanceTime = function (ms) {
      var steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (var i = 0; i < steps; i++) {
        var fdt = 1 / 60;
        elapsedTotal += fdt;
        updateTokenAnim(fdt);
        updateDiceAnim(fdt);
        updateCameraTween(fdt);
      }
      renderer.render(scene, camera);
    };

  } /* end init() */

  /* ── BOOT ─────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
