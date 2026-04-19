/**
 * shader-hero.js — Soul Safety WebGL Hero
 * A living nebula shader background + interactive particle field.
 * Uses Three.js (already loaded) for the particle system.
 * Raw WebGL for the GLSL background shader (no extra deps).
 * 
 * Performance: auto-detects mobile/low-end and reduces fidelity.
 * Respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  // ── Guards ─────────────────────────────────────────────────────────────
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.innerWidth < 768;
  var heroEl = document.getElementById('hero');
  if (!heroEl) return;

  // ── Performance tier ───────────────────────────────────────────────────
  var perfTier = 'high';
  try {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) { perfTier = 'none'; }
    else {
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      if (/SwiftShader|llvmpipe|Software/i.test(renderer)) perfTier = 'none';
      else if (isMobile) perfTier = 'medium';
    }
    c = null; gl = null;
  } catch (e) { perfTier = 'none'; }

  if (perfTier === 'none' || reducedMotion) return; // Graceful fallback to CSS gradient

  // ═══════════════════════════════════════════════════════════════════════
  //  PART 1: GLSL Nebula Shader Background
  // ═══════════════════════════════════════════════════════════════════════

  var shaderCanvas = document.createElement('canvas');
  shaderCanvas.id = 'shaderHeroCanvas';
  shaderCanvas.setAttribute('aria-hidden', 'true');
  shaderCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  heroEl.insertBefore(shaderCanvas, heroEl.firstChild);

  // Hide the old CSS gradient
  var oldGradient = heroEl.querySelector('.hero-bg--gradient');
  if (oldGradient) oldGradient.style.display = 'none';
  var oldOverlay = heroEl.querySelector('.hero-overlay');
  if (oldOverlay) oldOverlay.style.opacity = '0';

  var gl2 = shaderCanvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl2) return;

  // Vertex shader (fullscreen quad)
  var VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  // Fragment shader: warm nebula with organic flow
  var FRAG = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;

    // Simplex-ish noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                          -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m * m; m = m * m;
      vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x_) - 0.5;
      vec3 ox = floor(x_ + 0.5);
      vec3 a0 = x_ - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // FBM (fractal brownian motion) for organic turbulence
    float fbm(vec2 p) {
      float f = 0.0;
      float w = 0.5;
      for (int i = 0; i < 4; i++) {
        f += w * snoise(p);
        p *= 2.1;
        w *= 0.5;
      }
      return f;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

      float t = u_time * 0.08;

      // Mouse influence (subtle warp)
      vec2 mouse = (u_mouse - 0.5) * vec2(aspect, 1.0);
      float mouseDist = length(p - mouse);
      float mouseInfluence = smoothstep(0.8, 0.0, mouseDist) * 0.15;
      p += normalize(p - mouse + 0.001) * mouseInfluence;

      // Layered nebula
      float n1 = fbm(p * 1.5 + vec2(t, t * 0.7));
      float n2 = fbm(p * 2.8 + vec2(-t * 0.5, t * 0.3) + n1 * 0.4);
      float n3 = fbm(p * 4.0 + vec2(t * 0.3, -t * 0.6) + n2 * 0.3);

      // Color palette: Soul Safety warm nebula
      vec3 deep     = vec3(0.04, 0.027, 0.02);    // Near-black warm
      vec3 terra    = vec3(0.77, 0.36, 0.20);      // Terracotta #c55c34
      vec3 amber    = vec3(0.85, 0.63, 0.10);      // Warm amber
      vec3 cream    = vec3(0.96, 0.93, 0.88);       // Cream highlight
      vec3 sage     = vec3(0.37, 0.55, 0.33);       // Sage green accent

      // Mix colors based on noise layers
      float intensity = n1 * 0.5 + 0.5;
      float detail = n2 * 0.5 + 0.5;
      float fine = n3 * 0.5 + 0.5;

      vec3 col = deep;
      col = mix(col, terra * 0.4, smoothstep(0.35, 0.65, intensity) * 0.7);
      col = mix(col, amber * 0.3, smoothstep(0.5, 0.8, detail) * 0.5);
      col = mix(col, sage * 0.15, smoothstep(0.6, 0.9, fine) * 0.3);
      col = mix(col, cream * 0.08, smoothstep(0.7, 1.0, intensity * detail) * 0.4);

      // Vignette
      float vig = 1.0 - smoothstep(0.3, 1.2, length(p));
      col *= vig * 1.1;

      // Subtle star points
      float stars = smoothstep(0.97, 1.0, snoise(uv * 80.0 + t * 0.02));
      col += cream * stars * 0.15;

      // Gentle film grain
      float grain = (fract(sin(dot(uv * u_time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.03;
      col += grain;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function createShader(type, src) {
    var s = gl2.createShader(type);
    gl2.shaderSource(s, src);
    gl2.compileShader(s);
    if (!gl2.getShaderParameter(s, gl2.COMPILE_STATUS)) {
      console.warn('Shader compile error:', gl2.getShaderInfoLog(s));
      gl2.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = createShader(gl2.VERTEX_SHADER, VERT);
  var fs = createShader(gl2.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl2.createProgram();
  gl2.attachShader(prog, vs);
  gl2.attachShader(prog, fs);
  gl2.linkProgram(prog);
  if (!gl2.getProgramParameter(prog, gl2.LINK_STATUS)) {
    console.warn('Shader link error:', gl2.getProgramInfoLog(prog));
    return;
  }
  gl2.useProgram(prog);

  // Fullscreen quad
  var buf = gl2.createBuffer();
  gl2.bindBuffer(gl2.ARRAY_BUFFER, buf);
  gl2.bufferData(gl2.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl2.STATIC_DRAW);
  var aPos = gl2.getAttribLocation(prog, 'a_pos');
  gl2.enableVertexAttribArray(aPos);
  gl2.vertexAttribPointer(aPos, 2, gl2.FLOAT, false, 0, 0);

  // Uniforms
  var uTime = gl2.getUniformLocation(prog, 'u_time');
  var uRes = gl2.getUniformLocation(prog, 'u_resolution');
  var uMouse = gl2.getUniformLocation(prog, 'u_mouse');

  var mouseX = 0.5, mouseY = 0.5;
  var targetMouseX = 0.5, targetMouseY = 0.5;

  heroEl.addEventListener('mousemove', function (e) {
    var rect = heroEl.getBoundingClientRect();
    targetMouseX = (e.clientX - rect.left) / rect.width;
    targetMouseY = 1.0 - (e.clientY - rect.top) / rect.height;
  }, { passive: true });

  // Resize handler
  var dpr = Math.min(window.devicePixelRatio || 1, perfTier === 'medium' ? 1 : 1.5);
  function resizeShader() {
    var w = heroEl.offsetWidth;
    var h = heroEl.offsetHeight;
    shaderCanvas.width = Math.floor(w * dpr);
    shaderCanvas.height = Math.floor(h * dpr);
    gl2.viewport(0, 0, shaderCanvas.width, shaderCanvas.height);
  }
  resizeShader();
  window.addEventListener('resize', resizeShader, { passive: true });

  // ═══════════════════════════════════════════════════════════════════════
  //  PART 2: Three.js Particle Field (cursor-reactive)
  // ═══════════════════════════════════════════════════════════════════════

  var THREE = window.THREE;
  var particleContainer = document.createElement('div');
  particleContainer.id = 'particleHero';
  particleContainer.setAttribute('aria-hidden', 'true');
  particleContainer.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;';
  heroEl.insertBefore(particleContainer, heroEl.querySelector('.hero-content'));

  var PARTICLE_COUNT = perfTier === 'medium' ? 600 : 1500;
  var scene, camera, threeRenderer, particleGeo, particleMat, points;
  var positions, velocities, basePositions;

  if (THREE) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, heroEl.offsetWidth / heroEl.offsetHeight, 0.1, 100);
    camera.position.z = 3;

    threeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    threeRenderer.setPixelRatio(Math.min(dpr, 1.5));
    threeRenderer.setSize(heroEl.offsetWidth, heroEl.offsetHeight);
    threeRenderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    particleContainer.appendChild(threeRenderer.domElement);

    // Create particles
    particleGeo = new THREE.BufferGeometry();
    positions = new Float32Array(PARTICLE_COUNT * 3);
    velocities = new Float32Array(PARTICLE_COUNT * 3);
    basePositions = new Float32Array(PARTICLE_COUNT * 3);

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var i3 = i * 3;
      var x = (Math.random() - 0.5) * 8;
      var y = (Math.random() - 0.5) * 5;
      var z = (Math.random() - 0.5) * 4 - 1;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      basePositions[i3] = x;
      basePositions[i3 + 1] = y;
      basePositions[i3 + 2] = z;
      velocities[i3] = (Math.random() - 0.5) * 0.002;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.002;
      velocities[i3 + 2] = 0;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Custom shader material for particles with glow
    particleMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        u_time: { value: 0 },
        u_color1: { value: new THREE.Color(0xc55c34) }, // terracotta
        u_color2: { value: new THREE.Color(0xd4a017) }, // amber
        u_color3: { value: new THREE.Color(0xfaf6ef) }, // cream
      },
      vertexShader: `
        uniform float u_time;
        attribute vec3 position;
        varying float vAlpha;
        varying float vColorMix;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          float dist = length(mvPos.xyz);
          vAlpha = smoothstep(5.0, 1.0, dist) * (0.3 + 0.2 * sin(u_time + position.x * 3.0));
          vColorMix = fract(position.x * 0.5 + position.y * 0.3 + u_time * 0.1);
          gl_PointSize = max(1.0, (3.0 / -mvPos.z) * (1.0 + 0.5 * sin(u_time * 2.0 + position.y * 5.0)));
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform vec3 u_color3;
        varying float vAlpha;
        varying float vColorMix;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float glow = exp(-d * d * 3.0);
          vec3 col = mix(u_color1, u_color2, smoothstep(0.0, 0.5, vColorMix));
          col = mix(col, u_color3, smoothstep(0.7, 1.0, vColorMix));
          gl_FragColor = vec4(col, glow * vAlpha);
        }
      `
    });

    points = new THREE.Points(particleGeo, particleMat);
    scene.add(points);

    // Handle Three.js resize
    window.addEventListener('resize', function () {
      if (!threeRenderer) return;
      var w = heroEl.offsetWidth;
      var h = heroEl.offsetHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      threeRenderer.setSize(w, h);
    }, { passive: true });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════════════════

  var startTime = performance.now();
  var paused = false;

  // Pause when hero not visible
  var heroObserver = new IntersectionObserver(function (entries) {
    var wasP = paused;
    paused = !entries[0].isIntersecting;
    // Restart RAF loop when becoming visible again
    if (wasP && !paused) requestAnimationFrame(animate);
  }, { threshold: 0.05 });
  heroObserver.observe(heroEl);

  function animate() {
    if (paused) {
      // Don't re-queue RAF when paused — observer will restart
      return;
    }
    requestAnimationFrame(animate);

    var elapsed = (performance.now() - startTime) * 0.001;

    // Smooth mouse lerp
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // ── Render GLSL shader ──
    gl2.uniform1f(uTime, elapsed);
    gl2.uniform2f(uRes, shaderCanvas.width, shaderCanvas.height);
    gl2.uniform2f(uMouse, mouseX, mouseY);
    gl2.drawArrays(gl2.TRIANGLE_STRIP, 0, 4);

    // ── Update + render Three.js particles ──
    if (THREE && points) {
      particleMat.uniforms.u_time.value = elapsed;

      // Cursor influence on particles (screen to world)
      var mx = (mouseX - 0.5) * 6;
      var my = (mouseY - 0.5) * 4;

      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var i3 = i * 3;

        // Gentle drift
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];

        // Cursor attraction/repulsion
        var dx = positions[i3] - mx;
        var dy = positions[i3 + 1] - my;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1.5 && dist > 0.01) {
          var force = (1.5 - dist) * 0.003;
          positions[i3] += dx / dist * force;
          positions[i3 + 1] += dy / dist * force;
        }

        // Spring back to base
        positions[i3] += (basePositions[i3] - positions[i3]) * 0.003;
        positions[i3 + 1] += (basePositions[i3 + 1] - positions[i3 + 1]) * 0.003;

        // Wrap bounds
        if (positions[i3] > 5) positions[i3] = -5;
        if (positions[i3] < -5) positions[i3] = 5;
        if (positions[i3 + 1] > 3) positions[i3 + 1] = -3;
        if (positions[i3 + 1] < -3) positions[i3 + 1] = 3;
      }

      particleGeo.attributes.position.needsUpdate = true;
      threeRenderer.render(scene, camera);
    }
  }

  animate();

})();
