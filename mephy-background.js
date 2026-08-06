// mephy-background.js — the spinning chrome MEPHY logo as an always-on page
// background. Derived from mephy-screensaver.js: the scene (geometry, materials,
// spin, sky) is identical; the idle/overlay screensaver machinery is replaced by
// a fixed full-viewport layer behind the page content that starts on load.
//
// ── Plain HTML site ─────────────────────────────────────────────────────────
//   1. Put Mephy.svg in the site root (or pass svgUrl below).
//   2. Add BEFORE this script:
//      <script type="importmap">
//      {"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
//                  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}
//      </script>
//      <script type="module" src="/mephy-background.js"></script>
//   It auto-starts on load.
//
// ── React / Next.js ─────────────────────────────────────────────────────────
//   npm i three — then set window.MEPHY_BG_MANUAL = true before importing,
//   import { initMephyBackground } from './mephy-background';
//   and call initMephyBackground() once in a client-side useEffect.

import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

export function initMephyBackground({
  svgUrl = '/Mephy.svg',
  speed = 0.7,         // spin speed (radians/sec through the 180° loop)
  zIndex = 0,
  margin = 1.12,       // camera pullback: higher = smaller emblem, more sky
  offsetY = 0,         // fraction of emblem height to raise it on screen
  transparent = false, // true: no sky, clear canvas — emblem floats over the page
} = {}) {
  const layer = document.createElement('div');
  layer.style.cssText = `position:fixed;inset:0;z-index:${zIndex};pointer-events:none;`;
  document.body.prepend(layer);

  let renderer = null, scene = null, camera = null, logoGroup = null;
  let raf = 0, spinT = 0, lastT = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- helpers
  const seededRnd = seed => {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  };

  // hard-horizon band map: the classic airbrushed-chrome reflection
  function makeEnv() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    [[0, '#0b1a4d'], [0.30, '#3f7fd9'], [0.44, '#cfe9ff'], [0.495, '#ffffff'],
     [0.505, '#1a0e04'], [0.62, '#4a2c0f'], [0.80, '#0d0d0d'], [1, '#000000']]
      .forEach(([p, col]) => grad.addColorStop(p, col));
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    const rnd = seededRnd(7);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 26; i++) {
      g.fillStyle = rnd() > 0.5 ? '#0a0a12' : '#ffffff';
      g.fillRect(rnd() * c.width, c.height * 0.46, 6 + rnd() * 40, c.height * 0.12);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // pastel dusk backdrop with soft stretched cloud washes
  function makeSky() {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const g = c.getContext('2d');
    const w = c.width, h = c.height;
    const grad = g.createLinearGradient(0, 0, 0, h);
    [[0, '#96bfe8'], [0.4, '#b9c6ea'], [0.62, '#d5c2e0'], [0.8, '#eac3d6'],
     [0.92, '#f0bccc'], [1, '#93a8d0']].forEach(([p, col]) => grad.addColorStop(p, col));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const rnd = seededRnd(31);
    const bank = ({ count, yMin, yMax, tint, alpha, stretch, puffScale }) => {
      for (let i = 0; i < count; i++) {
        const cx = rnd() * w, cy = h * (yMin + rnd() * (yMax - yMin));
        const size = h * (0.03 + rnd() * 0.06) * puffScale;
        const puffs = 6 + Math.floor(rnd() * 6);
        for (let p = 0; p < puffs; p++) {
          const px = cx + (rnd() - 0.5) * size * 7;
          const py = cy + (rnd() - 0.5) * size * 1.8;
          const r = size * (0.5 + rnd());
          g.save();
          g.translate(px, py);
          g.scale(stretch, 1);
          const rg = g.createRadialGradient(0, 0, 0, 0, 0, r);
          rg.addColorStop(0, `rgba(${tint},${alpha})`);
          rg.addColorStop(1, `rgba(${tint},0)`);
          g.fillStyle = rg;
          g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
          g.restore();
        }
      }
    };
    bank({ count: 8, yMin: 0.05, yMax: 0.5, tint: '246,196,214', alpha: 0.14, stretch: 5.5, puffScale: 2.2 });
    bank({ count: 6, yMin: 0.1, yMax: 0.42, tint: '250,214,226', alpha: 0.2, stretch: 4.5, puffScale: 1.7 });
    bank({ count: 6, yMin: 0.55, yMax: 0.82, tint: '246,183,203', alpha: 0.24, stretch: 6.5, puffScale: 1.6 });
    bank({ count: 4, yMin: 0.12, yMax: 0.3, tint: '255,229,238', alpha: 0.2, stretch: 5, puffScale: 1.4 });
    bank({ count: 5, yMin: 0.3, yMax: 0.6, tint: '176,198,232', alpha: 0.16, stretch: 6, puffScale: 2 });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---------------------------------------------------------------- scene
  function buildScene(svgPaths) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
    if (transparent) renderer.setClearColor(0x000000, 0);
    layer.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = transparent ? null : makeSky();
    scene.environment = makeEnv();

    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(0, 6, 7); // centered: both sweep directions shade the same
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.08));

    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 1.35,
    });

    // extrude every SVG layer flush onto one slab
    logoGroup = new THREE.Group();
    const stack = new THREE.Group();
    svgPaths.forEach((path, i) => {
      const shapes = SVGLoader.createShapes(path);
      if (!shapes.length) return;
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth: 28, bevelEnabled: true, bevelThickness: 2.2, bevelSize: 2.2,
        bevelSegments: 7, curveSegments: 48,
      });
      const mesh = new THREE.Mesh(geo, chrome);
      mesh.position.z = i * 0.4; // epsilon: no z-fighting between flush layers
      stack.add(mesh);
    });

    let box = new THREE.Box3().setFromObject(stack);
    const center = box.getCenter(new THREE.Vector3());
    stack.position.set(-center.x, -center.y, -(box.min.z + box.max.z) / 2);

    const inner = new THREE.Group();
    inner.scale.y = -1; // SVG y-axis points down
    inner.add(stack);
    logoGroup.add(inner);

    // oval chrome frame, tight-fit and center-balanced around the logo
    const sz = box.getSize(new THREE.Vector3());
    const a0 = sz.x / 2, b0 = sz.y / 2;
    const pts = [];
    stack.traverse(o => {
      if (!o.isMesh) return;
      const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++)
        pts.push(pa.getX(i) + stack.position.x, pa.getY(i) + stack.position.y);
    });
    const evalK = (cx, cy, stride) => {
      let k = 0;
      for (let i = 0; i < pts.length; i += 2 * stride) {
        const d = Math.hypot((pts[i] - cx) / a0, (pts[i + 1] - cy) / b0);
        if (d > k) k = d;
      }
      return k;
    };
    const stride = Math.max(1, Math.floor(pts.length / 2 / 3000));
    let cx = 0, cy = 0, span = Math.max(sz.x, sz.y) * 0.15;
    for (let it = 0; it < 4; it++) {
      let best = [cx, cy, evalK(cx, cy, stride)];
      for (let gx = -3; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) {
        const tx = cx + (gx / 3) * span, ty = cy + (gy / 3) * span;
        const k = evalK(tx, ty, stride);
        if (k < best[2]) best = [tx, ty, k];
      }
      [cx, cy] = best;
      span /= 3;
    }
    const k = evalK(cx, cy, 1) * 1.01;
    stack.position.x -= cx;
    stack.position.y -= cy;
    const RING_W = 22, RING_D = 34;
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, a0 * k + RING_W, b0 * k + RING_W, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, a0 * k, b0 * k, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
      depth: RING_D, bevelEnabled: true, bevelThickness: 2.2, bevelSize: 2.2,
      bevelSegments: 7, curveSegments: 512,
    }), chrome);
    ring.position.z = -RING_D / 2;
    inner.add(ring);

    box = new THREE.Box3().setFromObject(logoGroup);
    const size = box.getSize(new THREE.Vector3());
    logoGroup.scale.setScalar(5.6 / Math.max(size.x, size.y * 1.2));
    scene.add(logoGroup);
    fitViewport();
  }

  // frame the full swept extent for the current window aspect
  function fitViewport() {
    if (!renderer) return;
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    const box = new THREE.Box3().setFromObject(logoGroup);
    const size = box.getSize(new THREE.Vector3());
    const sweep = Math.hypot(size.x, size.z);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max((sweep / 2) / (tan * camera.aspect), (size.y / 2) / tan);
    const y = -size.y * offsetY;
    camera.position.set(0, y, dist * margin);
    camera.lookAt(0, y, 0);
    camera.updateProjectionMatrix();
    if (reducedMotion) renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- loop
  function tick(t) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((t - lastT) / 1000, 0.1);
    lastT = t;
    spinT += dt;
    // seamless 180 loop: sweep -90°..+90° through frontal, wrap edge-on
    const HALF = Math.PI / 2;
    const a = spinT * speed;
    logoGroup.rotation.y = ((((a + HALF) % Math.PI) + Math.PI) % Math.PI) - HALF;
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- start
  new SVGLoader().load(svgUrl, data => {
    buildScene(data.paths);
    addEventListener('resize', fitViewport);
    if (reducedMotion) {
      renderer.render(scene, camera); // static frontal frame, no spin
    } else {
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }
  });

  return {
    stop() { cancelAnimationFrame(raf); },
  };
}

// auto-start unless the host app opts into manual control
if (typeof window !== 'undefined' && !window.MEPHY_BG_MANUAL) {
  initMephyBackground();
}
