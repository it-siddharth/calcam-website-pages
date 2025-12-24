/**
 * Journal Flipbook - Realistic Magazine Physics
 * Cylindrical page curl with moving cylinder axis
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// Configuration
// ============================================
const CONFIG = {
  pageWidth: 2.2,
  pageHeight: 3.1,
  spineWidth: 0.025,  // Much thinner, more subtle
  pageCount: 8,
  pageThickness: 0.015,  // Increased to prevent z-fighting
  flipDuration: 1400,
  
  // Cylindrical curl parameters
  cylinderRadius: 0.35,  // How tight the curl is (larger = more visible curl)
  maxCurlHeight: 0.4,  // Maximum height of the curl
};

// ============================================
// State
// ============================================
let scene, camera, renderer, controls, clock;
let magazine, spine;
let pages = [];
let currentPage = 0;
let isFlipping = false;

// ============================================
// Initialize
// ============================================
function init() {
  const container = document.getElementById('three-container');
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = null;

  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 100);
  camera.position.set(0, 4.5, 6.5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  setupLighting();
  setupControls();
  createMagazine();
  setupEvents();
  animate();
}

function setupLighting() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
  keyLight.position.set(4, 8, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0001;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xf0f5ff, 0.4);
  fillLight.position.set(-4, 4, 2);
  scene.add(fillLight);
}

function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 4;
  controls.maxDistance = 12;
  controls.target.set(CONFIG.pageWidth / 2, 0, 0);
  controls.maxPolarAngle = Math.PI * 0.65;
  controls.minPolarAngle = Math.PI * 0.2;
}

// ============================================
// Magazine Creation
// ============================================
function createMagazine() {
  magazine = new THREE.Group();

  // Create subtle spine
  createSpine();

  // Create pages
  for (let i = 0; i < CONFIG.pageCount; i++) {
    const page = createPage(i);
    pages.push(page);
    magazine.add(page.group);
  }

  // Hide all pages except cover
  pages.forEach((p, i) => {
    p.group.visible = (i === 0);
  });

  // Position magazine
  magazine.rotation.x = -0.35;
  magazine.position.y = -0.3;

  scene.add(magazine);
}

function createSpine() {
  const { spineWidth, pageHeight, pageCount, pageThickness } = CONFIG;
  const depth = pageCount * pageThickness * 3 + 0.015;

  // Thin, subtle spine
  const geometry = new THREE.BoxGeometry(spineWidth, pageHeight, depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.7,
    metalness: 0.05,
  });

  spine = new THREE.Mesh(geometry, material);
  spine.castShadow = true;
  spine.receiveShadow = true;
  magazine.add(spine);
}

function createPage(index) {
  const { pageWidth, pageHeight, pageThickness, pageCount, spineWidth } = CONFIG;

  // High segment count for smooth cylindrical bending
  const geometry = new THREE.PlaneGeometry(pageWidth, pageHeight, 60, 10);
  geometry.translate(pageWidth / 2, 0, 0);

  // Store original positions
  const pos = geometry.attributes.position;
  const originalPositions = new Float32Array(pos.array);

  // Textures
  const frontTex = createTexture(index * 2);
  const backTex = createTexture(index * 2 + 1, true);

  // Materials
  const frontMat = new THREE.MeshStandardMaterial({
    map: frontTex,
    side: THREE.FrontSide,
    roughness: 0.4,
    metalness: 0.05,
  });

  const backMat = new THREE.MeshStandardMaterial({
    map: backTex,
    side: THREE.BackSide,
    roughness: 0.4,
    metalness: 0.05,
  });

  const frontMesh = new THREE.Mesh(geometry, frontMat);
  frontMesh.castShadow = true;
  frontMesh.receiveShadow = true;

  const backMesh = new THREE.Mesh(geometry, backMat);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(frontMesh);
  group.add(backMesh);

  // Position at spine - cover on top (negative Z = closer to camera)
  const zPos = index * pageThickness * 2;
  group.position.x = spineWidth / 2;
  group.position.z = -zPos;  // Negative so cover (index 0) is at z=0, on top

  return {
    group,
    geometry,
    originalPositions,
    index,
    isFlipped: false,
  };
}

function createTexture(pageNum, mirror = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1448;
  const ctx = canvas.getContext('2d');

  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  const isCover = pageNum === 0;
  const isBackCover = pageNum === CONFIG.pageCount * 2 - 1;

  ctx.fillStyle = (isCover || isBackCover) ? '#1a1a1a' : '#fefefe';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (isCover) {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#ff4444');
    grad.addColorStop(0.5, '#ffaa00');
    grad.addColorStop(1, '#4488ff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 20;
    ctx.strokeRect(100, 100, canvas.width - 200, canvas.width - 200);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 80px Helvetica, Arial';
    ctx.fillText('VIEWER', canvas.width / 2, canvas.height * 0.68);
    ctx.font = '300 80px Helvetica, Arial';
    ctx.fillText('JOURNAL', canvas.width / 2, canvas.height * 0.68 + 90);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#666';
    ctx.fillText('CALCULATED CAMOUFLAGE', canvas.width / 2, canvas.height - 60);
  } else if (!isBackCover) {
    ctx.fillStyle = '#ccc';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`PAGE ${pageNum}`, canvas.width / 2, canvas.height / 2);
    ctx.font = '14px monospace';
    ctx.fillText('(Your scanned image here)', canvas.width / 2, canvas.height / 2 + 40);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  return tex;
}

// ============================================
// Page Flip
// ============================================
function flipPage(direction) {
  if (isFlipping) return;

  let targetPage;
  if (direction > 0 && currentPage < pages.length) {
    targetPage = pages[currentPage];
  } else if (direction < 0 && currentPage > 0) {
    targetPage = pages[currentPage - 1];
  } else {
    return;
  }

  isFlipping = true;

  // Show next page before flip
  if (direction > 0 && currentPage + 1 < pages.length) {
    pages[currentPage + 1].group.visible = true;
  }

  const startProgress = direction > 0 ? 0 : 1;
  const endProgress = direction > 0 ? 1 : 0;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    let t = Math.min(elapsed / CONFIG.flipDuration, 1);
    t = easeInOutCubic(t);

    const progress = startProgress + (endProgress - startProgress) * t;
    applyCylindricalCurl(targetPage, progress);

    if (elapsed < CONFIG.flipDuration) {
      requestAnimationFrame(step);
    } else {
      targetPage.isFlipped = direction > 0;
      if (direction > 0) {
        currentPage++;
      } else {
        currentPage--;
      }
      updateVisibility();
      isFlipping = false;
    }
  }

  requestAnimationFrame(step);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateVisibility() {
  pages.forEach((page, i) => {
    if (currentPage === 0) {
      // Magazine closed - only show cover
      page.group.visible = (i === 0);
    } else {
      // Magazine open - show current spread
      const isLeftPage = (i === currentPage - 1 && page.isFlipped);
      const isRightPage = (i === currentPage && !page.isFlipped);
      page.group.visible = isLeftPage || isRightPage;
    }
  });
}

// ============================================
// Cylindrical Page Curl Physics
// ============================================
/**
 * Applies realistic cylindrical curl to the page.
 * 
 * The page wraps around a virtual cylinder that sweeps across the page:
 * - Points BEFORE the cylinder: already flipped (flat on left side, rotated 180°)
 * - Points ON the cylinder: wrapped around it (the curl)
 * - Points AFTER the cylinder: not yet flipped (flat on right side)
 * 
 * @param {Object} page - The page object
 * @param {number} progress - 0 = unflipped, 1 = fully flipped
 */
