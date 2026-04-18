(function () {
  'use strict';

  /* =========================================================
     THE WANDERING PATH v2 — 3D Mario Party Edition
     Three.js board game for Soul Safety (Raphael & Taylor)
  ========================================================= */

  /* ── 1. CONSTANTS ─────────────────────────────────────── */
  const BOARD_SIZE = 20;

  const BIOME_COLORS = {
    meadow:   { hex: '#7ec850', three: 0x7ec850, dark: 0x5aa835 },
    forest:   { hex: '#2d5c23', three: 0x2d5c23, dark: 0x1e3e18 },
    mountain: { hex: '#8b9eb7', three: 0x8b9eb7, dark: 0x6a7f99 },
    star:     { hex: '#1a0a3e', three: 0x1a0a3e, dark: 0x0d051f },
  };

  const SPECIAL = {
    5:  { type: 'bonus',  label: '⭐', desc: '+2 Forward',     color: 0xffd700 },
    9:  { type: 'hazard', label: '🌀', desc: 'Slip back 2',    color: 0x9c27b0 },
    10: { type: 'rest',   label: '☕', desc: 'Rest stop',      color: 0xff8a65 },
    15: { type: 'bonus',  label: '⭐', desc: '+2 Forward',     color: 0xffd700 },
    17: { type: 'hazard', label: '🌀', desc: 'Slip back 2',    color: 0x7b1fa2 },
    19: { type: 'finish', label: '🏁', desc: 'Enlightenment!', color: 0xff6b9d },
  };

  const NARRATIVES = {
    raphael: {
      meadow:   ['Raphael wandered through sun-dappled meadows...', 'A butterfly landed on Raphael\'s shoulder.', 'Raphael picked a wildflower along the way.', 'The golden meadow stretched wide before Raphael.', 'Raphael hummed softly as the grass swayed.'],
      forest:   ['Raphael stepped under the ancient canopy.', 'Sunlight flickered through the forest leaves.', 'Raphael found a glowing mushroom ring!', 'The forest whispered old secrets.', 'Raphael traced moss on a weathered oak.'],
      mountain: ['Raphael climbed toward the misty peaks.', 'Cold wind swept across the rocky ridge.', 'Raphael paused to admire the view below.', 'Snow dusted the stones at Raphael\'s feet.', 'The mountain air was impossibly clear.'],
      star:     ['Raphael floated into the starfield...', 'Nebulae swirled in violet hues around Raphael.', 'A shooting star streaked past!', 'Raphael felt weightless among the cosmos.', 'The universe hummed with quiet wonder.'],
      bonus:    ['🌟 A golden light surrounded Raphael! +2 spaces!', '✨ Raphael found a sunflower shrine — blessed forward!'],
      hazard:   ['🌀 Raphael got tangled in a time eddy! Slipped back...', '💨 A mischievous wind swept Raphael backward!'],
      rest:     ['☕ Raphael settled by the campfire for a warm rest.'],
      win:      ['🌻 Raphael reached enlightenment! The sunflower blooms eternal!'],
    },
    taylor: {
      meadow:   ['Taylor skipped through the bright green meadow.', 'A monarch butterfly danced ahead of Taylor.', 'Taylor braided clover as they walked.', 'The meadow smelled of rain and clover.'],
      forest:   ['Taylor disappeared into the verdant forest.', 'Ancient trees towered around Taylor.', 'Taylor spotted a hidden fairy door!', 'The forest floor was soft with fallen leaves.'],
      mountain: ['Taylor scaled the craggy mountain path.', 'Pebbles skittered as Taylor climbed higher.', 'Taylor found an eagle\'s feather on the ledge.', 'Snow crunched softly underfoot.'],
      star:     ['Taylor drifted through the cosmic starfield...', 'Stars spiraled into shapes around Taylor.', 'A meteor shower painted the dark!', 'Taylor felt infinity pressing gently close.'],
      bonus:    ['🌿 A sacred grove bestowed its gift on Taylor! +2 spaces!', '✨ Taylor uncovered a hidden shortcut through the leaves!'],
      hazard:   ['🌀 Taylor stepped into a swirling anomaly! Back they go...', '💫 The forest floor shifted — Taylor slipped back!'],
      rest:     ['☕ Taylor found the hearthstone clearing — time to rest.'],
      win:      ['🌿 Taylor reached the cosmic clearing — enlightenment achieved!'],
    },
  };

  /* Tile world positions (x, z, y-elevation) */
  const TILE_POSITIONS = (function () {
    var pos = [];
    /* Meadow 0–4: z=6, x: -5.6 to 5.6 step 2.8 */
    for (var i = 0; i <= 4; i++) {
      pos.push({ x: -5.6 + i * 2.8, z: 6.0, y: 0, biome: 'meadow' });
    }
    /* Forest 5–9: x=5.6, z: 3.2 to -5.6 step -2.2, y rises 0→2 */
    for (var j = 0; j <= 4; j++) {
      pos.push({ x: 5.6, z: 3.2 - j * 2.2, y: j * 0.5, biome: 'forest' });
    }
    /* Mountain 10–14: z=-6, x: 5.6 to -5.6 step -2.8, y: 2.5→3.5 (peaked) */
    for (var k = 0; k <= 4; k++) {
      var pk = k === 2 ? 3.5 : 2.5 + k * 0.25;
      pos.push({ x: 5.6 - k * 2.8, z: -6.0, y: pk, biome: 'mountain' });
    }
    /* Starfield 15–19: x=-5.6, z: -3.2 to 5.6 step 2.2, y: 2.8→0.5 */
    for (var m = 0; m <= 4; m++) {
      pos.push({ x: -5.6, z: -3.2 + m * 2.2, y: 2.8 - m * 0.575, biome: 'star' });
    }
    return pos;
  }());

  /* ── 2. API ───────────────────────────────────────────── */
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

  function getBiome(pos) {
    if (pos <= 4)  return 'meadow';
    if (pos <= 9)  return 'forest';
    if (pos <= 14) return 'mountain';
    return 'star';
  }

  function getNarrative(userId, biome, eventType) {
    var n = NARRATIVES[userId] || NARRATIVES.raphael;
    if (eventType === 'win')    return n.win[0];
    if (eventType === 'bonus')  return n.bonus[Math.floor(Math.random() * n.bonus.length)];
    if (eventType === 'hazard') return n.hazard[Math.floor(Math.random() * n.hazard.length)];
    if (eventType === 'rest')   return n.rest[0];
    var arr = n[biome] || n.meadow;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ── 3. THREE.JS SCENE INIT ──────────────────────────── */
  var THREE; // set from window.THREE after deferred script loads

  /* Wait for DOM before init */
  function init() {
    var gameSection = document.getElementById('gameSection');
    var canvasWrap  = document.querySelector('.wander-canvas-wrap');
    if (!canvasWrap) return;

    THREE = window.THREE;
    if (!THREE) {
      console.error('[WanderingPath3D] THREE.js not loaded');
      return;
    }

    /* Remove old canvas element */
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

    /* Scene — deeper cosmic atmosphere */
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060318);
    scene.fog = new THREE.FogExp2(0x060318, 0.022);

    /* Camera */
    var aspect = canvasWrap.clientWidth / Math.max(canvasWrap.clientHeight, 1);
    var camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 200);
    camera.position.set(0, 18, 22);
    camera.lookAt(0, 0, 0);

    /* Clock */
    var clock = new THREE.Clock();

    /* ── 4. LIGHTING ──────────────────────────────────── */
    var dirLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    dirLight.position.set(8, 20, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width  = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far  = 60;
    dirLight.shadow.camera.left   = -20;
    dirLight.shadow.camera.right  =  20;
    dirLight.shadow.camera.top    =  20;
    dirLight.shadow.camera.bottom = -20;
    scene.add(dirLight);

    var ambient = new THREE.AmbientLight(0x6080ff, 0.5);
    scene.add(ambient);

    var hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.55);
    scene.add(hemi);

    /* Colored accent lights for atmosphere */
    var purpleLight = new THREE.PointLight(0x6622aa, 0.6, 30);
    purpleLight.position.set(-8, 10, -8);
    scene.add(purpleLight);

    var amberLight = new THREE.PointLight(0xff8844, 0.4, 25);
    amberLight.position.set(8, 8, 5);
    scene.add(amberLight);

    /* ── 5. TILE LABEL CANVAS TEXTURE ───────────────── */
    function makeTileLabel(num, special) {
      var c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);
      /* background disc */
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fillStyle = special ? '#ffd700' : 'rgba(255,255,255,0.85)';
      ctx.fill();
      /* number */
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#3d2416';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(num), 32, 33);
      var tex = new THREE.CanvasTexture(c);
      return tex;
    }

    /* ── 6. BOARD TILE GENERATION ───────────────────── */
    var tiles = [];   /* THREE.Mesh references */
    var tileGroup = new THREE.Group();
    scene.add(tileGroup);

    var tileMats = {
      meadow:   new THREE.MeshPhongMaterial({ color: 0x7ec850, shininess: 30 }),
      forest:   new THREE.MeshPhongMaterial({ color: 0x2d5c23, shininess: 20 }),
      mountain: new THREE.MeshPhongMaterial({ color: 0x8b9eb7, shininess: 40 }),
      star:     new THREE.MeshPhongMaterial({ color: 0x1a0a3e, shininess: 80, emissive: 0x220055, emissiveIntensity: 0.4 }),
    };

    for (var ti = 0; ti < BOARD_SIZE; ti++) {
      var tp = TILE_POSITIONS[ti];
      var sp = SPECIAL[ti];
      var baseMat = tileMats[tp.biome].clone();

      /* Special tile emissive tinting */
      if (sp) {
        if (sp.type === 'bonus')  { baseMat.emissive = new THREE.Color(0x554400); baseMat.emissiveIntensity = 0.5; }
        if (sp.type === 'hazard') { baseMat.emissive = new THREE.Color(0x330044); baseMat.emissiveIntensity = 0.6; }
        if (sp.type === 'rest')   { baseMat.emissive = new THREE.Color(0x442200); baseMat.emissiveIntensity = 0.4; }
        if (sp.type === 'finish') { baseMat.emissive = new THREE.Color(0x440022); baseMat.emissiveIntensity = 0.7; }
      }

      /* Tile mesh */
      var tileGeo  = new THREE.BoxGeometry(2.4, 0.4, 2.4);
      var tileMesh = new THREE.Mesh(tileGeo, baseMat);
      tileMesh.position.set(tp.x, tp.y, tp.z);
      tileMesh.castShadow    = true;
      tileMesh.receiveShadow = true;
      tileMesh._tileIndex  = ti;
      tileMesh._baseY      = tp.y;
      tileMesh._biome      = tp.biome;

      /* Side trim */
      var trimGeo  = new THREE.BoxGeometry(2.45, 0.08, 2.45);
      var trimMat  = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 });
      var trimMesh = new THREE.Mesh(trimGeo, trimMat);
      trimMesh.position.y = 0.22;
      tileMesh.add(trimMesh);

      /* Number label sprite */
      var labelTex = makeTileLabel(ti, !!sp);
      var labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false });
      var labelGeo = new THREE.PlaneGeometry(0.7, 0.7);
      var labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.rotation.x = -Math.PI / 2;
      labelMesh.position.set(0, 0.22, 0);
      tileMesh.add(labelMesh);

      /* Special icon sprite */
      if (sp) {
        var iconCanvas = document.createElement('canvas');
        iconCanvas.width = 48; iconCanvas.height = 48;
        var ictx = iconCanvas.getContext('2d');
        ictx.font = '36px sans-serif';
        ictx.textAlign = 'center';
        ictx.textBaseline = 'middle';
        ictx.fillText(sp.label, 24, 26);
        var iconTex = new THREE.CanvasTexture(iconCanvas);
        var iconMat = new THREE.MeshBasicMaterial({ map: iconTex, transparent: true, depthWrite: false });
        var iconGeo = new THREE.PlaneGeometry(0.9, 0.9);
        var iconMesh = new THREE.Mesh(iconGeo, iconMat);
        iconMesh.rotation.x = -Math.PI / 2;
        iconMesh.position.set(0, 0.5, 0);
        tileMesh.add(iconMesh);
      }

      tileGroup.add(tileMesh);
      tiles.push(tileMesh);
    }

    /* ── 7. PATH CONNECTIONS (BRIDGES) ─────────────── */
    var bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);

    for (var bi = 0; bi < BOARD_SIZE - 1; bi++) {
      var a = TILE_POSITIONS[bi];
      var b = TILE_POSITIONS[bi + 1];
      var dx = b.x - a.x;
      var dz = b.z - a.z;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dz * dz + dy * dy);
      var mid = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2 + 0.02,
        z: (a.z + b.z) / 2,
      };
      var biomeC = BIOME_COLORS[a.biome];
      var brgMat = new THREE.MeshPhongMaterial({ color: biomeC.three, opacity: 0.7, transparent: true });
      var brgGeo = new THREE.BoxGeometry(0.55, 0.08, len - 0.2);
      var brgMesh = new THREE.Mesh(brgGeo, brgMat);
      brgMesh.position.set(mid.x, mid.y, mid.z);
      /* Orient along the path direction */
      brgMesh.lookAt(b.x, mid.y, b.z);
      brgMesh.receiveShadow = true;
      bridgeGroup.add(brgMesh);
    }

    /* ── 8. BIOME DECORATIONS ───────────────────────── */
    var decoGroup = new THREE.Group();
    scene.add(decoGroup);

    /* Meadow: rolling hills + wildflowers */
    (function buildMeadow() {
      var hillMat = new THREE.MeshPhongMaterial({ color: 0x5aae35, transparent: true, opacity: 0.7 });
      var hillPositions = [[-7, 0, 8], [-3.5, 0, 9], [1, 0, 9.5], [5, 0, 8]];
      hillPositions.forEach(function (hp) {
        var r = 1.8 + Math.random() * 1.2;
        var hillGeo  = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        var hillMesh = new THREE.Mesh(hillGeo, hillMat.clone());
        hillMesh.position.set(hp[0], hp[1] - 0.2, hp[2]);
        hillMesh.receiveShadow = true;
        decoGroup.add(hillMesh);
      });
      /* Wildflowers */
      for (var fi = 0; fi < 14; fi++) {
        var fx = -7 + Math.random() * 14;
        var fz = 5.5 + Math.random() * 5;
        var stemGeo  = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5);
        var stemMat  = new THREE.MeshPhongMaterial({ color: 0x4a8f30 });
        var stemMesh = new THREE.Mesh(stemGeo, stemMat);
        stemMesh.position.set(fx, 0.25, fz);
        var flowerColors = [0xff6b9d, 0xffd700, 0xff9966, 0xffffff];
        var flowerGeo  = new THREE.SphereGeometry(0.12, 6, 6);
        var flowerMat  = new THREE.MeshPhongMaterial({ color: flowerColors[fi % flowerColors.length], emissive: 0x221100, emissiveIntensity: 0.2 });
        var flowerMesh = new THREE.Mesh(flowerGeo, flowerMat);
        flowerMesh.position.y = 0.3;
        stemMesh.add(flowerMesh);
        decoGroup.add(stemMesh);
      }
    }());

    /* Forest: tall cone trees */
    (function buildForest() {
      var treeData = [
        [7.5, -1.2], [8.2, -3.0], [7.8, -4.5], [9.0, -2.0],
        [7.3, 0.5],  [8.8, -5.8], [9.5, -4.0], [7.0, -6.0],
      ];
      var greenShades = [0x1e4d14, 0x2a6620, 0x367a28, 0x1a3d10];
      treeData.forEach(function (td, idx) {
        var h = 2.5 + Math.random() * 2.5;
        var treeGroup = new THREE.Group();
        /* Trunk */
        var trunkGeo  = new THREE.CylinderGeometry(0.12, 0.18, h * 0.35, 7);
        var trunkMat  = new THREE.MeshPhongMaterial({ color: 0x5c3a1e });
        var trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
        trunkMesh.position.y = h * 0.175;
        trunkMesh.castShadow = true;
        treeGroup.add(trunkMesh);
        /* Canopy layers */
        for (var layer = 0; layer < 3; layer++) {
          var coneR = 0.9 - layer * 0.2;
          var coneH = h * 0.45;
          var coneGeo  = new THREE.ConeGeometry(coneR, coneH, 8);
          var coneMat  = new THREE.MeshPhongMaterial({ color: greenShades[(idx + layer) % greenShades.length] });
          var coneMesh = new THREE.Mesh(coneGeo, coneMat);
          coneMesh.position.y = h * (0.38 + layer * 0.22);
          coneMesh.castShadow = true;
          treeGroup.add(coneMesh);
        }
        treeGroup.position.set(td[0], 0, td[1]);
        decoGroup.add(treeGroup);
      });
    }());

    /* Mountain: rocky peaks with snow caps */
    (function buildMountain() {
      var peakData = [
        [-7.5, -6.5, 5.0], [-4, -6.8, 6.5], [0, -7.0, 7.0],
        [4, -6.8, 6.5], [7.5, -6.5, 5.5], [-2.5, -6.3, 4.5],
      ];
      peakData.forEach(function (pd) {
        var peakGroup = new THREE.Group();
        var peakH = pd[2];
        var peakGeo  = new THREE.ConeGeometry(1.1 + Math.random() * 0.5, peakH, 7);
        var peakMat  = new THREE.MeshPhongMaterial({ color: 0x708090, shininess: 5 });
        var peakMesh = new THREE.Mesh(peakGeo, peakMat);
        peakMesh.position.y = peakH / 2;
        peakMesh.castShadow = true;
        peakGroup.add(peakMesh);
        /* Snow cap */
        var snowGeo  = new THREE.SphereGeometry(0.42, 8, 6);
        var snowMat  = new THREE.MeshPhongMaterial({ color: 0xfafcff, shininess: 60 });
        var snowMesh = new THREE.Mesh(snowGeo, snowMat);
        snowMesh.position.y = peakH * 0.84;
        snowMesh.scale.y = 0.55;
        peakGroup.add(snowMesh);
        peakGroup.position.set(pd[0], 0, pd[1]);
        decoGroup.add(peakGroup);
      });
    }());

    /* Starfield: floating star particles + nebula */
    var starPoints;
    var dustParticles;
    (function buildStarfield() {
      /* Nebula: larger, more vibrant */
      var nebulaMat  = new THREE.MeshPhongMaterial({ color: 0x5a0099, emissive: 0x330066, emissiveIntensity: 1.0, transparent: true, opacity: 0.22, side: THREE.BackSide });
      var nebulaGeo  = new THREE.SphereGeometry(8, 20, 16);
      var nebulaMesh = new THREE.Mesh(nebulaGeo, nebulaMat);
      nebulaMesh.position.set(-5.6, 3, -1);
      decoGroup.add(nebulaMesh);

      /* Second nebula — amber accent */
      var nebula2Mat = new THREE.MeshPhongMaterial({ color: 0x663300, emissive: 0x442200, emissiveIntensity: 0.6, transparent: true, opacity: 0.12, side: THREE.BackSide });
      var nebula2Geo = new THREE.SphereGeometry(6, 16, 12);
      var nebula2Mesh = new THREE.Mesh(nebula2Geo, nebula2Mat);
      nebula2Mesh.position.set(5, 4, -3);
      decoGroup.add(nebula2Mesh);

      /* Star particles — MORE stars, denser field */
      var starCount = 350;
      var starGeo   = new THREE.BufferGeometry();
      var starPos   = new Float32Array(starCount * 3);
      var starSizes = new Float32Array(starCount);
      for (var si = 0; si < starCount; si++) {
        starPos[si * 3]     = (Math.random() - 0.5) * 40;
        starPos[si * 3 + 1] = Math.random() * 15;
        starPos[si * 3 + 2] = (Math.random() - 0.5) * 40;
        starSizes[si] = 0.03 + Math.random() * 0.1;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      var starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.9 });
      starPoints = new THREE.Points(starGeo, starMat);
      decoGroup.add(starPoints);

      /* Ambient dust/firefly particles around the board */
      var dustCount = 80;
      var dustGeo = new THREE.BufferGeometry();
      var dustPos = new Float32Array(dustCount * 3);
      for (var di = 0; di < dustCount; di++) {
        dustPos[di * 3]     = (Math.random() - 0.5) * 18;
        dustPos[di * 3 + 1] = 0.3 + Math.random() * 6;
        dustPos[di * 3 + 2] = (Math.random() - 0.5) * 18;
      }
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      var dustMat = new THREE.PointsMaterial({ color: 0xffcc66, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.5 });
      dustParticles = new THREE.Points(dustGeo, dustMat);
      decoGroup.add(dustParticles);

      /* Floating tiny star spheres */
      for (var fsi = 0; fsi < 18; fsi++) {
        var fStarGeo  = new THREE.SphereGeometry(0.07, 5, 5);
        var fStarMat  = new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 1.0 });
        var fStarMesh = new THREE.Mesh(fStarGeo, fStarMat);
        fStarMesh.position.set(
          (Math.random() - 0.5) * 16, 
          0.5 + Math.random() * 5, 
          (Math.random() - 0.5) * 16
        );
        fStarMesh._floatPhase = Math.random() * Math.PI * 2;
        decoGroup.add(fStarMesh);
      }
    }());

    /* ── 9. PLAYER TOKENS ───────────────────────────── */
    function createRaphaelToken() {
      var group = new THREE.Group();
      /* Brown stem/body */
      var bodyGeo  = new THREE.CylinderGeometry(0.2, 0.25, 1.0, 8);
      var bodyMat  = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
      var bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 0.5;
      bodyMesh.castShadow = true;
      group.add(bodyMesh);
      /* Yellow flower head disc */
      var headGeo  = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
      var headMat  = new THREE.MeshPhongMaterial({ color: 0xDAA520, emissive: 0x443300, emissiveIntensity: 0.3 });
      var headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.y = 1.05;
      headMesh.castShadow = true;
      group.add(headMesh);
      /* 8 petals */
      for (var pi = 0; pi < 8; pi++) {
        var petalGeo  = new THREE.SphereGeometry(0.18, 8, 8);
        var petalMat  = new THREE.MeshPhongMaterial({ color: 0xFFD700 });
        var petalMesh = new THREE.Mesh(petalGeo, petalMat);
        petalMesh.position.set(Math.cos(pi * Math.PI / 4) * 0.65, 1.05, Math.sin(pi * Math.PI / 4) * 0.65);
        petalMesh.castShadow = true;
        group.add(petalMesh);
      }
      /* Brown center */
      var centerGeo  = new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12);
      var centerMat  = new THREE.MeshPhongMaterial({ color: 0x4a2f00 });
      var centerMesh = new THREE.Mesh(centerGeo, centerMat);
      centerMesh.position.y = 1.12;
      group.add(centerMesh);
      group.scale.set(0.55, 0.55, 0.55);
      return group;
    }

    function createTaylorToken() {
      var group = new THREE.Group();
      /* Teardrop body via lathe */
      var lPoints = [];
      for (var lp = 0; lp <= 10; lp++) {
        var lt = lp / 10;
        lPoints.push(new THREE.Vector2(Math.sin(lt * Math.PI) * 0.35, lt * 1.0 - 0.5));
      }
      var bodyGeo  = new THREE.LatheGeometry(lPoints, 12);
      var bodyMat  = new THREE.MeshPhongMaterial({ color: 0x5a9e4a, shininess: 60 });
      var bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 0.5;
      bodyMesh.castShadow = true;
      group.add(bodyMesh);
      /* Vein line */
      var veinGeo  = new THREE.BoxGeometry(0.04, 0.9, 0.04);
      var veinMat  = new THREE.MeshPhongMaterial({ color: 0x3a7030 });
      var veinMesh = new THREE.Mesh(veinGeo, veinMat);
      veinMesh.position.y = 0.55;
      group.add(veinMesh);
      /* Leaf tip */
      var tipGeo  = new THREE.ConeGeometry(0.08, 0.25, 6);
      var tipMat  = new THREE.MeshPhongMaterial({ color: 0x3a7030 });
      var tipMesh = new THREE.Mesh(tipGeo, tipMat);
      tipMesh.position.y = 1.05;
      tipMesh.rotation.z = 0.1;
      group.add(tipMesh);
      group.scale.set(0.55, 0.55, 0.55);
      return group;
    }

    var raphael3D = createRaphaelToken();
    var taylor3D  = createTaylorToken();
    raphael3D._baseY = 0.2;
    taylor3D._baseY  = 0.2;
    scene.add(raphael3D);
    scene.add(taylor3D);

    /* ── 10. 3D DICE ────────────────────────────────── */
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
      var dots = positions[num] || positions[1];
      dots.forEach(function (d) {
        ctx.beginPath();
        ctx.arc(d[0], d[1], dotR, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function create3DDice() {
      var geo  = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      var mats = [1, 2, 3, 4, 5, 6].map(function (num) {
        var c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#faf6ef';
        ctx.beginPath();
        ctx.roundRect(4, 4, 120, 120, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(194,98,58,0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();
        drawDots(ctx, num);
        return new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c), shininess: 60 });
      });
      var diceMesh = new THREE.Mesh(geo, mats);
      diceMesh.castShadow = true;
      return diceMesh;
    }

    var diceMesh = create3DDice();
    diceMesh.position.set(8, 3, 8);
    diceMesh.visible = false;
    scene.add(diceMesh);

    /* ── 11. GAME STATE ─────────────────────────────── */
    var gameState = {
      raphael: { pos: 0, pts: 0 },
      taylor:  { pos: 0, pts: 0 },
      currentTurn: 'raphael',
      rolling: false,
      winner: null,
    };

    var moveQueue = [];   /* { userId, steps } */
    var isAnimating = false;
    var diceRolling = false;
    var diceRollT = 0;
    var diceRollDuration = 1.5;
    var diceResult = 0;
    var diceFinalNum = 1;

    /* Camera tween */
    var camTween = null;

    /* Token move animation */
    var tokenAnim = null; /* { mesh, steps, stepIdx, stepT, fromPos, toPos, onDone } */

    /* ── 12. PLACE TOKENS ON TILE ───────────────────── */
    function getTileWorldPos(tileIdx, offset) {
      var tp = TILE_POSITIONS[Math.max(0, Math.min(BOARD_SIZE - 1, tileIdx))];
      var ox = (offset || 0) * 0.5;
      return { x: tp.x + ox, y: tp.y + 0.2, z: tp.z };
    }

    function snapTokenToTile(mesh, tileIdx, offset) {
      var wp = getTileWorldPos(tileIdx, offset);
      mesh.position.set(wp.x, wp.y, wp.z);
      mesh._baseY = wp.y;
    }

    /* ── 13. NARRATIVE & UI ─────────────────────────── */
    var narrativeEl = document.getElementById('wanderNarrative');
    var turnBanner  = document.getElementById('turnBanner');
    var diceEl      = document.getElementById('wanderDice');
    var rollBtn     = document.getElementById('wanderRollBtn');
    var resetBtn    = document.getElementById('wanderResetBtn');
    var playersEl   = document.getElementById('wanderingPlayers');
    var winOverlay  = document.getElementById('wanderWinOverlay');

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

    function updatePlayerCards() {
      if (!playersEl) return;
      var names = { raphael: '🌻 Raphael', taylor: '🌿 Taylor' };
      var biomeNames = { meadow: '🌸 Meadow', forest: '🌲 Forest', mountain: '⛰️ Mountain', star: '✨ Starfield' };
      var html = '';
      ['raphael', 'taylor'].forEach(function (uid) {
        var st = gameState[uid];
        var isActive = gameState.currentTurn === uid;
        var biome = getBiome(st.pos);
        html += '<div class="wander-player-card' + (isActive ? ' player-card--active' : '') + '">';
        html += '<div class="wpc-token">' + (uid === 'raphael' ? '🌻' : '🌿') + '</div>';
        html += '<div class="wpc-info">';
        html += '<div class="wpc-name">' + names[uid] + '</div>';
        html += '<div class="wpc-stats">';
        html += '<span class="wpc-pos">Tile ' + st.pos + '/19</span>';
        html += '<span class="wpc-biome">' + biomeNames[biome] + '</span>';
        if (st.pts) html += '<span class="wpc-pts">+' + st.pts + ' pts</span>';
        html += '</div>';
        html += '</div>';
        if (isActive) html += '<div class="wpc-turn-badge">YOUR TURN</div>';
        html += '</div>';
      });
      playersEl.innerHTML = html;
    }

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

    /* ── 14. CAMERA TWEEN ───────────────────────────── */
    function tweenCameraTo(targetX, targetY, targetZ, duration) {
      var startX = camera.position.x;
      var startY = camera.position.y;
      var startZ = camera.position.z;
      var elapsed = 0;
      camTween = { duration: duration, elapsed: 0, startX: startX, startY: startY, startZ: startZ, targetX: targetX, targetY: targetY, targetZ: targetZ };
    }

    function updateCameraTween(dt) {
      if (!camTween) return;
      camTween.elapsed += dt;
      var t = Math.min(1, camTween.elapsed / camTween.duration);
      /* Ease out cubic */
      var ease = 1 - Math.pow(1 - t, 3);
      camera.position.x = camTween.startX + (camTween.targetX - camTween.startX) * ease;
      camera.position.y = camTween.startY + (camTween.targetY - camTween.startY) * ease;
      camera.position.z = camTween.startZ + (camTween.targetZ - camTween.startZ) * ease;
      camera.lookAt(0, 0, 0);
      if (t >= 1) camTween = null;
    }

    /* ── 15. TOKEN MOVE ANIMATION ───────────────────── */
    function animateMoveToken(mesh, fromTile, toTile, offset, onDone) {
      var steps = [];
      var dir   = fromTile <= toTile ? 1 : -1;
      for (var si = fromTile; si !== toTile; si += dir) {
        steps.push(si + dir);
      }
      if (steps.length === 0) { if (onDone) onDone(); return; }
      var stepDuration = 0.4; /* seconds per tile */
      var stepIdx = 0;
      var stepT   = 0;
      var fromWP  = getTileWorldPos(fromTile, offset);
      var toWP    = getTileWorldPos(steps[0], offset);

      tokenAnim = {
        mesh: mesh,
        steps: steps,
        stepIdx: 0,
        stepT: 0,
        fromWP: fromWP,
        toWP: toWP,
        stepDuration: stepDuration,
        offset: offset,
        onDone: onDone,
      };
    }

    function updateTokenAnim(dt) {
      if (!tokenAnim) return;
      var a = tokenAnim;
      a.stepT += dt;
      var t = Math.min(1, a.stepT / a.stepDuration);
      /* Arc trajectory */
      var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; /* ease in-out quad */
      var arcY = Math.sin(t * Math.PI) * 1.5;
      var mx = a.fromWP.x + (a.toWP.x - a.fromWP.x) * ease;
      var my = a.fromWP.y + (a.toWP.y - a.fromWP.y) * ease + arcY;
      var mz = a.fromWP.z + (a.toWP.z - a.fromWP.z) * ease;
      /* Squash on landing */
      if (t > 0.9) {
        var squash = 1 - (1 - t) * 10 * 0.3;
        a.mesh.scale.y = Math.max(0.7, squash);
      } else {
        a.mesh.scale.y = 1;
      }
      a.mesh.position.set(mx, my, mz);

      if (t >= 1) {
        /* Snap cleanly */
        a.mesh.position.set(a.toWP.x, a.toWP.y, a.toWP.z);
        a.mesh.scale.y = 1;
        a.stepIdx++;
        if (a.stepIdx >= a.steps.length) {
          a.mesh._baseY = a.toWP.y;
          tokenAnim = null;
          if (a.onDone) a.onDone();
        } else {
          a.fromWP = a.toWP;
          a.toWP   = getTileWorldPos(a.steps[a.stepIdx], a.offset);
          a.stepT  = 0;
        }
      }
    }

    /* ── 16. DICE ROLL ANIMATION ───────────────────── */
    function startDiceRoll(resultNum) {
      diceResult      = resultNum;
      diceRolling     = true;
      diceRollT       = 0;
      diceMesh.visible = true;
      diceMesh.position.set(
        TILE_POSITIONS[gameState[gameState.currentTurn].pos].x + 1.5,
        TILE_POSITIONS[gameState[gameState.currentTurn].pos].y + 2.5,
        TILE_POSITIONS[gameState[gameState.currentTurn].pos].z
      );
      /* Set faces orientation to show correct result when done */
      /* Face order: +x=1, -x=6, +y=2, -y=5, +z=3, -z=4 */
      diceFinalNum = resultNum;
      if (diceEl) {
        diceEl.textContent = '🎲';
        diceEl.classList.add('dice-rolling');
        diceEl.style.display = 'flex';
      }
    }

    function updateDiceAnim(dt) {
      if (!diceRolling) return;
      diceRollT += dt;
      /* Rapid random spin */
      diceMesh.rotation.x += dt * (8 + Math.random() * 6);
      diceMesh.rotation.y += dt * (6 + Math.random() * 8);
      diceMesh.rotation.z += dt * (5 + Math.random() * 4);
      if (diceRollT >= diceRollDuration) {
        diceRolling = false;
        /* Orient to show correct face (simplified) */
        diceMesh.rotation.set(0, 0, 0);
        diceMesh.visible = false;
        showDiceResult(diceResult);
        /* Proceed with move */
        processDiceResult(diceResult);
      }
    }

    /* ── 17. WIN DETECTION ──────────────────────────── */
    function checkWin(userId) {
      if (gameState[userId].pos >= BOARD_SIZE - 1) {
        gameState.winner = userId;
        setNarrative(getNarrative(userId, 'star', 'win'));
        if (winOverlay) {
          var winName  = winOverlay.querySelector('.win-name');
          if (winName) winName.textContent = userId === 'raphael' ? 'Raphael 🌻' : 'Taylor 🌿';
          winOverlay.classList.add('win-visible');
        }
        spawnWinParticles();
        setRollBtnEnabled(false);
        return true;
      }
      return false;
    }

    /* ── 18. WIN PARTICLES (CSS 3D approach via points) */
    var winParticles = [];
    function spawnWinParticles() {
      var colors = [0xffd700, 0xff6b9d, 0x7ec850, 0xffffff, 0xc2623a];
      for (var wpi = 0; wpi < 40; wpi++) {
        var geo  = new THREE.SphereGeometry(0.06, 5, 5);
        var mat  = new THREE.MeshPhongMaterial({ color: colors[wpi % colors.length], emissive: colors[wpi % colors.length], emissiveIntensity: 0.5 });
        var mesh = new THREE.Mesh(geo, mat);
        var angle = Math.random() * Math.PI * 2;
        mesh.position.set(0, 2, 0);
        mesh._vel = { x: Math.cos(angle) * (1 + Math.random() * 3), y: 2 + Math.random() * 4, z: Math.sin(angle) * (1 + Math.random() * 3) };
        mesh._life = 2.5 + Math.random();
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
        if (wp._life <= 0) {
          scene.remove(wp);
          wp.geometry.dispose();
          wp.material.dispose();
          winParticles.splice(wi, 1);
        }
      }
    }

    /* ── 19. PROCESS DICE RESULT ────────────────────── */
    function processDiceResult(roll) {
      var uid = gameState.currentTurn;
      var oldPos = gameState[uid].pos;
      var rawPos = Math.min(BOARD_SIZE - 1, oldPos + roll);
      var sp = SPECIAL[rawPos];

      /* Apply special tile effects */
      var finalPos = rawPos;
      var eventType = null;
      if (sp) {
        if (sp.type === 'bonus')  { finalPos = Math.min(BOARD_SIZE - 1, rawPos + 2); eventType = 'bonus'; gameState[uid].pts += 2; }
        if (sp.type === 'hazard') { finalPos = Math.max(0, rawPos - 2); eventType = 'hazard'; }
        if (sp.type === 'rest')   { eventType = 'rest'; }
        if (sp.type === 'finish') { finalPos = BOARD_SIZE - 1; }
      }

      /* Animate token */
      var mesh   = uid === 'raphael' ? raphael3D : taylor3D;
      var offset = uid === 'raphael' ? -0.35 : 0.35;
      isAnimating = true;
      setRollBtnEnabled(false);

      /* First animate to rawPos, then if special adjustment animate to finalPos */
      animateMoveToken(mesh, oldPos, rawPos, offset, function () {
        gameState[uid].pos = rawPos;
        if (finalPos !== rawPos) {
          setTimeout(function () {
            animateMoveToken(mesh, rawPos, finalPos, offset, function () {
              gameState[uid].pos = finalPos;
              afterMove(uid, finalPos, eventType);
            });
          }, 300);
        } else {
          afterMove(uid, finalPos, eventType);
        }
      });

      /* Camera follow */
      var tp = TILE_POSITIONS[rawPos];
      tweenCameraTo(tp.x * 0.3, 16, 20 + tp.z * 0.3, 1.2);
    }

    function afterMove(uid, pos, eventType) {
      var biome = getBiome(pos);
      setNarrative(getNarrative(uid, biome, eventType));
      updatePlayerCards();
      isAnimating = false;

      if (!checkWin(uid)) {
        /* Switch turn */
        gameState.currentTurn = uid === 'raphael' ? 'taylor' : 'raphael';
        updateTurnBanner(gameState.currentTurn);
        setRollBtnEnabled(true);
      }

      /* Pulse tile */
      var tile = tiles[pos];
      if (tile) {
        var origY = tile._baseY;
        tile._baseY = origY + 0.25;
        setTimeout(function () { tile._baseY = origY; }, 600);
      }
    }

    /* ── 20. API SYNC ───────────────────────────────── */
    var lastSyncState = null;

    function applyServerState(data) {
      if (!data) return;
      var gs = data.gameState || data;
      if (!gs) return;

      if (gs.raphael !== undefined) gameState.raphael.pos = Math.max(0, Math.min(BOARD_SIZE - 1, gs.raphael || 0));
      if (gs.taylor  !== undefined) gameState.taylor.pos  = Math.max(0, Math.min(BOARD_SIZE - 1, gs.taylor  || 0));
      if (gs.currentTurn) gameState.currentTurn = gs.currentTurn;
      if (gs.winner) gameState.winner = gs.winner;
      if (gs.raphaelPts !== undefined) gameState.raphael.pts = gs.raphaelPts || 0;
      if (gs.taylorPts  !== undefined) gameState.taylor.pts  = gs.taylorPts  || 0;

      /* Snap tokens without animation on initial load */
      if (!isAnimating && !tokenAnim) {
        snapTokenToTile(raphael3D, gameState.raphael.pos, -0.35);
        snapTokenToTile(taylor3D,  gameState.taylor.pos,   0.35);
      }

      updateTurnBanner(gameState.currentTurn);
      updatePlayerCards();

      if (gameState.winner) {
        setRollBtnEnabled(false);
        if (winOverlay && !winOverlay.classList.contains('win-visible')) {
          var winName = winOverlay.querySelector('.win-name');
          if (winName) winName.textContent = gameState.winner === 'raphael' ? 'Raphael 🌻' : 'Taylor 🌿';
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
        console.warn('[WanderingPath3D] Could not load game state:', e.message);
        /* Start at defaults */
        snapTokenToTile(raphael3D, 0, -0.35);
        snapTokenToTile(taylor3D,  0,  0.35);
        updateTurnBanner('raphael');
        updatePlayerCards();
        setRollBtnEnabled(true);
      });
    }

    /* Poll every 5 seconds */
    var pollInterval = setInterval(function () {
      if (!isAnimating && !diceRolling) {
        gameGet().then(function (data) {
          applyServerState(data);
        }).catch(function () {});
      }
    }, 5000);

    /* ── 21. ROLL BUTTON ────────────────────────────── */
    if (rollBtn) {
      rollBtn.addEventListener('click', function () {
        if (gameState.rolling || isAnimating || diceRolling || gameState.winner) return;
        var curUser = getCurrentUser();
        if (curUser !== gameState.currentTurn) {
          setNarrative('It\'s ' + (gameState.currentTurn === 'raphael' ? 'Raphael\'s' : 'Taylor\'s') + ' turn!');
          return;
        }
        gameState.rolling = true;
        setRollBtnEnabled(false);

        gamePost('game/move', { user_id: curUser }).then(function (data) {
          gameState.rolling = false;
          var roll = (data && data.roll) ? data.roll : Math.floor(Math.random() * 6) + 1;
          startDiceRoll(roll);
          if (data) applyServerState(data);
        }).catch(function () {
          gameState.rolling = false;
          var roll = Math.floor(Math.random() * 6) + 1;
          startDiceRoll(roll);
        });
      });
    }

    /* ── 22. RESET BUTTON ───────────────────────────── */
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (isAnimating) return;
        gamePost('game/move', { user_id: 'raphael', reset: true }).then(function (data) {
          gameState.raphael   = { pos: 0, pts: 0 };
          gameState.taylor    = { pos: 0, pts: 0 };
          gameState.currentTurn = 'raphael';
          gameState.winner    = null;
          gameState.rolling   = false;
          isAnimating = false;
          tokenAnim   = null;
          diceRolling = false;
          diceMesh.visible = false;
          if (diceEl) { diceEl.textContent = ''; diceEl.style.display = 'none'; }
          snapTokenToTile(raphael3D, 0, -0.35);
          snapTokenToTile(taylor3D,  0,  0.35);
          if (winOverlay) winOverlay.classList.remove('win-visible');
          /* Clear win particles */
          winParticles.forEach(function (wp) { scene.remove(wp); wp.geometry.dispose(); wp.material.dispose(); });
          winParticles.length = 0;
          updateTurnBanner('raphael');
          updatePlayerCards();
          setNarrative('The wandering path awaits...');
          setRollBtnEnabled(true);
          /* Reset camera */
          tweenCameraTo(0, 18, 22, 1.0);
          if (data) applyServerState(data);
        }).catch(function () {
          gameState.raphael   = { pos: 0, pts: 0 };
          gameState.taylor    = { pos: 0, pts: 0 };
          gameState.currentTurn = 'raphael';
          gameState.winner    = null;
          gameState.rolling   = false;
          snapTokenToTile(raphael3D, 0, -0.35);
          snapTokenToTile(taylor3D,  0,  0.35);
          if (winOverlay) winOverlay.classList.remove('win-visible');
          updateTurnBanner('raphael');
          updatePlayerCards();
          setNarrative('The wandering path awaits...');
          setRollBtnEnabled(true);
          tweenCameraTo(0, 18, 22, 1.0);
        });
      });
    }

    /* ── 23. DEBUG OVERLAY (removed for production) ── */
    function updateDebug() { /* no-op in production */ }

    /* ── 24. ANIMATION LOOP ─────────────────────────── */
    var rafId = null;
    var elapsedTotal = 0;

    /* Tile pulse rings (for special tiles) */
    var specialRings = [];
    (function buildSpecialRings() {
      Object.keys(SPECIAL).forEach(function (idx) {
        var sp = SPECIAL[idx];
        var tp = TILE_POSITIONS[parseInt(idx)];
        var ringGeo = new THREE.TorusGeometry(1.4, 0.05, 8, 32);
        var ringMat = new THREE.MeshPhongMaterial({ color: sp.color, emissive: sp.color, emissiveIntensity: 0.8, transparent: true, opacity: 0.7 });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(tp.x, tp.y + 0.25, tp.z);
        ring._phase = Math.random() * Math.PI * 2;
        scene.add(ring);
        specialRings.push(ring);
      });
    }());

    function animate() {
      rafId = requestAnimationFrame(animate);
      renderer.info.reset();
      var dt = Math.min(clock.getDelta(), 0.1);
      elapsedTotal += dt;

      /* Token idle bobbing */
      if (!tokenAnim) {
        raphael3D.position.y = raphael3D._baseY + Math.sin(elapsedTotal * 2.0) * 0.12;
        taylor3D.position.y  = taylor3D._baseY  + Math.sin(elapsedTotal * 2.0 + 1) * 0.12;
      }

      /* Token move animation */
      updateTokenAnim(dt);

      /* Dice roll animation */
      updateDiceAnim(dt);

      /* Camera tween */
      updateCameraTween(dt);

      /* Win particles */
      updateWinParticles(dt);

      /* Tile pulse — slight oscillation for all tiles */
      tiles.forEach(function (tile, i) {
        tile.position.y = tile._baseY + Math.sin(elapsedTotal * 0.8 + i * 0.3) * 0.02;
      });

      /* Special tile rings pulse */
      specialRings.forEach(function (ring, ri) {
        ring._phase += dt * 1.5;
        var s = 0.9 + Math.sin(ring._phase) * 0.15;
        ring.scale.set(s, s, s);
        ring.material.opacity = 0.4 + Math.sin(ring._phase) * 0.35;
        ring.position.y = TILE_POSITIONS[parseInt(Object.keys(SPECIAL)[ri])].y + 0.25 + Math.sin(ring._phase * 0.7) * 0.08;
      });

      /* Starfield points slow rotation */
      if (starPoints) {
        starPoints.rotation.y += dt * 0.05;
      }

      /* Dust particles float and drift */
      if (dustParticles) {
        dustParticles.rotation.y += dt * 0.02;
        var dPositions = dustParticles.geometry.attributes.position.array;
        for (var dpi = 0; dpi < dPositions.length; dpi += 3) {
          dPositions[dpi + 1] += Math.sin(elapsedTotal * 0.5 + dpi) * dt * 0.15;
          if (dPositions[dpi + 1] > 7) dPositions[dpi + 1] = 0.3;
        }
        dustParticles.geometry.attributes.position.needsUpdate = true;
      }

      /* Accent lights subtle pulse */
      if (purpleLight) {
        purpleLight.intensity = 0.6 + Math.sin(elapsedTotal * 0.5) * 0.15;
      }
      if (amberLight) {
        amberLight.intensity = 0.4 + Math.sin(elapsedTotal * 0.7 + 1) * 0.1;
      }

      /* Floating star spheres */
      decoGroup.children.forEach(function (ch) {
        if (ch._floatPhase !== undefined) {
          ch.position.y += Math.sin(elapsedTotal * 1.2 + ch._floatPhase) * dt * 0.3;
        }
      });

      renderer.render(scene, camera);
      updateDebug(renderer);
    }

    /* ── 25. RESIZE HANDLER ─────────────────────────── */
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

    /* ── 26. START ──────────────────────────────────── */
    setNarrative('The wandering path awaits...');
    updateTurnBanner('raphael');
    updatePlayerCards();

    /* Initial token placement */
    snapTokenToTile(raphael3D, 0, -0.35);
    snapTokenToTile(taylor3D,  0,  0.35);

    /* Load server state */
    loadGameState();

    /* Start loop */
    animate();

    /* Expose for debugging */
    window.renderGameToText = function () {
      return JSON.stringify({
        currentTurn: gameState.currentTurn,
        raphael: gameState.raphael,
        taylor: gameState.taylor,
        winner: gameState.winner || null,
        rolling: gameState.rolling || diceRolling,
        animating: isAnimating,
      });
    };

    window.advanceTime = function (ms) {
      var steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (var i = 0; i < steps; i++) {
        var fakeDt = 1 / 60;
        elapsedTotal += fakeDt;
        updateTokenAnim(fakeDt);
        updateDiceAnim(fakeDt);
        updateCameraTween(fakeDt);
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
