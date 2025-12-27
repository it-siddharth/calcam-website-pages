import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ============================================
// Scene Configuration (matching home page)
// ============================================
const CONFIG = {
  // Room dimensions (meters) - narrower gallery
  room: {
    width: 5,
    height: 7,
    depth: 10
  },
  
  // Acrylic panel colors (matching home page exactly)
  colors: {
    yellow: 0xFDFF00,
    red: 0xFF0505,
    green: 0x11FF00,
    blue: 0x2600FF
  },
  
  // Panel dimensions (matching home page exactly)
  panel: {
    width: 1.2,
    height: 1.5,
    depth: 0.02,
    opacity: 0.45
  },
  
  // Default spacing values (matching home page)
  defaults: {
    hSpread: 0.35,
    vSpread: 1,
    zOffset: 0.50,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0
  },
  
  // TV dimensions (matching home page exactly)
  tv: {
    width: 1.8,
    height: 2.5,
    depth: 0.1,
    screenInset: 0.05,
    bezelWidth: 0.08
  },
  
  // Stand dimensions (matching home page)
  stand: {
    poleHeight: 8,
    poleRadius: 0.03,
    baseWidth: 0.4
  },
  
  // Player settings
  player: {
    height: 1.6,
    speed: 4.0,  // Reasonable walking speed
    sprintMultiplier: 2.0
  }
};

// ============================================
// Room Settings (controllable) - much darker
// ============================================
const roomSettings = {
  ambient: 0.00,
  wallColor: '#545454',
  floorColor: '#3d3d3d',
  ceilingColor: '#3d3d3d',
  projectionOn: true,
  projectionIntensity: 0.8,
  panelOpacity: 0.45,
  tvFrameColor: '#1c1c1c',
  tvBorderVisible: false,
  tvBorderColor: '#1c1c1c',
  cameraHeight: 2.25,  // Eye level height
  tvHeight: 2.25       // TV center height from floor
};

// Panel base positions (matching home page)
const panelBasePositions = [
  { x: -0.45, y: 0.75, z: 0.10 },
  { x: 0.50, y: 0.95, z: 0.12 },
  { x: -0.35, y: 0.05, z: 0.14 },
  { x: 0.60, y: 0.25, z: 0.16 }
];

// ============================================
// Global Variables
// ============================================
let scene, camera, renderer, controls;
let installationGroup, tvGroup, tvScreen, tvScreenTexture, tvFrame, screenBorder;
let standPole;
let acrylicPanels = [];
let projectionPlane, projectionMaterial;
let ambientLight, tvGlow;
let walls = [], floor, ceiling, backWall;
let speakers = [];
let silhouetteCanvas, silhouetteCtx;

// Movement
let moveForward = false, moveBackward = false;
let moveLeft = false, moveRight = false;
let isSprinting = false;
let prevTime = performance.now();

// Touch controls for mobile
let isMobile = false;
let touchStartX = 0, touchStartY = 0;
let touchDeltaX = 0, touchDeltaY = 0;
let isTouching = false;
let cameraEuler = { yaw: 0, pitch: 0 };
const TOUCH_SENSITIVITY = 0.003;

// Projection animation
let projectionTime = 0;
let particlePositions = [];
const PARTICLE_COUNT = 12000;

// Model control state
let hSpread = CONFIG.defaults.hSpread;
let vSpread = CONFIG.defaults.vSpread;
let zOffset = CONFIG.defaults.zOffset;

// Cinematic intro state
let isCinematicIntro = false;
let cinematicAnimationId = null;

// Anchor point system
let anchorPoints = {};
let activeAnchor = null;
let isAnchorFocused = false;
let anchorAnimationId = null;
let savedCameraState = null;

// ============================================
// Easing Functions
// ============================================
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function lerpVector3(start, end, t) {
  return new THREE.Vector3(
    lerp(start.x, end.x, t),
    lerp(start.y, end.y, t),
    lerp(start.z, end.z, t)
  );
}

// ============================================
// Cinematic Intro Animation
// ============================================
function checkCinematicTransition() {
  // Always play the cinematic intro as a loading animation
  return true;
}

function setupCinematicStartPosition() {
  // Set camera to match the home page view - directly in front of model, looking at it
  // This should be called BEFORE the first render
  const installationZ = -CONFIG.room.depth / 2;
  
  // Start position: directly in front of the installation (like home page view)
  camera.position.set(0, roomSettings.tvHeight, installationZ + 3);
  camera.lookAt(0, roomSettings.tvHeight, installationZ);
}

function fadeOutPageTransition() {
  const overlay = document.getElementById('page-transition');
  if (overlay) {
    // Small delay to ensure first frame is rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('fade-out');
        // Remove from DOM after fade
        setTimeout(() => {
          overlay.remove();
        }, 600);
      });
    });
  }
}

function startCinematicIntro() {
  isCinematicIntro = true;
  // cinematic-intro class is already on body from HTML - no need to add
  
  // Animation parameters
  const duration = 2000; // 2 seconds - faster
  const startTime = performance.now();
  
  // Installation position
  const installationZ = -CONFIG.room.depth / 2;
  
  // Start position: directly in front (matching home page view)
  const startPos = {
    x: 0,
    y: roomSettings.tvHeight,
    z: installationZ + 3
  };
  
  // End position: default installation view (pulled back, slightly higher)
  const endPos = {
    x: 0,
    y: roomSettings.cameraHeight,
    z: CONFIG.room.depth / 2 - 2
  };
  
  // Look-at targets
  const startLookAt = { x: 0, y: roomSettings.tvHeight, z: installationZ };
  const endLookAt = { x: 0, y: roomSettings.tvHeight, z: installationZ };
  
  function animateCinematic(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuart(progress);
    
    // Smoothly interpolate camera position
    camera.position.x = lerp(startPos.x, endPos.x, eased);
    camera.position.y = lerp(startPos.y, endPos.y, eased);
    camera.position.z = lerp(startPos.z, endPos.z, eased);
    
    // Keep looking at the installation
    camera.lookAt(
      lerp(startLookAt.x, endLookAt.x, eased),
      lerp(startLookAt.y, endLookAt.y, eased),
      lerp(startLookAt.z, endLookAt.z, eased)
    );
    
    if (progress < 1) {
      cinematicAnimationId = requestAnimationFrame(animateCinematic);
    } else {
      // Animation complete - ensure final position is exact
      camera.position.set(endPos.x, endPos.y, endPos.z);
      camera.lookAt(endLookAt.x, endLookAt.y, endLookAt.z);
      
      // Trigger UI reveal
      finishCinematicIntro();
    }
  }
  
  // Start the animation
  cinematicAnimationId = requestAnimationFrame(animateCinematic);
}

