/* ============================================================
 *  67 MEME DETECTOR - EXTENSION CHROME
 *  V4 - Three.js local (canvas WebGL dans content script)
 *  - Détecte le nombre 67
 *  - Shake + flash psychédélique
 *  - Modèle 3D 67.glb qui tourne au centre de l'écran
 * ============================================================ */

let isProcessing = false;
let animationTimeout = null;

// Référence vers la scène 3D active (pour cleanup)
let active3D = null;

// --- MOTIF DE DÉTECTION ---
const pattern67 = /((?:6|six|⁶)\s*(?:[-—–~,.;:/\\&•·°ªº|]|\b(?:ou|à|et)\b)?\s*(?:7|sept|⁷))/gi;


/* ============================================================
 *  1. STYLES CSS
 * ============================================================ */
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes meme67-flash-bg {
    0%   { filter: hue-rotate(0deg) invert(0);   background-color: transparent; }
    25%  { filter: hue-rotate(90deg) invert(1);   background-color: #ff00ff; }
    50%  { filter: hue-rotate(180deg) invert(0);  background-color: #ffff00; }
    75%  { filter: hue-rotate(270deg) invert(1);  background-color: #00ffff; }
    100% { filter: hue-rotate(360deg) invert(0);  background-color: transparent; }
  }

  @keyframes meme67-hard-shake {
    0%   { transform: translate(1px, 1px) rotate(0deg); }
    10%  { transform: translate(-3px, -2px) rotate(-1deg); }
    20%  { transform: translate(-5px, 0px) rotate(1deg); }
    30%  { transform: translate(5px, 2px) rotate(0deg); }
    40%  { transform: translate(1px, -1px) rotate(1deg); }
    50%  { transform: translate(-3px, 2px) rotate(-1deg); }
    60%  { transform: translate(-5px, 1px) rotate(0deg); }
    70%  { transform: translate(5px, 1px) rotate(-1deg); }
    80%  { transform: translate(-3px, -1px) rotate(1deg); }
    90%  { transform: translate(3px, 2px) rotate(0deg); }
    100% { transform: translate(1px, -2px) rotate(-1deg); }
  }

  body.meme67-mode {
    animation: meme67-flash-bg 0.2s infinite,
               meme67-hard-shake 0.1s infinite !important;
    overflow-x: hidden;
  }

  .meme67-found {
    background-color: #ff0000 !important;
    color: #ffffff !important;
    font-weight: 900 !important;
    font-size: 1.2em !important;
    padding: 2px 5px;
    border: 2px solid yellow;
    border-radius: 4px;
    box-shadow: 0 0 10px #ff00ff;
    display: inline-block;
    animation: meme67-hard-shake 0.5s infinite;
  }

  #meme67-canvas {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    display: block !important;
  }
`;
document.head.appendChild(styleElement);


/* ============================================================
 *  2. SCÈNE 3D - Three.js (utilise le global THREE chargé
 *     par three.min.js + GLTFLoader.js en content scripts)
 *     → Spawn plein de modèles aléatoires !
 * ============================================================ */

// Nombre de modèles à spawner
const MODEL_COUNT_MIN = 15;
const MODEL_COUNT_MAX = 25;

function launch3DModel() {
  // Si une scène tourne déjà, on la stoppe et on en relance une
  if (active3D) {
    kill3D();
  }

  // --- Canvas ---
  const canvas = document.createElement('canvas');
  canvas.id = 'meme67-canvas';
  document.body.appendChild(canvas);

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;

  // --- Scène ---
  const scene = new THREE.Scene();

  // --- Caméra (recul pour voir tout le champ) ---
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // --- Lumières ---
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  // Lumières colorées psychédéliques
  const pinkLight = new THREE.PointLight(0xff00ff, 5, 30);
  pinkLight.position.set(-6, 4, 5);
  scene.add(pinkLight);

  const cyanLight = new THREE.PointLight(0x00ffff, 5, 30);
  cyanLight.position.set(6, -4, 5);
  scene.add(cyanLight);

  const yellowLight = new THREE.PointLight(0xffff00, 5, 30);
  yellowLight.position.set(0, 6, -3);
  scene.add(yellowLight);

  // --- Charger le modèle GLB puis cloner ---
  const modelUrl = chrome.runtime.getURL('67.glb');
  const loader = new THREE.GLTFLoader();

  const instances = [];   // { mesh, targetScale, rotAxis, rotSpeed, posX, posY }
  const startTime = performance.now();
  const DURATION = 2000;
  const FADE_IN = 300;
  const FADE_OUT_START = 1600;
  let animFrameId = null;

  // Combien de modèles ?
  const count = MODEL_COUNT_MIN + Math.floor(Math.random() * (MODEL_COUNT_MAX - MODEL_COUNT_MIN + 1));

  loader.load(
    modelUrl,
    function onLoad(gltf) {
      const original = gltf.scene;

      // Mesurer le modèle pour le normaliser
      const box = new THREE.Box3().setFromObject(original);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const baseScale = 2.0 / maxDim;  // normalise à ~2 unités

      for (let i = 0; i < count; i++) {
        const clone = original.clone();

        // Taille aléatoire (entre 0.8 et 3.0 unités)
        const randomSize = 0.8 + Math.random() * 2.2;
        const finalScale = baseScale * randomSize;

        // Position aléatoire répartie sur tout l'écran
        // X : -8 à 8,  Y : -5 à 5,  Z : -3 à 3
        const px = (Math.random() - 0.5) * 16;
        const py = (Math.random() - 0.5) * 10;
        const pz = (Math.random() - 0.5) * 6;

        clone.position.set(
          px - center.x * finalScale,
          py - center.y * finalScale,
          pz - center.z * finalScale
        );

        // Commence invisible
        clone.scale.set(0.001, 0.001, 0.001);

        // Rotation initiale aléatoire
        clone.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );

        scene.add(clone);

        // Axe de rotation aléatoire (normalisé)
        const rotAxis = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize();

        // Vitesse de rotation aléatoire
        const rotSpeed = 0.03 + Math.random() * 0.12;

        instances.push({
          mesh: clone,
          targetScale: finalScale,
          rotAxis: rotAxis,
          rotSpeed: rotSpeed
        });
      }

      console.log(`✅ 67.glb chargé — ${count} instances spawnées !`);
    },
    undefined,
    function onError(err) {
      console.error('❌ Erreur chargement 67.glb:', err);
    }
  );

  // --- Boucle d'animation ---
  function animate() {
    const elapsed = performance.now() - startTime;

    // Fin de l'animation
    if (elapsed > DURATION) {
      kill3D();
      return;
    }

    // Animer chaque instance
    for (const inst of instances) {
      // Scale avec fade-in / fade-out
      let s;
      if (elapsed < FADE_IN) {
        const t = elapsed / FADE_IN;
        s = inst.targetScale * (1 - Math.pow(1 - t, 3));
      } else if (elapsed > FADE_OUT_START) {
        const t = (elapsed - FADE_OUT_START) / (DURATION - FADE_OUT_START);
        s = inst.targetScale * (1 - t * t);
      } else {
        s = inst.targetScale;
      }
      inst.mesh.scale.set(s, s, s);

      // Rotation autour de l'axe aléatoire
      inst.mesh.rotateOnAxis(inst.rotAxis, inst.rotSpeed);
    }

    // Lumières psychédéliques qui changent de couleur
    const t = elapsed * 0.005;
    pinkLight.color.setHSL((t) % 1, 1, 0.5);
    cyanLight.color.setHSL((t + 0.33) % 1, 1, 0.5);
    yellowLight.color.setHSL((t + 0.66) % 1, 1, 0.5);

    renderer.render(scene, camera);
    animFrameId = requestAnimationFrame(animate);
  }

  animFrameId = requestAnimationFrame(animate);

  // --- Resize handler ---
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // --- Stocker tout pour le cleanup ---
  active3D = { renderer, canvas, animFrameId, onResize };
}


/* ============================================================
 *  3. CLEANUP 3D
 * ============================================================ */
function kill3D() {
  if (!active3D) return;

  cancelAnimationFrame(active3D.animFrameId);
  window.removeEventListener('resize', active3D.onResize);
  active3D.renderer.dispose();

  if (active3D.canvas && active3D.canvas.parentNode) {
    active3D.canvas.remove();
  }

  active3D = null;
}


/* ============================================================
 *  4. DÉCLENCHEUR PRINCIPAL
 * ============================================================ */
function triggerPsychedelicMode() {
  const body = document.body;

  // A. Animation CSS (shake + flash)
  if (body.classList.contains('meme67-mode')) {
    clearTimeout(animationTimeout);
  } else {
    body.classList.add('meme67-mode');
    console.log('⚠️ 67 DÉTECTÉ ! CHAOS ACTIVÉ ⚠️');
  }

  // B. Lancer le modèle 3D
  launch3DModel();

  // C. Timer de fin (2 s)
  animationTimeout = setTimeout(() => {
    body.classList.remove('meme67-mode');
    kill3D();
  }, 2000);
}


/* ============================================================
 *  5. SCAN & HIGHLIGHT
 * ============================================================ */
function scanAndHighlight(node) {
  if (isProcessing) return false;
  let foundSomething = false;

  // Nœud texte
  if (node.nodeType === 3 && node.nodeValue.trim() !== '') {
    const text = node.nodeValue;

    if (pattern67.test(text)) {
      const parent = node.parentNode;
      const forbidden = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE'];
      if (parent && (forbidden.includes(parent.tagName) ||
                     parent.classList.contains('meme67-found'))) {
        return false;
      }

      isProcessing = true;

      const fragment = document.createDocumentFragment();
      const parts = text.split(pattern67);

      parts.forEach(part => {
        if (new RegExp(pattern67.source, 'i').test(part)) {
          const span = document.createElement('span');
          span.className = 'meme67-found';
          span.textContent = part;
          fragment.appendChild(span);
          foundSomething = true;
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      });

      parent.replaceChild(fragment, node);
      isProcessing = false;
    }
  }
  // Nœud élément
  else if (node.nodeType === 1) {
    if (['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT'].includes(node.tagName)) return false;
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (scanAndHighlight(child)) foundSomething = true;
    }
  }

  return foundSomething;
}


/* ============================================================
 *  6. MUTATION OBSERVER
 * ============================================================ */
const observer = new MutationObserver(mutations => {
  if (isProcessing) return;
  let detected = false;
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (scanAndHighlight(node)) detected = true;
    });
  });
  if (detected) triggerPsychedelicMode();
});


/* ============================================================
 *  7. INITIALISATION
 * ============================================================ */
setTimeout(() => {
  console.log('🔍 67 Meme Detector V4 initialisé (Three.js local)');

  // Vérifier que THREE est bien chargé
  if (typeof THREE === 'undefined') {
    console.error('❌ THREE.js non chargé !');
    return;
  }
  if (typeof THREE.GLTFLoader === 'undefined') {
    console.error('❌ GLTFLoader non chargé !');
    return;
  }
  console.log('✅ THREE.js + GLTFLoader OK');

  if (scanAndHighlight(document.body)) {
    triggerPsychedelicMode();
  }
  observer.observe(document.body, { childList: true, subtree: true });
}, 1000);