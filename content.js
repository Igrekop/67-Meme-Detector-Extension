/* * 67 MEME DETECTOR - EXTENSION CHROME
 * V3 - Durée courte (2 secondes) + 3D MODEL
 */

let isProcessing = false;
let animationTimeout = null;

// --- LE MOTIF DE DÉTECTION ---
const pattern67 = /((?:6|six|⁶)\s*(?:[-—–~,.;:/\\&•·°ªº|]|\b(?:ou|à|et)\b)?\s*(?:7|sept|⁷))/gi;

// 1. STYLES CSS (Ajout du style pour le conteneur 3D)
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes meme67-flash-bg {
    0% { filter: hue-rotate(0deg) invert(0); background-color: transparent; }
    25% { filter: hue-rotate(90deg) invert(1); background-color: #ff00ff; }
    50% { filter: hue-rotate(180deg) invert(0); background-color: #ffff00; }
    75% { filter: hue-rotate(270deg) invert(1); background-color: #00ffff; }
    100% { filter: hue-rotate(360deg) invert(0); background-color: transparent; }
  }
  @keyframes meme67-hard-shake {
    0% { transform: translate(1px, 1px) rotate(0deg); }
    10% { transform: translate(-3px, -2px) rotate(-1deg); }
    20% { transform: translate(-5px, 0px) rotate(1deg); }
    30% { transform: translate(5px, 2px) rotate(0deg); }
    40% { transform: translate(1px, -1px) rotate(1deg); }
    50% { transform: translate(-3px, 2px) rotate(-1deg); }
    60% { transform: translate(-5px, 1px) rotate(0deg); }
    70% { transform: translate(5px, 1px) rotate(-1deg); }
    80% { transform: translate(-3px, -1px) rotate(1deg); }
    90% { transform: translate(3px, 2px) rotate(0deg); }
    100% { transform: translate(1px, -2px) rotate(-1deg); }
  }
  body.meme67-mode {
    animation: meme67-flash-bg 0.2s infinite, meme67-hard-shake 0.1s infinite !important;
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
  
  /* NOUVEAU : Container pour le modèle 3D */
  #meme67-3d-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    height: 500px;
    z-index: 2147483647; /* Maximum possible */
    pointer-events: none; /* Pour pouvoir cliquer à travers si besoin */
    display: block;
  }
  
  /* Cache le modèle quand l'animation n'est pas active */
  model-viewer {
    width: 100%;
    height: 100%;
    --poster-color: transparent;
  }
`;
document.head.appendChild(styleElement);


// 2. DÉCLENCHEUR D'ANIMATION ET DE 3D
function triggerPsychedelicMode() {
  const body = document.body;
  
  // A. Gestion de l'animation CSS
  if (body.classList.contains('meme67-mode')) {
    clearTimeout(animationTimeout);
  } else {
    body.classList.add('meme67-mode');
    console.log("⚠️ 67 DÉTECTÉ ! CHAOS ACTIVÉ ⚠️");
  }

  // B. Gestion du Modèle 3D
  // On vérifie si le container existe déjà, sinon on le crée
  let modelContainer = document.getElementById('meme67-3d-container');
  
  if (!modelContainer) {
    modelContainer = document.createElement('div');
    modelContainer.id = 'meme67-3d-container';
    
    // On récupère l'URL du fichier GLB dans l'extension
    const modelUrl = chrome.runtime.getURL('67.glb');
    
    // On injecte la balise model-viewer
    // auto-rotate : fait tourner
    // rotation-per-second : vitesse de rotation (ici rapide pour le chaos)
    // shadow-intensity : ombre
    modelContainer.innerHTML = `
      <model-viewer 
        src="${modelUrl}" 
        auto-rotate 
        rotation-per-second="200%" 
        camera-controls 
        disable-zoom 
        shadow-intensity="1" 
        ar-status="not-present">
      </model-viewer>
    `;
    
    document.body.appendChild(modelContainer);
  }


  // C. TIMER DE FIN (2 secondes)
  animationTimeout = setTimeout(() => {
    // Stop le CSS
    body.classList.remove('meme67-mode');
    
    // Supprime le modèle 3D du DOM pour ne pas alourdir la page
    if (modelContainer) {
      modelContainer.remove();
    }
  }, 2000); 
}


// 3. SCAN ET REMPLACEMENT (Inchangé)
function scanAndHighlight(node) {
  if (isProcessing) return false;
  let foundSomething = false;

  if (node.nodeType === 3 && node.nodeValue.trim() !== '') {
    const text = node.nodeValue;
    
    if (pattern67.test(text)) {
      const parent = node.parentNode;
      const forbiddenTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'MODEL-VIEWER'];
      if (parent && (forbiddenTags.includes(parent.tagName) || parent.classList.contains('meme67-found'))) {
        return false;
      }

      isProcessing = true;

      const fragment = document.createDocumentFragment();
      const parts = text.split(pattern67); 

      parts.forEach(part => {
        const checkMatch = new RegExp(pattern67.source, 'i').test(part);

        if (checkMatch) {
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
  else if (node.nodeType === 1) {
    if (['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT', 'MODEL-VIEWER'].includes(node.tagName)) return false;
    const children = Array.from(node.childNodes);
    for (let child of children) {
      if (scanAndHighlight(child)) foundSomething = true;
    }
  }
  return foundSomething;
}


// 4. OBSERVER (Inchangé)
const observer = new MutationObserver((mutations) => {
  if (isProcessing) return;
  let detected = false;
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (scanAndHighlight(node)) detected = true;
    });
  });
  if (detected) triggerPsychedelicMode();
});


// 5. INIT (Inchangé)
setTimeout(() => {
  if (scanAndHighlight(document.body)) triggerPsychedelicMode();
  observer.observe(document.body, { childList: true, subtree: true });
}, 1000);