function finishCinematicIntro() {
  isCinematicIntro = false;
  document.body.classList.remove('cinematic-intro');
  
  if (cinematicAnimationId) {
    cancelAnimationFrame(cinematicAnimationId);
    cinematicAnimationId = null;
  }
  
  // Reset camera to final position
  camera.position.set(0, roomSettings.cameraHeight, CONFIG.room.depth / 2 - 2);
  camera.lookAt(0, roomSettings.tvHeight, -CONFIG.room.depth / 2);
  
  // Sync camera euler for mobile touch controls
  if (isMobile) {
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    cameraEuler.yaw = euler.y;
    cameraEuler.pitch = euler.x;
  }
  
  // Reveal UI elements with staggered animation
  revealUIElements();
}

function skipCinematicIntro() {
  if (!isCinematicIntro) return;
  finishCinematicIntro();
}

function revealUIElements() {
  // Remove cinematic-intro class to reveal all UI at once with CSS transitions
  document.body.classList.remove('cinematic-intro');
  
  // Add revealed class to trigger smooth fade-in
  document.body.classList.add('cinematic-revealed');
}

function setupCinematicSkipListeners() {
  // Skip on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isCinematicIntro) {
      skipCinematicIntro();
    }
    // Also close anchor panel on Escape
    if (e.key === 'Escape' && isAnchorFocused) {
      closeAnchorPanel();
    }
  });
  
  // Skip on click (but not on UI elements)
  document.addEventListener('click', (e) => {
    if (isCinematicIntro && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
      skipCinematicIntro();
    }
  });
}

// ============================================
// Anchor Point System
// ============================================
function setupAnchorPoints() {
  // Define anchor point 3D positions and camera targets
  anchorPoints = {
    center: {
      // Position of the anchor indicator in 3D space
      position: new THREE.Vector3(0, roomSettings.tvHeight, -CONFIG.room.depth / 2 + 0.5),
      // Where the camera should move to when focused
      cameraPosition: new THREE.Vector3(0, roomSettings.cameraHeight, 1.5),
      // Where the camera should look at
      lookAt: new THREE.Vector3(0, roomSettings.tvHeight, -CONFIG.room.depth / 2),
      // DOM elements
      indicator: document.getElementById('anchor-center'),
      panel: document.getElementById('info-center'),
      // Panel offset from projected position
      panelOffset: { x: 120, y: -80 }
    },
    left: {
      position: new THREE.Vector3(-CONFIG.room.width / 2 + 0.3, 2, -1),
      cameraPosition: new THREE.Vector3(-0.5, roomSettings.cameraHeight, 1),
      lookAt: new THREE.Vector3(-CONFIG.room.width / 2, 2, -1),
      indicator: document.getElementById('anchor-left'),
      panel: document.getElementById('info-left'),
      panelOffset: { x: 80, y: -60 }
    },
    right: {
      position: new THREE.Vector3(CONFIG.room.width / 2 - 0.3, 2, -1),
      cameraPosition: new THREE.Vector3(0.5, roomSettings.cameraHeight, 1),
      lookAt: new THREE.Vector3(CONFIG.room.width / 2, 2, -1),
      indicator: document.getElementById('anchor-right'),
      panel: document.getElementById('info-right'),
      panelOffset: { x: -350, y: -60 }
    }
  };
  
  // Add click handlers to anchor indicators
  Object.keys(anchorPoints).forEach(key => {
    const anchor = anchorPoints[key];
    if (anchor.indicator) {
      anchor.indicator.addEventListener('click', (e) => {
        e.stopPropagation();
        focusOnAnchor(key);
      });
    }
  });
  
  // Click anywhere on the scene to unfocus (when not in pointer lock)
  document.getElementById('three-container').addEventListener('click', (e) => {
    // Don't trigger if clicking an anchor, panel, or if pointer lock is active
    if (isAnchorFocused && 
        !e.target.closest('.anchor-indicator') && 
        !e.target.closest('.anchor-info-panel') &&
        !controls.isLocked) {
      closeAnchorPanel();
    }
  });
  
  // Ensure anchors are initially visible
  Object.keys(anchorPoints).forEach(key => {
    const anchor = anchorPoints[key];
    if (anchor.indicator) {
      anchor.indicator.style.display = 'block';
      anchor.indicator.style.opacity = '1';
    }
  });
}

function updateAnchorIndicators() {
  // Don't update during cinematic intro
  if (isCinematicIntro) return;
  
  // Don't update if anchorPoints not yet initialized
  if (!anchorPoints || Object.keys(anchorPoints).length === 0) return;
  
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const screenCenterX = screenWidth / 2;
  const screenCenterY = screenHeight / 2;
  
  // Responsive padding - smaller on mobile
  const isMobileView = screenWidth <= 768;
  const paddingX = isMobileView ? 40 : 60;
  // Vertical padding keeps edge anchors more centered (not too high or low)
  const paddingTop = isMobileView ? 120 : 150;
  const paddingBottom = isMobileView ? 180 : 220;
  
  Object.keys(anchorPoints).forEach(key => {
    const anchor = anchorPoints[key];
    if (!anchor.indicator) return;
    
    // Project 3D position to screen coordinates
    const vector = anchor.position.clone();
    vector.project(camera);
    
    // Check if behind camera (z > 1 after projection)
    const isBehindCamera = vector.z > 1;
    
    // Convert to screen coordinates (before clamping)
    let x = (vector.x * 0.5 + 0.5) * screenWidth;
    let y = (-vector.y * 0.5 + 0.5) * screenHeight;
    
    // If behind camera, project from center toward the flipped direction
    if (isBehindCamera) {
      // Calculate direction from center to the projected point, then flip
      const dirX = screenCenterX - x;
      const dirY = screenCenterY - y;
      // Project far in that direction
      const scale = Math.max(screenWidth, screenHeight);
      x = screenCenterX + dirX * scale;
      y = screenCenterY + dirY * scale;
    }
    
    // Check if on screen (before clamping)
    const isOnScreen = x >= paddingX && x <= screenWidth - paddingX && 
                       y >= paddingTop && y <= screenHeight - paddingBottom && 
                       !isBehindCamera;
    
    // Clamp to screen edges with appropriate padding
    // When clamped to left/right edges, keep Y more centered
    let clampedX = Math.max(paddingX, Math.min(screenWidth - paddingX, x));
    let clampedY;
    
    // If X is being clamped to an edge, center Y more
    const isAtHorizontalEdge = x < paddingX || x > screenWidth - paddingX || isBehindCamera;
    if (isAtHorizontalEdge) {
      // Keep vertical position more centered when at horizontal edge
      const centerZoneTop = screenHeight * 0.25;
      const centerZoneBottom = screenHeight * 0.65;
      clampedY = Math.max(centerZoneTop, Math.min(centerZoneBottom, y));
    } else {
      clampedY = Math.max(paddingTop, Math.min(screenHeight - paddingBottom, y));
    }
    
    // Check if indicator is at edge (off-screen element)
    const isAtEdge = !isOnScreen;
    
    // Update indicator position - always visible
    anchor.indicator.style.left = `${clampedX}px`;
    anchor.indicator.style.top = `${clampedY}px`;
    anchor.indicator.style.display = 'block';
    anchor.indicator.style.opacity = '1';
    
    // Add/remove edge class for visual feedback
    anchor.indicator.classList.toggle('at-edge', isAtEdge);
    
    // Update panel position if this is the active anchor
    if (activeAnchor === key && anchor.panel) {
      const panelMaxWidth = isMobileView ? screenWidth - 32 : 340;
      const panelX = isMobileView ? 16 : Math.min(Math.max(20, clampedX + anchor.panelOffset.x), screenWidth - panelMaxWidth - 20);
      const panelY = isMobileView ? screenHeight - 250 : Math.min(Math.max(20, clampedY + anchor.panelOffset.y), screenHeight - 200);
      anchor.panel.style.left = `${panelX}px`;
      anchor.panel.style.top = `${panelY}px`;
    }
  });
}