function applyCylindricalCurl(page, progress) {
  const { geometry, originalPositions } = page;
  const pos = geometry.attributes.position;
  const { pageWidth, pageHeight, cylinderRadius, maxCurlHeight } = CONFIG;

  // progress 0 = page flat on right, 1 = page flat on left
  
  // Curl intensity peaks at the middle of the flip
  const curlIntensity = Math.sin(progress * Math.PI);
  
  // Main flip rotation angle (0 to PI)
  const flipAngle = progress * Math.PI;

  for (let i = 0; i < pos.count; i++) {
    const ox = originalPositions[i * 3];     // Original X (0 to pageWidth)
    const oy = originalPositions[i * 3 + 1]; // Original Y
    const oz = originalPositions[i * 3 + 2]; // Original Z

    // Normalized position along page width (0 = spine, 1 = edge)
    const u = ox / pageWidth;

    // Corner lead: top of page slightly ahead of bottom during flip
    const vNorm = (oy / pageHeight) + 0.5;
    const cornerLead = vNorm * 0.05 * curlIntensity;

    // === CYLINDRICAL CURL ===
    // Create a curve that lifts the middle of the page
    // Curl is strongest in the middle of the page (u=0.5) and at mid-flip
    const curlProfile = Math.sin(u * Math.PI);  // 0 at edges, 1 in middle
    const curlHeight = curlProfile * maxCurlHeight * curlIntensity;
    
    // The curl also causes some x compression
    const curlCompression = curlProfile * 0.1 * curlIntensity;
    const effectiveX = ox * (1 - curlCompression);

    // === MAIN ROTATION around spine (Y-axis) ===
    // Apply the corner lead to the rotation
    const effectiveFlipAngle = flipAngle + cornerLead * 0.3;
    
    // Rotate around spine
    const rotatedX = effectiveX * Math.cos(effectiveFlipAngle);
    const rotatedZ = effectiveX * Math.sin(effectiveFlipAngle);

    // Add the curl height (perpendicular to the page surface)
    // During flip, "up" in page space becomes a mix of Y and Z in world space
    const curlY = curlHeight * Math.cos(effectiveFlipAngle);
    const curlZ = curlHeight * Math.sin(effectiveFlipAngle);

    // === GRAVITY DROOP ===
    // Page edge droops slightly during flip
    const droop = Math.pow(u, 2) * curlIntensity * 0.08;

    // === SUBTLE FLUTTER ===
    const flutter = Math.sin(u * 6 + progress * 5) * 0.004 * curlIntensity;

    const finalX = rotatedX;
    const finalY = oy - droop + curlY;
    const finalZ = rotatedZ + curlZ + oz + flutter;

    pos.setXYZ(i, finalX, finalY, finalZ);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

// ============================================
// Events
// ============================================
function setupEvents() {
  window.addEventListener('resize', onResize);

  renderer.domElement.addEventListener('click', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    flipPage(x > 0 ? 1 : -1);
  });

  let touchX = 0;
  renderer.domElement.addEventListener('touchstart', (e) => {
    touchX = e.touches[0].clientX;
  }, { passive: true });

  renderer.domElement.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) flipPage(dx < 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') flipPage(1);
    if (e.key === 'ArrowLeft') flipPage(-1);
  });
}

function onResize() {
  const container = document.getElementById('three-container');
  if (!container) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ============================================
// Animation Loop
// ============================================
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  if (magazine && !isFlipping) {
    magazine.position.y = -0.3 + Math.sin(time * 0.5) * 0.015;
    magazine.rotation.z = Math.sin(time * 0.3) * 0.004;
  }

  controls.update();
  renderer.render(scene, camera);
}

// ============================================
// Start
// ============================================
init();