function focusOnAnchor(anchorKey) {
  const anchor = anchorPoints[anchorKey];
  if (!anchor) return;
  
  // If already focused on this anchor, do nothing
  if (activeAnchor === anchorKey && isAnchorFocused) return;
  
  // Cancel any existing animation
  if (anchorAnimationId) {
    cancelAnimationFrame(anchorAnimationId);
    anchorAnimationId = null;
  }
  
  // Save current camera state for potential return
  savedCameraState = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone()
  };
  
  // Remove active class from all indicators
  Object.keys(anchorPoints).forEach(key => {
    anchorPoints[key].indicator?.classList.remove('active');
    anchorPoints[key].panel?.classList.remove('visible');
  });
  
  // Set this anchor as active
  activeAnchor = anchorKey;
  isAnchorFocused = true;
  anchor.indicator?.classList.add('active');
  document.body.classList.add('anchor-focused');
  
  // Unlock pointer if locked
  if (controls.isLocked) {
    controls.unlock();
  }
  
  // Animate camera to focus position
  const startPos = camera.position.clone();
  const endPos = anchor.cameraPosition;
  const lookTarget = anchor.lookAt;
  
  const duration = 1200; // ms
  const startTime = performance.now();
  
  function animateFocus(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    
    // Interpolate camera position
    camera.position.lerpVectors(startPos, endPos, eased);
    
    // Smoothly look at target
    camera.lookAt(lookTarget);
    
    if (progress < 1) {
      anchorAnimationId = requestAnimationFrame(animateFocus);
    } else {
      // Animation complete - show info panel
      anchorAnimationId = null;
      if (anchor.panel) {
        // Position panel near the projected point
        const vector = anchor.position.clone();
        vector.project(camera);
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        
        const panelX = Math.min(Math.max(20, x + anchor.panelOffset.x), window.innerWidth - 340);
        const panelY = Math.min(Math.max(20, y + anchor.panelOffset.y), window.innerHeight - 200);
        
        anchor.panel.style.left = `${panelX}px`;
        anchor.panel.style.top = `${panelY}px`;
        anchor.panel.classList.add('visible');
      }
      
      // Sync camera euler for mobile touch controls
      if (isMobile) {
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        cameraEuler.yaw = euler.y;
        cameraEuler.pitch = euler.x;
      }
    }
  }
  
  anchorAnimationId = requestAnimationFrame(animateFocus);
}

function closeAnchorPanel() {
  if (!isAnchorFocused) return;
  
  // Cancel any ongoing animation
  if (anchorAnimationId) {
    cancelAnimationFrame(anchorAnimationId);
    anchorAnimationId = null;
  }
  
  // Hide all panels and remove active states
  Object.keys(anchorPoints).forEach(key => {
    anchorPoints[key].indicator?.classList.remove('active');
    anchorPoints[key].panel?.classList.remove('visible');
  });
  
  // Reset state
  activeAnchor = null;
  isAnchorFocused = false;
  document.body.classList.remove('anchor-focused');
  
  // Optionally animate back to saved position (or just let user continue from current position)
  // For now, we let user continue from the focused position - feels more natural
  
  // Sync camera euler for mobile touch controls
  if (isMobile) {
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    cameraEuler.yaw = euler.y;
    cameraEuler.pitch = euler.x;
  }
}

// Expose closeAnchorPanel globally for the HTML onclick handler
window.closeAnchorPanel = closeAnchorPanel;

// ============================================
// Initialize Scene
// ============================================
function init() {
  const container = document.getElementById('three-container');
  if (!container) return;
  
  // Scene setup - very dark
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  
  // Camera
  camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    50
  );
  camera.position.set(0, roomSettings.cameraHeight, CONFIG.room.depth / 2 - 2);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);
  
  // Detect mobile/touch device
  isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Pointer Lock Controls (desktop only)
  controls = new PointerLockControls(camera, document.body);
  
  if (isMobile) {
    // Mobile: use touch controls instead of pointer lock
    setupTouchControls(container);
    // Add pointer-locked class to hide UI on mobile too
    document.body.classList.add('pointer-locked');
  } else {
    // Desktop: click to enable pointer lock
    container.addEventListener('click', () => {
      if (!controls.isLocked) {
        controls.lock();
      }
    });
    
    controls.addEventListener('lock', () => {
      document.body.classList.add('pointer-locked');
    });
    
    controls.addEventListener('unlock', () => {
      document.body.classList.remove('pointer-locked');
      // Reset all movement states when pointer lock is released
      moveForward = false;
      moveBackward = false;
      moveLeft = false;
      moveRight = false;
      isSprinting = false;
    });
  }
  
  // Create scene elements
  createLighting();
  createRoom();
  createInstallation();
  createProjection();
  createSpeakers();
  
  // Setup silhouette texture
  setupSilhouetteTexture();
  
  // Setup controls
  setupKeyboardControls();
  setupRoomControls();
  setupModelControls();
  
  // Setup anchor point system
  setupAnchorPoints();
  
  // Handle resize
  window.addEventListener('resize', onWindowResize);
  
  // Setup cinematic skip listeners
  setupCinematicSkipListeners();
  
  // Check if we should play cinematic intro
  const shouldPlayCinematic = checkCinematicTransition();
  
  if (shouldPlayCinematic) {
    // Set camera to start position BEFORE first render to avoid glitch
    setupCinematicStartPosition();
  }
  
  // Start animation loop
  animate();
  
  // Fade out the page transition overlay after first render
  fadeOutPageTransition();
  
  // Start cinematic animation after overlay starts fading
  if (shouldPlayCinematic) {
    setTimeout(() => {
      startCinematicIntro();
    }, 100);
  }
}

// ============================================
// Create Lighting - Very minimal, dark room
// ============================================
function createLighting() {
  // Very dim ambient light
  ambientLight = new THREE.AmbientLight(0xffffff, roomSettings.ambient);
  scene.add(ambientLight);
  
  // TV screen glow
  tvGlow = new THREE.PointLight(0xffffff, 0.3, 4, 2);
  tvGlow.position.set(0, 1.8, -CONFIG.room.depth / 2 + 0.5);
  scene.add(tvGlow);
}

// ============================================
// Create Room - Dark narrow gallery
// ============================================
function createRoom() {
  const { width, height, depth } = CONFIG.room;
  
  // Floor
  const floorGeom = new THREE.PlaneGeometry(width, depth);
  const floorMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(roomSettings.floorColor)
  });
  floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);
  
  // Ceiling
  const ceilingGeom = new THREE.PlaneGeometry(width, depth);
  const ceilingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(roomSettings.ceilingColor)
  });
  ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  scene.add(ceiling);
  
  // Wall material
  const wallMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(roomSettings.wallColor)
  });
  
  // Back wall material (15% darker than side walls)
  const backWallColor = new THREE.Color(roomSettings.wallColor).multiplyScalar(0.85);
  const backWallMat = new THREE.MeshBasicMaterial({
    color: backWallColor
  });
  
  // Back wall (where TV is mounted) - 15% darker
  const backWallGeom = new THREE.PlaneGeometry(width, height);
  backWall = new THREE.Mesh(backWallGeom, backWallMat);
  backWall.position.set(0, height / 2, -depth / 2);
  walls.push(backWall);
  scene.add(backWall);
  
  // Front wall (entrance)
  const frontWallGeom = new THREE.PlaneGeometry(width, height);
  const frontWall = new THREE.Mesh(frontWallGeom, wallMat.clone());
  frontWall.position.set(0, height / 2, depth / 2);
  frontWall.rotation.y = Math.PI;
  walls.push(frontWall);
  scene.add(frontWall);
  
  // Left wall (projection wall)
  const leftWallGeom = new THREE.PlaneGeometry(depth, height);
  const leftWall = new THREE.Mesh(leftWallGeom, wallMat.clone());
  leftWall.position.set(-width / 2, height / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  walls.push(leftWall);
  scene.add(leftWall);
  
  // Right wall
  const rightWallGeom = new THREE.PlaneGeometry(depth, height);
  const rightWall = new THREE.Mesh(rightWallGeom, wallMat.clone());
  rightWall.position.set(width / 2, height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  walls.push(rightWall);
  scene.add(rightWall);
}

// ============================================
// Create Installation (TV + Stand + Acrylic Panels)
// ============================================
function createInstallation() {
  installationGroup = new THREE.Group();
  
  // Position installation against back wall
  installationGroup.position.set(0, 0, -CONFIG.room.depth / 2 + CONFIG.tv.depth / 2 + 0.01);
  
  createTV();
  createStand();
  createAcrylicPanels();
  
  // Apply default rotation
  installationGroup.rotation.set(
    THREE.MathUtils.degToRad(CONFIG.defaults.rotateX),
    THREE.MathUtils.degToRad(CONFIG.defaults.rotateY),
    THREE.MathUtils.degToRad(CONFIG.defaults.rotateZ)
  );
  
  scene.add(installationGroup);
}

// ============================================
// Create TV Monitor (matching home page exactly)
// ============================================
function createTV() {
  const { tv } = CONFIG;
  
  // TV frame (bezel)
  const frameGeometry = new THREE.BoxGeometry(tv.width, tv.height, tv.depth);
  const frameMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(roomSettings.tvFrameColor)
  });
  tvFrame = new THREE.Mesh(frameGeometry, frameMaterial);
  
  // TV screen
  const screenWidth = tv.width - tv.bezelWidth * 2;
  const screenHeight = tv.height - tv.bezelWidth * 2;
  const screenGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
  
  // Create canvas texture for the screen
  silhouetteCanvas = document.createElement('canvas');
  silhouetteCanvas.width = 640;
  silhouetteCanvas.height = 480;
  silhouetteCtx = silhouetteCanvas.getContext('2d');
  
  tvScreenTexture = new THREE.CanvasTexture(silhouetteCanvas);
  tvScreenTexture.colorSpace = THREE.SRGBColorSpace;
  
  const screenMaterial = new THREE.MeshBasicMaterial({
    map: tvScreenTexture,
    side: THREE.FrontSide
  });
  tvScreen = new THREE.Mesh(screenGeometry, screenMaterial);
  tvScreen.position.z = tv.depth / 2 + 0.001;
  
  // White border around screen
  const borderGeometry = new THREE.EdgesGeometry(
    new THREE.PlaneGeometry(screenWidth + 0.02, screenHeight + 0.02)
  );
  const borderMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(roomSettings.tvBorderColor)
  });
  screenBorder = new THREE.LineSegments(borderGeometry, borderMaterial);
  screenBorder.position.z = tv.depth / 2 + 0.002;
  screenBorder.visible = roomSettings.tvBorderVisible;
  
  // Group TV components
  tvGroup = new THREE.Group();
  tvGroup.add(tvFrame);
  tvGroup.add(tvScreen);
  tvGroup.add(screenBorder);
  
  // Position TV at configurable height
  tvGroup.position.y = roomSettings.tvHeight;
  
  installationGroup.add(tvGroup);
}

// ============================================
// Create Stand (pole from TV to floor)
// ============================================
function createStand() {
  const { stand, tv } = CONFIG;
  
  // Calculate height from TV bottom to floor
  const tvBottomY = roomSettings.tvHeight - tv.height / 2;
  const poleHeight = tvBottomY + CONFIG.room.depth / 2;
  
  // Main pole - matches TV frame color
  const poleGeometry = new THREE.CylinderGeometry(
    stand.poleRadius,
    stand.poleRadius,
    poleHeight,
    16
  );
  const poleMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(roomSettings.tvFrameColor)
  });
  standPole = new THREE.Mesh(poleGeometry, poleMaterial);
  
  // Position pole so it starts at TV bottom and goes to floor
  standPole.position.y = tvBottomY - poleHeight / 2;
  
  installationGroup.add(standPole);
}

// Update TV and stand height
function updateTVHeight(height) {
  roomSettings.tvHeight = height;
  
  // Update TV group position
  if (tvGroup) {
    tvGroup.position.y = height;
  }
  
  // Update stand pole
  if (standPole) {
    const { stand, tv } = CONFIG;
    const tvBottomY = height - tv.height / 2;
    const poleHeight = tvBottomY + CONFIG.room.depth / 2;
    
    standPole.geometry.dispose();
    standPole.geometry = new THREE.CylinderGeometry(
      stand.poleRadius,
      stand.poleRadius,
      poleHeight,
      16
    );
    standPole.position.y = tvBottomY - poleHeight / 2;
  }
  
  // Update acrylic panel positions
  updatePanelSpacing(hSpread, vSpread, zOffset);
}

// ============================================
// Create Acrylic Panels (matching home page exactly)
// ============================================
function createAcrylicPanels() {
  const { panel, colors } = CONFIG;
  const { defaults } = CONFIG;
  
  const panelColors = [colors.yellow, colors.green, colors.red, colors.blue];
  
  panelBasePositions.forEach((basePos, index) => {
    const geometry = new THREE.BoxGeometry(panel.width, panel.height, panel.depth);
    
    const material = new THREE.MeshBasicMaterial({
      color: panelColors[index],
      transparent: true,
      opacity: roomSettings.panelOpacity,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const panelMesh = new THREE.Mesh(geometry, material);
    
    // Calculate spread position
    const xDir = index % 2 === 0 ? -1 : 1;
    const yDir = index < 2 ? 1 : -1;
    
    panelMesh.position.set(
      basePos.x + (xDir * defaults.hSpread * 0.5),
      basePos.y + (yDir * defaults.vSpread * 0.3) + 1.8,
      basePos.z + defaults.zOffset
    );
    
    panelMesh.userData.isAcrylicPanel = true;
    panelMesh.userData.basePosition = { ...basePos };
    panelMesh.userData.panelIndex = index;
    
    acrylicPanels.push(panelMesh);
    installationGroup.add(panelMesh);
  });
}

// ============================================
// Update Panel Positions Based on Spacing
// ============================================
function updatePanelSpacing(h, v, z) {
  acrylicPanels.forEach((panel, index) => {
    const base = panel.userData.basePosition;
    const xDir = index % 2 === 0 ? -1 : 1;
    const yDir = index < 2 ? 1 : -1;
    
    panel.position.x = base.x + (xDir * h * 0.5);
    panel.position.y = base.y + (yDir * v * 0.3) + 1.8;
    panel.position.z = base.z + z;
  });
}

// ============================================
// Update Panel Thickness
// ============================================
function updatePanelThickness(thickness) {
  CONFIG.panel.depth = thickness;
  acrylicPanels.forEach((panel) => {
    panel.geometry.dispose();
    panel.geometry = new THREE.BoxGeometry(CONFIG.panel.width, CONFIG.panel.height, thickness);
  });
}

// ============================================
// Create Speakers (small floor-standing)
// ============================================
function createSpeakers() {
  const speakerColor = 0x0a0a0a;  // Very dark, darker than walls
  const speakerWidth = 0.15;      // Much smaller
  const speakerHeight = 0.35;     // Much smaller
  const speakerDepth = 0.12;      // Much smaller
  
  // Speaker positions - flanking the installation
  const positions = [
    { x: -1.2, z: -CONFIG.room.depth / 2 + 0.8 },  // Left of TV
    { x: 1.2, z: -CONFIG.room.depth / 2 + 0.8 }    // Right of TV
  ];
  
  positions.forEach(pos => {
    // Speaker cabinet - very dark
    const cabinetGeom = new THREE.BoxGeometry(speakerWidth, speakerHeight, speakerDepth);
    const cabinetMat = new THREE.MeshBasicMaterial({ color: speakerColor });
    const cabinet = new THREE.Mesh(cabinetGeom, cabinetMat);
    cabinet.position.set(pos.x, speakerHeight / 2, pos.z);
    
    // Speaker cone (woofer) - slightly lighter
    const coneRadius = 0.04;
    const coneGeom = new THREE.CircleGeometry(coneRadius, 16);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.position.set(pos.x, speakerHeight / 2 - 0.03, pos.z + speakerDepth / 2 + 0.001);
    
    // Tweeter (smaller cone)
    const tweeterGeom = new THREE.CircleGeometry(0.015, 12);
    const tweeterMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const tweeter = new THREE.Mesh(tweeterGeom, tweeterMat);
    tweeter.position.set(pos.x, speakerHeight / 2 + 0.08, pos.z + speakerDepth / 2 + 0.001);
    
    speakers.push(cabinet, cone, tweeter);
    scene.add(cabinet);
    scene.add(cone);
    scene.add(tweeter);
  });
}

// ============================================
// Create Wall Projection (Point Cloud Effect)
// ============================================
function createProjection() {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePositions.push({
      x: (Math.random() - 0.5) * 5,
      y: Math.random() * 3 + 0.5,
      z: 0,
      vx: (Math.random() - 0.5) * 0.015,
      vy: (Math.random() - 0.5) * 0.015,
      baseX: 0,
      baseY: 0
    });
  }
  
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = particlePositions[i].x;
    positions[i * 3 + 1] = particlePositions[i].y;
    positions[i * 3 + 2] = particlePositions[i].z;
    
    colors[i * 3] = 0.85 + Math.random() * 0.15;
    colors[i * 3 + 1] = 0.8 + Math.random() * 0.15;
    colors[i * 3 + 2] = 0.75 + Math.random() * 0.15;
    
    sizes[i] = Math.random() * 0.025 + 0.008;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  projectionMaterial = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: roomSettings.projectionIntensity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  
  projectionPlane = new THREE.Points(geometry, projectionMaterial);
  projectionPlane.position.set(-CONFIG.room.width / 2 + 0.1, 0, -1);
  projectionPlane.rotation.y = Math.PI / 2;
  projectionPlane.visible = roomSettings.projectionOn;
  scene.add(projectionPlane);
}

// ============================================
// Setup Silhouette Texture
// ============================================
function setupSilhouetteTexture() {
  const iframe = document.getElementById('silhouette-iframe');
  
  if (iframe) {
    // Initial black fill
    silhouetteCtx.fillStyle = '#000000';
    silhouetteCtx.fillRect(0, 0, silhouetteCanvas.width, silhouetteCanvas.height);
    
    // Wait for iframe to load
    iframe.onload = () => {
      console.log('WORD SILHOUETTE iframe loaded');
      startCapture();
    };
    
    // If iframe is already loaded
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
      startCapture();
    }
    
    function startCapture() {
      // Capture iframe canvas at 30fps
      setInterval(() => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const iframeCanvas = iframeDoc.querySelector('canvas');
          
          if (iframeCanvas && iframeCanvas.width > 0) {
            // Draw the webcam silhouette effect to our texture
            silhouetteCtx.drawImage(
              iframeCanvas,
              0, 0,
              silhouetteCanvas.width,
              silhouetteCanvas.height
            );
            tvScreenTexture.needsUpdate = true;
          }
        } catch (e) {
          // Cross-origin or not ready - use placeholder
          drawPlaceholderAnimation();
        }
      }, 1000 / 30);
    }
  } else {
    // No iframe, use placeholder
    setInterval(drawPlaceholderAnimation, 1000 / 30);
  }
}

// ============================================
// Placeholder Animation
// ============================================
function drawPlaceholderAnimation() {
  const time = Date.now() * 0.001;
  const ctx = silhouetteCtx;
  const w = silhouetteCanvas.width;
  const h = silhouetteCanvas.height;
  
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  
  const words = ['YOU ARE', 'YOUR CHOICES', 'PUBLIC SELF', 'POSSIBILITY'];
  const textColors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00'];
  
  ctx.save();
  ctx.beginPath();
  const centerX = w / 2;
  const centerY = h / 2;
  ctx.ellipse(centerX, centerY - 20, 120, 150, 0, 0, Math.PI * 2);
  ctx.moveTo(centerX - 120, centerY + 130);
  ctx.quadraticCurveTo(centerX - 180, centerY + 200, centerX - 200, h);
  ctx.lineTo(centerX + 200, h);
  ctx.quadraticCurveTo(centerX + 180, centerY + 200, centerX + 120, centerY + 130);
  ctx.clip();
  
  for (let y = 20; y < h; y += 15) {
    for (let x = 0; x < w; x += 80) {
      const wordIndex = Math.floor((x + y + time * 30) / 80) % words.length;
      const fontSize = 8 + Math.sin(time * 2 + x * 0.01 + y * 0.01) * 2;
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = textColors[wordIndex];
      ctx.fillText(words[wordIndex], x + Math.sin(time * 2 + y * 0.05) * 3, y);
    }
  }
  ctx.restore();
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - 20, 120, 150, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  tvScreenTexture.needsUpdate = true;
}

// ============================================
// Setup Keyboard Controls
// ============================================
function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        isSprinting = true;
        break;
    }
  });
  
  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        isSprinting = false;
        break;
    }
  });
}

// ============================================
// Setup Touch Controls (Mobile)
// ============================================
function setupTouchControls(container) {
  // Initialize camera euler from current camera rotation
  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  cameraEuler.yaw = euler.y;
  cameraEuler.pitch = euler.x;
  
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isTouching = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  
  container.addEventListener('touchmove', (e) => {
    if (!isTouching || e.touches.length !== 1) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    // Calculate delta from last position
    touchDeltaX = touchX - touchStartX;
    touchDeltaY = touchY - touchStartY;
    
    // Update start position for next move
    touchStartX = touchX;
    touchStartY = touchY;
    
    // Apply rotation to camera
    cameraEuler.yaw -= touchDeltaX * TOUCH_SENSITIVITY;
    cameraEuler.pitch -= touchDeltaY * TOUCH_SENSITIVITY;
    
    // Clamp pitch to prevent flipping
    cameraEuler.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraEuler.pitch));
    
    // Apply euler angles to camera
    camera.quaternion.setFromEuler(new THREE.Euler(cameraEuler.pitch, cameraEuler.yaw, 0, 'YXZ'));
  }, { passive: true });
  
  container.addEventListener('touchend', () => {
    isTouching = false;
    touchDeltaX = 0;
    touchDeltaY = 0;
  }, { passive: true });
  
  container.addEventListener('touchcancel', () => {
    isTouching = false;
    touchDeltaX = 0;
    touchDeltaY = 0;
  }, { passive: true });
}

// ============================================
// Setup Room Controls
// ============================================
function setupRoomControls() {
  // Camera height (eye level)
  const cameraHeightCtrl = document.getElementById('ctrl-cameraheight');
  if (cameraHeightCtrl) {
    cameraHeightCtrl.value = roomSettings.cameraHeight;
    document.getElementById('val-cameraheight').textContent = roomSettings.cameraHeight.toFixed(2);
    cameraHeightCtrl.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-cameraheight').textContent = v.toFixed(2);
      roomSettings.cameraHeight = v;
      camera.position.y = v;
    });
  }
  
  // TV height
  const tvHeightCtrl = document.getElementById('ctrl-tvheight');
  if (tvHeightCtrl) {
    tvHeightCtrl.value = roomSettings.tvHeight;
    document.getElementById('val-tvheight').textContent = roomSettings.tvHeight.toFixed(2);
    tvHeightCtrl.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-tvheight').textContent = v.toFixed(2);
      updateTVHeight(v);
    });
  }
  
  // Ambient light
  const ambientCtrl = document.getElementById('ctrl-ambient');
  if (ambientCtrl) {
    ambientCtrl.value = roomSettings.ambient;
    document.getElementById('val-ambient').textContent = roomSettings.ambient.toFixed(2);
    ambientCtrl.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-ambient').textContent = v.toFixed(2);
      roomSettings.ambient = v;
      ambientLight.intensity = v;
    });
  }
  
  // Wall color
  const wallCtrl = document.getElementById('ctrl-wallcolor');
  if (wallCtrl) {
    wallCtrl.value = roomSettings.wallColor;
    wallCtrl.addEventListener('input', (e) => {
      roomSettings.wallColor = e.target.value;
      const baseColor = new THREE.Color(e.target.value);
      const darkColor = baseColor.clone().multiplyScalar(0.85); // 15% darker for back wall
      walls.forEach(wall => {
        if (wall === backWall) {
          wall.material.color.copy(darkColor);
        } else {
          wall.material.color.copy(baseColor);
        }
      });
    });
  }
  
  // Floor color
  const floorCtrl = document.getElementById('ctrl-floorcolor');
  if (floorCtrl) {
    floorCtrl.value = roomSettings.floorColor;
    floorCtrl.addEventListener('input', (e) => {
      roomSettings.floorColor = e.target.value;
      floor.material.color.set(e.target.value);
    });
  }
  
  // Ceiling color
  const ceilingCtrl = document.getElementById('ctrl-ceilingcolor');
  if (ceilingCtrl) {
    ceilingCtrl.value = roomSettings.ceilingColor;
    ceilingCtrl.addEventListener('input', (e) => {
      roomSettings.ceilingColor = e.target.value;
      ceiling.material.color.set(e.target.value);
    });
  }
  
  // Projection toggle
  const projCtrl = document.getElementById('ctrl-projection');
  if (projCtrl) {
    projCtrl.addEventListener('change', (e) => {
      roomSettings.projectionOn = e.target.checked;
      projectionPlane.visible = e.target.checked;
    });
  }
  
  // Projection intensity
  const projIntensityCtrl = document.getElementById('ctrl-projintensity');
  if (projIntensityCtrl) {
    projIntensityCtrl.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-projintensity').textContent = v.toFixed(1);
      roomSettings.projectionIntensity = v;
      projectionMaterial.opacity = v;
    });
  }
}

// ============================================
// Setup Model Controls (matching home page)
// ============================================
function setupModelControls() {
  // Opacity
  const opacityCtrl = document.getElementById('ctrl-panelopacity');
  if (opacityCtrl) {
    opacityCtrl.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-panelopacity').textContent = v.toFixed(2);
      roomSettings.panelOpacity = v;
      acrylicPanels.forEach(panel => panel.material.opacity = v);
    });
  }
  
  // Thickness
  const thicknessCtrl = document.getElementById('ctrl-thickness');
  if (thicknessCtrl) {
    thicknessCtrl.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-thickness').textContent = v.toFixed(2);
      updatePanelThickness(v);
    });
  }
  
  // H-Spread
  const hspreadCtrl = document.getElementById('ctrl-hspread');
  if (hspreadCtrl) {
    hspreadCtrl.addEventListener('input', (e) => {
      hSpread = parseFloat(e.target.value);
      document.getElementById('val-hspread').textContent = hSpread.toFixed(2);
      updatePanelSpacing(hSpread, vSpread, zOffset);
    });
  }
  
  // V-Spread
  const vspreadCtrl = document.getElementById('ctrl-vspread');
  if (vspreadCtrl) {
    vspreadCtrl.addEventListener('input', (e) => {
      vSpread = parseFloat(e.target.value);
      document.getElementById('val-vspread').textContent = vSpread.toFixed(2);
      updatePanelSpacing(hSpread, vSpread, zOffset);
    });
  }
  
  // Z-Offset
  const zoffsetCtrl = document.getElementById('ctrl-zoffset');
  if (zoffsetCtrl) {
    zoffsetCtrl.addEventListener('input', (e) => {
      zOffset = parseFloat(e.target.value);
      document.getElementById('val-zoffset').textContent = zOffset.toFixed(2);
      updatePanelSpacing(hSpread, vSpread, zOffset);
    });
  }
  
  // TV frame color (also updates stand)
  const tvFrameCtrl = document.getElementById('ctrl-tvframe');
  if (tvFrameCtrl) {
    tvFrameCtrl.value = roomSettings.tvFrameColor;
    tvFrameCtrl.addEventListener('input', (e) => {
      roomSettings.tvFrameColor = e.target.value;
      tvFrame.material.color.set(e.target.value);
      if (standPole) standPole.material.color.set(e.target.value);
    });
  }
  
  // Rotate X
  const rotXCtrl = document.getElementById('ctrl-rotx');
  if (rotXCtrl) {
    rotXCtrl.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      document.getElementById('val-rotx').textContent = v + '°';
      installationGroup.rotation.x = THREE.MathUtils.degToRad(v);
    });
  }
  
  // Rotate Y
  const rotYCtrl = document.getElementById('ctrl-roty');
  if (rotYCtrl) {
    rotYCtrl.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      document.getElementById('val-roty').textContent = v + '°';
      installationGroup.rotation.y = THREE.MathUtils.degToRad(v);
    });
  }
  
  // Rotate Z
  const rotZCtrl = document.getElementById('ctrl-rotz');
  if (rotZCtrl) {
    rotZCtrl.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      document.getElementById('val-rotz').textContent = v + '°';
      installationGroup.rotation.z = THREE.MathUtils.degToRad(v);
    });
  }
}

// Global functions for buttons
window.toggleRoomControls = function() {
  const panel = document.getElementById('room-controls');
  panel.classList.toggle('open');
};

window.resetRoomSettings = function() {
  const defaults = {
    ambient: 0.00,
    wallColor: '#545454',
    floorColor: '#3d3d3d',
    ceilingColor: '#3d3d3d',
    projectionOn: true,
    projectionIntensity: 0.8,
    panelOpacity: 0.45,
    tvFrameColor: '#1c1c1c',
    hSpread: 0.35,
    vSpread: 1,
    zOffset: 0.50,
    thickness: 0.02,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    cameraHeight: 2.25,
    tvHeight: 2.25
  };
  
  // Update view controls
  document.getElementById('ctrl-cameraheight').value = defaults.cameraHeight;
  document.getElementById('val-cameraheight').textContent = defaults.cameraHeight.toFixed(2);
  document.getElementById('ctrl-tvheight').value = defaults.tvHeight;
  document.getElementById('val-tvheight').textContent = defaults.tvHeight.toFixed(2);
  roomSettings.cameraHeight = defaults.cameraHeight;
  roomSettings.tvHeight = defaults.tvHeight;
  camera.position.y = defaults.cameraHeight;
  updateTVHeight(defaults.tvHeight);
  
  // Update room controls
  document.getElementById('ctrl-ambient').value = defaults.ambient;
  document.getElementById('val-ambient').textContent = defaults.ambient.toFixed(2);
  document.getElementById('ctrl-wallcolor').value = defaults.wallColor;
  document.getElementById('ctrl-floorcolor').value = defaults.floorColor;
  document.getElementById('ctrl-ceilingcolor').value = defaults.ceilingColor;
  document.getElementById('ctrl-projection').checked = defaults.projectionOn;
  document.getElementById('ctrl-projintensity').value = defaults.projectionIntensity;
  document.getElementById('val-projintensity').textContent = defaults.projectionIntensity.toFixed(1);
  
  // Update model controls
  document.getElementById('ctrl-panelopacity').value = defaults.panelOpacity;
  document.getElementById('val-panelopacity').textContent = defaults.panelOpacity.toFixed(2);
  document.getElementById('ctrl-thickness').value = defaults.thickness;
  document.getElementById('val-thickness').textContent = defaults.thickness.toFixed(2);
  document.getElementById('ctrl-hspread').value = defaults.hSpread;
  document.getElementById('val-hspread').textContent = defaults.hSpread.toFixed(2);
  document.getElementById('ctrl-vspread').value = defaults.vSpread;
  document.getElementById('val-vspread').textContent = defaults.vSpread.toFixed(2);
  document.getElementById('ctrl-zoffset').value = defaults.zOffset;
  document.getElementById('val-zoffset').textContent = defaults.zOffset.toFixed(2);
  document.getElementById('ctrl-tvframe').value = defaults.tvFrameColor;
  document.getElementById('ctrl-rotx').value = defaults.rotateX;
  document.getElementById('val-rotx').textContent = defaults.rotateX + '°';
  document.getElementById('ctrl-roty').value = defaults.rotateY;
  document.getElementById('val-roty').textContent = defaults.rotateY + '°';
  document.getElementById('ctrl-rotz').value = defaults.rotateZ;
  document.getElementById('val-rotz').textContent = defaults.rotateZ + '°';
  
  // Apply to scene
  Object.assign(roomSettings, defaults);
  hSpread = defaults.hSpread;
  vSpread = defaults.vSpread;
  zOffset = defaults.zOffset;
  
  ambientLight.intensity = defaults.ambient;
  const baseWallColor = new THREE.Color(defaults.wallColor);
  const darkWallColor = baseWallColor.clone().multiplyScalar(0.85);
  walls.forEach(wall => {
    if (wall === backWall) {
      wall.material.color.copy(darkWallColor);
    } else {
      wall.material.color.copy(baseWallColor);
    }
  });
  floor.material.color.set(defaults.floorColor);
  ceiling.material.color.set(defaults.ceilingColor);
  projectionPlane.visible = defaults.projectionOn;
  projectionMaterial.opacity = defaults.projectionIntensity;
  acrylicPanels.forEach(panel => panel.material.opacity = defaults.panelOpacity);
  updatePanelThickness(defaults.thickness);
  updatePanelSpacing(defaults.hSpread, defaults.vSpread, defaults.zOffset);
  tvFrame.material.color.set(defaults.tvFrameColor);
  if (standPole) standPole.material.color.set(defaults.tvFrameColor);
  installationGroup.rotation.set(
    THREE.MathUtils.degToRad(defaults.rotateX),
    THREE.MathUtils.degToRad(defaults.rotateY),
    THREE.MathUtils.degToRad(defaults.rotateZ)
  );
};

window.dismissHint = function() {
  const hint = document.getElementById('controls-hint');
  hint.classList.add('hidden');
  localStorage.setItem('installationHintDismissed', 'true');
};

if (localStorage.getItem('installationHintDismissed')) {
  const hint = document.getElementById('controls-hint');
  if (hint) hint.classList.add('hidden');
}

// ============================================
// Update Projection Animation
// ============================================
function updateProjection(time) {
  if (!projectionPlane || !roomSettings.projectionOn) return;
  
  const positions = projectionPlane.geometry.attributes.position.array;
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = particlePositions[i];
    
    const noiseX = Math.sin(time * 0.4 + p.baseY * 2) * 0.25;
    const noiseY = Math.cos(time * 0.25 + p.baseX * 2) * 0.15;
    
    p.x += p.vx + noiseX * 0.008;
    p.y += p.vy + noiseY * 0.008;
    
    const centerY = 2;
    const centerX = 0;
    const headRadiusX = 1;
    const headRadiusY = 1.3;
    const headCenterY = centerY + 0.4;
    
    const inHead = Math.pow((p.x - centerX) / headRadiusX, 2) + 
                   Math.pow((p.y - headCenterY) / headRadiusY, 2) < 1;
    
    const bodyTop = centerY - 0.7;
    const inBody = p.y < bodyTop && p.y > 0.3 &&
                   Math.abs(p.x) < 1.8 - (bodyTop - p.y) * 0.4;
    
    if (!inHead && !inBody) {
      if (Math.random() > 0.5) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random();
        p.x = centerX + Math.cos(angle) * headRadiusX * r;
        p.y = headCenterY + Math.sin(angle) * headRadiusY * r;
      } else {
        p.x = (Math.random() - 0.5) * 2.5;
        p.y = Math.random() * (bodyTop - 0.3) + 0.3;
      }
      p.vx = (Math.random() - 0.5) * 0.008;
      p.vy = (Math.random() - 0.5) * 0.008;
    }
    
    p.baseX = p.x;
    p.baseY = p.y;
    
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = Math.sin(time + i * 0.001) * 0.03;
  }
  
  projectionPlane.geometry.attributes.position.needsUpdate = true;
}

// ============================================
// Update Player Movement
// ============================================
function updateMovement(delta) {
  // On mobile, always allow movement; on desktop, require pointer lock
  if (!isMobile && !controls.isLocked) return;
  
  const inputZ = Number(moveForward) - Number(moveBackward);
  const inputX = Number(moveRight) - Number(moveLeft);
  
  if (inputZ === 0 && inputX === 0) return;
  
  // Get camera's forward direction using getWorldDirection (handles matrix updates)
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; // Keep movement on XZ plane
  forward.normalize();
  
  // Get right direction (perpendicular to forward on XZ plane)
  const right = new THREE.Vector3();
  right.crossVectors(forward, camera.up).normalize();
  
  // Normalize input for diagonal movement
  const inputLength = Math.sqrt(inputZ * inputZ + inputX * inputX);
  
  const speed = CONFIG.player.speed * (isSprinting ? CONFIG.player.sprintMultiplier : 1);
  const moveDistance = speed * delta;
  
  // Apply movement directly to camera position
  camera.position.addScaledVector(forward, (inputZ / inputLength) * moveDistance);
  camera.position.addScaledVector(right, (inputX / inputLength) * moveDistance);
  
  // Clamp to room bounds
  const halfWidth = CONFIG.room.width / 2 - 0.4;
  const halfDepth = CONFIG.room.depth / 2 - 0.4;
  
  // Calculate the forward limit based on acrylic panel positions
  // Panels are at installation z + panel z offset, camera should stay behind them
  const installationZ = -CONFIG.room.depth / 2 + CONFIG.tv.depth / 2 + 0.01;
  const maxPanelZ = installationZ + zOffset + 0.8; // Add buffer so camera stays behind panels
  
  camera.position.x = Math.max(-halfWidth, Math.min(halfWidth, camera.position.x));
  camera.position.z = Math.max(maxPanelZ, Math.min(halfDepth, camera.position.z));
  camera.position.y = roomSettings.cameraHeight;
}

// ============================================
// Window Resize Handler
// ============================================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// Animation Loop
// ============================================
function animate() {
  requestAnimationFrame(animate);
  
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  // Only allow movement when not focused on an anchor
  if (!isAnchorFocused) {
    updateMovement(delta);
  }
  
  projectionTime += delta;
  updateProjection(projectionTime);
  
  // Update anchor indicator positions
  updateAnchorIndicators();
  
  renderer.render(scene, camera);
  
  prevTime = time;
}

// ============================================
// Initialize on DOM Load
// ============================================
document.addEventListener('DOMContentLoaded', init);
