import * as THREE from 'three';

// ============================================
// Scene Configuration
// ============================================
const CONFIG = {
  // Acrylic panel colors (matching Figma)
  colors: {
    yellow: 0xFDFF00,
    red: 0xFF0505,
    green: 0x11FF00,
    blue: 0x2600FF
  },
  
  // Panel dimensions (relative units)
  panel: {
    width: 1.2,
    height: 1.5,
    depth: 0.01,
    opacity: 0.45
  },
  
  // Default spacing values
  defaults: {
    hSpread: 0.35,
    vSpread: 1,
    zOffset: 0.22,
    rotateX: 5,
    rotateY: 0,
    rotateZ: 0
  },
  
  // TV dimensions
  tv: {
    width: 1.8,
    height: 2.5,
    depth: 0.1,
    screenInset: 0.05,
    bezelWidth: 0.08
  },
  
  // Stand dimensions
  stand: {
    poleHeight: 8,  // Very tall to extend to bottom of any viewport
    poleRadius: 0.03,
    baseWidth: 0.4
  }
};

// ============================================
// Global Variables
// ============================================
let scene, camera, renderer;
let tvScreen, tvScreenTexture, tvFrame, screenBorder;
let tvGroup, standPole;
let installationGroup;
let silhouetteCanvas, silhouetteCtx;
let tvVideo; // Video element for TV screen

// Auto-pan animation
let panAngle = 0;
const PAN_SPEED = 0.0036;  // Pan speed (+20%)
const PAN_RANGE = 0.4;     // How far left/right to pan (radians)

// TV appearance settings
const tvSettings = {
  frameColor: '#525252',  // RGB(82, 82, 82) - darker gray
  borderVisible: true,
  borderColor: '#969696',  // RGB(150, 150, 150) - lighter gray
  scale: 1
};

// Performance settings
const PERF = {
  maxPixelRatio: window.devicePixelRatio > 1 ? 1.5 : 1, // Cap for performance
  antialias: window.devicePixelRatio < 2, // Disable on retina
  throttleResize: 100 // ms
};

let resizeTimeout;

// ============================================
// Mouse Tracking for Subtle Camera Movement
// ============================================
let mouseX = 0, mouseY = 0;           // Current interpolated values
let targetMouseX = 0, targetMouseY = 0; // Target values from mouse position
const MOUSE_SENSITIVITY = 1.2;         // How much mouse affects camera
const MOUSE_LERP = 0.05;               // Smoothing factor (lower = smoother)

// ============================================
// Zoom Controls
// ============================================
let zoomFactor = 1.0;                  // Current zoom level
let targetZoom = 1.0;                  // Target zoom level
const ZOOM_MIN = 0.85;                 // Max zoom in (closer to model)
const ZOOM_MAX = 1.1;                  // Max zoom out
const ZOOM_SPEED = 0.0008;             // How fast scroll affects zoom
const ZOOM_LERP = 0.08;                // Zoom smoothing factor

// ============================================
// Cinematic Intro Animation
// ============================================
let isCinematicIntro = true;           // Start in cinematic mode
let cinematicStartTime = 0;            // When the animation started
const CINEMATIC_DURATION = 1400;       // 1.4 seconds for zoom out (faster)
const CINEMATIC_START_ZOOM = 0.85;     // Start 15% zoomed in
const CINEMATIC_END_ZOOM = 1.0;        // End at normal zoom

// Easing function for smooth cinematic animation
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

// Start the cinematic intro
function startCinematicIntro() {
  isCinematicIntro = true;
  cinematicStartTime = performance.now();
  zoomFactor = CINEMATIC_START_ZOOM;
  targetZoom = CINEMATIC_START_ZOOM;
  
  // Start text animations immediately (same time as zoom)
  document.body.classList.remove('cinematic-intro');
  document.body.classList.add('cinematic-revealed');
}

// Finish cinematic intro and reveal UI
function finishCinematicIntro() {
  isCinematicIntro = false;
  zoomFactor = CINEMATIC_END_ZOOM;
  targetZoom = CINEMATIC_END_ZOOM;
  
  // Show the scene gradient after zoom completes
  const sceneGradient = document.querySelector('.scene-gradient');
  if (sceneGradient) {
    sceneGradient.classList.add('visible');
  }
}

// Update cinematic zoom animation
function updateCinematicZoom() {
  if (!isCinematicIntro) return;
  
  const elapsed = performance.now() - cinematicStartTime;
  const progress = Math.min(elapsed / CINEMATIC_DURATION, 1);
  const eased = easeOutQuart(progress);
  
  // Interpolate zoom from start to end
  zoomFactor = CINEMATIC_START_ZOOM + (CINEMATIC_END_ZOOM - CINEMATIC_START_ZOOM) * eased;
  targetZoom = zoomFactor;
  
  // Check if animation is complete
  if (progress >= 1) {
    finishCinematicIntro();
  }
}

// ============================================
// Initialize Scene
// ============================================
function init() {
  const container = document.getElementById('three-container');
  if (!container) return;
  
  // Get container dimensions
  const rect = container.getBoundingClientRect();
  const width = rect.width || window.innerWidth * 0.55;
  const height = rect.height || window.innerHeight;
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  
  // Camera - offset slightly right to optically center the model
  const aspect = width / height;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100); // Reduced far plane
  camera.position.set(0.3, 0.5, 5);
  
  // Renderer - optimized settings
  renderer = new THREE.WebGLRenderer({ 
    antialias: PERF.antialias,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERF.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  
  // Simple ambient light only
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);
  
  // Create installation group (for rotation controls)
  installationGroup = new THREE.Group();
  scene.add(installationGroup);
  
  // Create 3D objects
  createTV();
  createAcrylicPanels();
  createStand();
  
  // Setup silhouette texture
  setupSilhouetteTexture();
  
  // GUI only (no user controls - auto pan)
  setupGUI();
  
  // Handle resize with throttling
  window.addEventListener('resize', throttledResize);
  
  // Initial viewport adjustment
  adjustCameraForViewport(width, height);
  
  // Setup mouse tracking for subtle camera movement
  setupMouseTracking(container);
  
  // Start cinematic intro zoom-out animation
  startCinematicIntro();
  
  // Start animation loop
  animate();
}


// ============================================
// Create TV Monitor
// ============================================
function createTV() {
  const { tv } = CONFIG;
  
  // TV frame (bezel) - using BasicMaterial so color shows exactly as specified
  const frameGeometry = new THREE.BoxGeometry(tv.width, tv.height, tv.depth);
  const frameMaterial = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color(tvSettings.frameColor)
  });
  tvFrame = new THREE.Mesh(frameGeometry, frameMaterial);
  
  // TV screen (will display video)
  const screenWidth = tv.width - tv.bezelWidth * 2;
  const screenHeight = tv.height - tv.bezelWidth * 2;
  const screenGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
  
  // Get video element from DOM (defined in HTML)
  tvVideo = document.getElementById('tv-video');
  if (!tvVideo) {
    console.error('TV video element not found!');
    // Create fallback video element
    tvVideo = document.createElement('video');
    tvVideo.src = 'assets/videos/tvvid2.mp4';
    tvVideo.loop = true;
    tvVideo.muted = true;
    tvVideo.playsInline = true;
    tvVideo.setAttribute('playsinline', '');
    tvVideo.setAttribute('webkit-playsinline', '');
    tvVideo.setAttribute('muted', '');
    tvVideo.preload = 'auto';
    document.body.appendChild(tvVideo);
  } else {
    // Ensure Safari-compatible attributes on existing video
    tvVideo.setAttribute('webkit-playsinline', '');
    tvVideo.muted = true;
  }
  
  // Create canvas for video frames (higher resolution for sharpness)
  silhouetteCanvas = document.createElement('canvas');
  silhouetteCanvas.width = 1280;
  silhouetteCanvas.height = 960;
  silhouetteCtx = silhouetteCanvas.getContext('2d');
  
  // Create canvas texture with settings for vibrant colors
  tvScreenTexture = new THREE.CanvasTexture(silhouetteCanvas);
  tvScreenTexture.colorSpace = THREE.SRGBColorSpace;
  tvScreenTexture.minFilter = THREE.LinearFilter;
  tvScreenTexture.magFilter = THREE.LinearFilter;
  tvScreenTexture.generateMipmaps = false;
  
  // Screen material - fully opaque, no transparency
  const screenMaterial = new THREE.MeshBasicMaterial({ 
    map: tvScreenTexture,
    side: THREE.FrontSide,
    toneMapped: false  // Prevent tone mapping from washing out colors
  });
  tvScreen = new THREE.Mesh(screenGeometry, screenMaterial);
  tvScreen.position.z = tv.depth / 2 + 0.002;  // Slightly more forward
  tvScreen.renderOrder = 1;  // Render before transparent panels
  
  // Function to draw video frame to canvas - runs every frame
  function updateVideoCanvas() {
    try {
      if (tvVideo && tvVideo.readyState >= tvVideo.HAVE_CURRENT_DATA) {
        // Apply color adjustments using the settings
        silhouetteCtx.filter = `contrast(${imageSettings.contrast}) saturate(${imageSettings.saturation}) brightness(${imageSettings.brightness})`;
        silhouetteCtx.drawImage(tvVideo, 0, 0, silhouetteCanvas.width, silhouetteCanvas.height);
        silhouetteCtx.filter = 'none';
        
        tvScreenTexture.needsUpdate = true;
      }
    } catch (e) {
      // Ignore drawing errors
    }
    requestAnimationFrame(updateVideoCanvas);
  }
  
  // Start the video frame update loop immediately
  updateVideoCanvas();
  
  // Start video when data is loaded
  tvVideo.addEventListener('canplay', () => {
    tvVideo.play().catch(() => {});
  });
  
  // Also try to play immediately (works if muted and autoplay allowed)
  tvVideo.play().catch(() => {
    // Add click handler to start video on user interaction
    document.addEventListener('click', () => {
      tvVideo.play().catch(() => {});
    }, { once: true });
  });
  
  // White border around screen (matching Figma design)
  const borderGeometry = new THREE.EdgesGeometry(
    new THREE.PlaneGeometry(screenWidth + 0.02, screenHeight + 0.02)
  );
  const borderMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(tvSettings.borderColor) });
  screenBorder = new THREE.LineSegments(borderGeometry, borderMaterial);
  screenBorder.position.z = tv.depth / 2 + 0.002;
  screenBorder.visible = tvSettings.borderVisible;
  
  // Group TV components
  tvGroup = new THREE.Group();
  tvGroup.add(tvFrame);
  tvGroup.add(tvScreen);
  tvGroup.add(screenBorder);
  
  // Position TV
  tvGroup.position.y = 0.8;
  
  installationGroup.add(tvGroup);
}

// ============================================
// Acrylic Panel State (for GUI controls)
// ============================================
let acrylicPanels = [];
let panelBasePositions = [
  { x: -0.45, y: 0.75, z: 0.10 },    // Top-left (yellow)
  { x: 0.50, y: 0.95, z: 0.12 },     // Top-right (green)
  { x: -0.35, y: 0.05, z: 0.14 },    // Bottom-left (red)
  { x: 0.60, y: 0.25, z: 0.16 }      // Bottom-right (blue)
];

// ============================================
// Create Acrylic Panels
// ============================================
function createAcrylicPanels() {
  const { panel, colors } = CONFIG;
  
  const panelColors = [colors.yellow, colors.green, colors.red, colors.blue];
  
  panelBasePositions.forEach((basePos, index) => {
    // Use BoxGeometry for thickness/extrude
    const geometry = new THREE.BoxGeometry(panel.width, panel.height, panel.depth);
    
    // Create material with additive blending for lighten effect
    const material = new THREE.MeshBasicMaterial({
      color: panelColors[index],
      transparent: true,
      opacity: panel.opacity,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const panelMesh = new THREE.Mesh(geometry, material);
    panelMesh.position.set(basePos.x, basePos.y, basePos.z);
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
function updatePanelSpacing(horizontalSpread, verticalSpread, depthOffset) {
  acrylicPanels.forEach((panel, index) => {
    const base = panel.userData.basePosition;
    
    // Calculate spread direction based on panel position
    const xDir = index % 2 === 0 ? -1 : 1;  // Left panels go left, right go right
    const yDir = index < 2 ? 1 : -1;         // Top panels go up, bottom go down
    
    panel.position.x = base.x + (xDir * horizontalSpread * 0.5);
    panel.position.y = base.y + (yDir * verticalSpread * 0.3);
    panel.position.z = base.z + depthOffset;
  });
}

// ============================================
// Update Panel Thickness
// ============================================
function updatePanelThickness(thickness) {
  CONFIG.panel.depth = thickness;
  
  acrylicPanels.forEach((panel) => {
    // Remove old geometry and create new one with updated depth
    panel.geometry.dispose();
    panel.geometry = new THREE.BoxGeometry(CONFIG.panel.width, CONFIG.panel.height, thickness);
  });
}

// ============================================
// Update Panel Opacity
// ============================================
function updatePanelOpacity(opacity) {
  acrylicPanels.forEach(panel => {
    panel.material.opacity = opacity;
  });
}

// ============================================
// Create Stand
// ============================================
function createStand() {
  const { stand } = CONFIG;
  
  // Main pole - uses same color as TV frame
  const poleGeometry = new THREE.CylinderGeometry(
    stand.poleRadius, 
    stand.poleRadius, 
    stand.poleHeight, 
    16
  );
  const poleMaterial = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color(tvSettings.frameColor)
  });
  standPole = new THREE.Mesh(poleGeometry, poleMaterial);
  standPole.position.y = -stand.poleHeight / 2 - 0.4;
  
  installationGroup.add(standPole);
}

// ============================================
// Setup Mouse Tracking
// ============================================
function setupMouseTracking(container) {
  // Track mouse movement over the entire page for subtle camera response
  document.addEventListener('mousemove', (e) => {
    // Normalize mouse position to -1 to 1 range based on window
    targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = -((e.clientY / window.innerHeight) * 2 - 1); // Inverted for natural feel
  });
  
  // Reset to center when mouse leaves the window
  document.addEventListener('mouseleave', () => {
    targetMouseX = 0;
    targetMouseY = 0;
  });
  
  // Wheel zoom on the 3D container
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // Adjust target zoom based on scroll direction
    // Scroll up (negative deltaY) = zoom in (smaller factor = closer)
    // Scroll down (positive deltaY) = zoom out (larger factor = further)
    targetZoom += e.deltaY * ZOOM_SPEED;
    
    // Clamp zoom to limits
    targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZoom));
  }, { passive: false });
}

// ============================================
// Setup Silhouette Texture (no longer needed - video created in createTV)
// ============================================
function setupSilhouetteTexture() {
  // Video is now created directly in createTV()
  // This function is kept for compatibility but does nothing
}

// ============================================
// Placeholder Animation (fallback)
// ============================================
function drawPlaceholderAnimation() {
  const time = Date.now() * 0.001;
  const ctx = silhouetteCtx;
  const w = silhouetteCanvas.width;
  const h = silhouetteCanvas.height;
  
  // Clear with black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  
  // Draw animated text grid (mimicking the WORD SILHOUETTE effect)
  const words = ['YOU ARE', 'YOUR CHOICES', 'PUBLIC SELF', 'POSSIBILITY'];
  const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00'];
  
  // Create silhouette shape in center (simplified face outline)
  ctx.save();
  ctx.beginPath();
  // Draw ellipse for head silhouette
  const centerX = w / 2;
  const centerY = h / 2;
  ctx.ellipse(centerX, centerY - 20, 120, 150, 0, 0, Math.PI * 2);
  // Draw shoulders
  ctx.moveTo(centerX - 120, centerY + 130);
  ctx.quadraticCurveTo(centerX - 180, centerY + 200, centerX - 200, h);
  ctx.lineTo(centerX + 200, h);
  ctx.quadraticCurveTo(centerX + 180, centerY + 200, centerX + 120, centerY + 130);
  ctx.clip();
  
  // Draw text only inside silhouette
  for (let y = 20; y < h; y += 15) {
    for (let x = 0; x < w; x += 80) {
      const wordIndex = Math.floor((x + y + time * 30) / 80) % words.length;
      const fontSize = 8 + Math.sin(time * 2 + x * 0.01 + y * 0.01) * 2;
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = colors[wordIndex];
      ctx.fillText(words[wordIndex], x + Math.sin(time * 2 + y * 0.05) * 3, y);
    }
  }
  ctx.restore();
  
  // Draw contour outline (white edge effect)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - 20, 120, 150, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  tvScreenTexture.needsUpdate = true;
}

// ============================================
// Setup Orbit Controls
// ============================================
// Camera is now fixed - auto-pan handled in animate()


// ============================================
// Setup GUI Controls - Simple flat list
// ============================================
// Enhanced image settings with all WORD SILHOUETTE controls
const imageSettings = {
  // Basic image controls
  threshold: 127,  // Mid-range from screenshot
  invert: false,
  flip: false,
  portraitMode: false,
  cellWidthMultiplier: 0,  // From screenshot
  
  // Contour controls
  contour: true,  // Checked in screenshot
  pixelSize: 2,
  contourSensitivity: 25,  // Mid-range from screenshot
  contourDensity: 3,  // Mid-range from screenshot
  contourColor: '#FFFFFF',
  
  // Animation controls
  enableAnimation: false,  // Unchecked in screenshot
  animationType: 'wave',
  animationSpeed: 10,  // Mid-range from screenshot
  
  // Glitch controls
  glitch: false,  // Unchecked in screenshot
  glitchType: 'vhstracking',
  glitchIntensity: 100,  // High value (180 shown, capped at 100 in slider)
  glitchSpeed: 3,  // Low-mid from screenshot
  
  // Text/Grid settings
  defaultFontSize: 18,  // From screenshot
  textDensity: 2.3,  // From screenshot (2.x)
  
  // Filter adjustments
  contrast: 1.25,
  saturation: 1.35,
  brightness: 1.1
};

function setupGUI() {
  const { defaults } = CONFIG;
  
  // Create settings panel container
  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.className = 'settings-panel';
  panel.innerHTML = `
    <div class="settings-header">
      <span>Settings</span>
      <button class="settings-close" onclick="toggleSettings()">×</button>
    </div>
    <div class="settings-content">
      <div class="setting-section">Acrylic Panels</div>
      <div class="setting-row">
        <label>Opacity</label>
        <input type="range" id="ctrl-opacity" min="0.1" max="1" step="0.05" value="${CONFIG.panel.opacity}">
        <span class="value" id="val-opacity">${CONFIG.panel.opacity}</span>
      </div>
      <div class="setting-row">
        <label>Thickness</label>
        <input type="range" id="ctrl-thickness" min="0.01" max="0.2" step="0.01" value="${CONFIG.panel.depth}">
        <span class="value" id="val-thickness">${CONFIG.panel.depth}</span>
      </div>
      <div class="setting-row">
        <label>H-Spread</label>
        <input type="range" id="ctrl-hspread" min="-1" max="1" step="0.05" value="${defaults.hSpread}">
        <span class="value" id="val-hspread">${defaults.hSpread}</span>
      </div>
      <div class="setting-row">
        <label>V-Spread</label>
        <input type="range" id="ctrl-vspread" min="-2" max="2" step="0.05" value="${defaults.vSpread}">
        <span class="value" id="val-vspread">${defaults.vSpread}</span>
      </div>
      <div class="setting-row">
        <label>Z-Offset</label>
        <input type="range" id="ctrl-zoffset" min="-0.5" max="0.5" step="0.02" value="${defaults.zOffset}">
        <span class="value" id="val-zoffset">${defaults.zOffset}</span>
      </div>
      
      <div class="setting-section">TV Appearance</div>
      <div class="setting-row">
        <label>Frame</label>
        <input type="color" id="ctrl-tvcolor" value="${tvSettings.frameColor}">
      </div>
      <div class="setting-row">
        <label>TV Size</label>
        <input type="range" id="ctrl-tvsize" min="0.5" max="1.5" step="0.05" value="1">
        <span class="value" id="val-tvsize">1.0</span>
      </div>
      <div class="setting-row">
        <label>Border</label>
        <input type="checkbox" id="ctrl-tvborder" ${tvSettings.borderVisible ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Border Color</label>
        <input type="color" id="ctrl-bordercolor" value="${tvSettings.borderColor}">
      </div>
      <div class="setting-section">Video Feed - Basic Controls</div>
      <div class="setting-row">
        <label>Threshold</label>
        <input type="range" id="ctrl-threshold" min="0" max="255" step="1" value="${imageSettings.threshold}">
        <span class="value" id="val-threshold">${imageSettings.threshold}</span>
      </div>
      <div class="setting-row">
        <label>Invert Colors</label>
        <input type="checkbox" id="ctrl-invert" ${imageSettings.invert ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Flip Video</label>
        <input type="checkbox" id="ctrl-flip" ${imageSettings.flip ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Portrait Mode</label>
        <input type="checkbox" id="ctrl-portrait" ${imageSettings.portraitMode ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Cell Width</label>
        <input type="range" id="ctrl-cellwidth" min="0" max="2" step="0.1" value="${imageSettings.cellWidthMultiplier}">
        <span class="value" id="val-cellwidth">${imageSettings.cellWidthMultiplier}</span>
      </div>
      
      <div class="setting-section">Video Feed - Contour Effects</div>
      <div class="setting-row">
        <label>Show Contour</label>
        <input type="checkbox" id="ctrl-contour" ${imageSettings.contour ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Pixel Size</label>
        <input type="range" id="ctrl-pixelsize" min="1" max="6" step="1" value="${imageSettings.pixelSize}">
        <span class="value" id="val-pixelsize">${imageSettings.pixelSize}</span>
      </div>
      <div class="setting-row">
        <label>Sensitivity</label>
        <input type="range" id="ctrl-contoursens" min="1" max="50" step="1" value="${imageSettings.contourSensitivity}">
        <span class="value" id="val-contoursens">${imageSettings.contourSensitivity}</span>
      </div>
      <div class="setting-row">
        <label>Density</label>
        <input type="range" id="ctrl-contourdensity" min="1" max="5" step="1" value="${imageSettings.contourDensity}">
        <span class="value" id="val-contourdensity">${imageSettings.contourDensity}</span>
      </div>
      <div class="setting-row">
        <label>Color</label>
        <input type="color" id="ctrl-contourcolor" value="${imageSettings.contourColor}">
      </div>
      
      <div class="setting-section">Video Feed - Animation</div>
      <div class="setting-row">
        <label>Enable Animation</label>
        <input type="checkbox" id="ctrl-enableanim" ${imageSettings.enableAnimation ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Type</label>
        <select id="ctrl-animtype">
          <option value="wave" ${imageSettings.animationType === 'wave' ? 'selected' : ''}>Wave</option>
          <option value="pulse" ${imageSettings.animationType === 'pulse' ? 'selected' : ''}>Pulse</option>
          <option value="rotate" ${imageSettings.animationType === 'rotate' ? 'selected' : ''}>Rotate</option>
          <option value="bounce" ${imageSettings.animationType === 'bounce' ? 'selected' : ''}>Bounce</option>
          <option value="flicker" ${imageSettings.animationType === 'flicker' ? 'selected' : ''}>Flicker</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Speed</label>
        <input type="range" id="ctrl-animspeed" min="1" max="20" step="1" value="${imageSettings.animationSpeed}">
        <span class="value" id="val-animspeed">${imageSettings.animationSpeed}</span>
      </div>
      
      <div class="setting-section">Video Feed - Glitch Effects</div>
      <div class="setting-row">
        <label>Enable Glitch</label>
        <input type="checkbox" id="ctrl-glitch" ${imageSettings.glitch ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Glitch Type</label>
        <select id="ctrl-glitchtype">
          <option value="scanlines" ${imageSettings.glitchType === 'scanlines' ? 'selected' : ''}>Scan Lines</option>
          <option value="rgbshift" ${imageSettings.glitchType === 'rgbshift' ? 'selected' : ''}>RGB Shift</option>
          <option value="noise" ${imageSettings.glitchType === 'noise' ? 'selected' : ''}>Noise</option>
          <option value="blockshift" ${imageSettings.glitchType === 'blockshift' ? 'selected' : ''}>Block Shift</option>
          <option value="pixelation" ${imageSettings.glitchType === 'pixelation' ? 'selected' : ''}>Pixelation</option>
          <option value="wavydistortion" ${imageSettings.glitchType === 'wavydistortion' ? 'selected' : ''}>Wavy Distortion</option>
          <option value="vhstracking" ${imageSettings.glitchType === 'vhstracking' ? 'selected' : ''}>VHS Tracking</option>
          <option value="ghosting" ${imageSettings.glitchType === 'ghosting' ? 'selected' : ''}>Ghosting</option>
          <option value="digitaldropout" ${imageSettings.glitchType === 'digitaldropout' ? 'selected' : ''}>Digital Dropout</option>
          <option value="combined" ${imageSettings.glitchType === 'combined' ? 'selected' : ''}>Combined</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Intensity</label>
        <input type="range" id="ctrl-glitchamt" min="10" max="100" step="5" value="${imageSettings.glitchIntensity}">
        <span class="value" id="val-glitchamt">${imageSettings.glitchIntensity}%</span>
      </div>
      <div class="setting-row">
        <label>Speed</label>
        <input type="range" id="ctrl-glitchspeed" min="1" max="10" step="1" value="${imageSettings.glitchSpeed}">
        <span class="value" id="val-glitchspeed">${imageSettings.glitchSpeed}</span>
      </div>
      
      <div class="setting-section">Video Feed - Text/Grid Settings</div>
      <div class="setting-row">
        <label>Font Size</label>
        <input type="range" id="ctrl-fontsize" min="6" max="24" step="1" value="${imageSettings.defaultFontSize}">
        <span class="value" id="val-fontsize">${imageSettings.defaultFontSize}px</span>
      </div>
      <div class="setting-row">
        <label>Text Density</label>
        <input type="range" id="ctrl-textdensity" min="0.5" max="3" step="0.1" value="${imageSettings.textDensity}">
        <span class="value" id="val-textdensity">${imageSettings.textDensity}x</span>
      </div>
      
      <div class="setting-section">Video Feed - Color Adjustments</div>
      <div class="setting-row">
        <label>Contrast</label>
        <input type="range" id="ctrl-contrast" min="0.5" max="2" step="0.05" value="${imageSettings.contrast}">
        <span class="value" id="val-contrast">${imageSettings.contrast}</span>
      </div>
      <div class="setting-row">
        <label>Saturation</label>
        <input type="range" id="ctrl-saturation" min="0.5" max="2" step="0.05" value="${imageSettings.saturation}">
        <span class="value" id="val-saturation">${imageSettings.saturation}</span>
      </div>
      <div class="setting-row">
        <label>Brightness</label>
        <input type="range" id="ctrl-brightness" min="0.5" max="2" step="0.05" value="${imageSettings.brightness}">
        <span class="value" id="val-brightness">${imageSettings.brightness}</span>
      </div>
      
      <div class="setting-section">Custom Words & Colors</div>
      <div class="word-input-group">
        <input type="text" id="newWord" placeholder="Add new word/phrase" style="width: 100%; padding: 8px; margin-bottom: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div>
            <label style="font-size: 10px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 4px;">Color</label>
            <input type="color" id="newWordColor" value="#FFFFFF" style="width: 100%; height: 32px;">
          </div>
          <div>
            <label style="font-size: 10px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 4px;">Font</label>
            <select id="newWordFont" style="width: 100%; padding: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px;">
              <option value="monospace">Mono</option>
              <option value="sans-serif">Sans</option>
              <option value="serif">Serif</option>
              <option value="fantasy">Fantasy</option>
              <option value="cursive">Cursive</option>
            </select>
          </div>
          <div>
            <label style="font-size: 10px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 4px;">Size</label>
            <input type="number" id="newWordSize" value="10" min="6" max="24" style="width: 100%; padding: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px;">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <button id="addWordBtn" style="padding: 8px; background: rgba(100,210,255,0.2); border: 1px solid rgba(100,210,255,0.3); border-radius: 6px; color: #64d2ff; font-size: 10px; cursor: pointer;">Add</button>
          <button id="clearWordsBtn" style="padding: 8px; background: rgba(255,100,100,0.2); border: 1px solid rgba(255,100,100,0.3); border-radius: 6px; color: #ff6464; font-size: 10px; cursor: pointer;">Clear</button>
          <button id="resetWordsBtn" style="padding: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: rgba(255,255,255,0.9); font-size: 10px; cursor: pointer;">Reset</button>
          <button id="refreshWordsBtn" style="padding: 8px; background: rgba(100,255,100,0.2); border: 1px solid rgba(100,255,100,0.3); border-radius: 6px; color: #64ff64; font-size: 10px; cursor: pointer;">↻</button>
        </div>
        <div id="wordsList" style="max-height: 200px; overflow-y: auto;"></div>
      </div>
      
      <div class="setting-section">Rotation</div>
      <div class="setting-row">
        <label>Rotate X</label>
        <input type="range" id="ctrl-rotx" min="-180" max="180" step="1" value="${defaults.rotateX}">
        <span class="value" id="val-rotx">${defaults.rotateX}°</span>
      </div>
      <div class="setting-row">
        <label>Rotate Y</label>
        <input type="range" id="ctrl-roty" min="-180" max="180" step="1" value="${defaults.rotateY}">
        <span class="value" id="val-roty">${defaults.rotateY}°</span>
      </div>
      <div class="setting-row">
        <label>Rotate Z</label>
        <input type="range" id="ctrl-rotz" min="-180" max="180" step="1" value="${defaults.rotateZ}">
        <span class="value" id="val-rotz">${defaults.rotateZ}°</span>
      </div>
      
      <div class="setting-buttons" style="margin-top: 12px;">
        <button onclick="resetAll()" style="grid-column: span 4;">Reset All</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  // Create toggle button (visible for accessing all controls)
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'settings-toggle';
  toggleBtn.className = 'settings-toggle';
  toggleBtn.innerHTML = '⚙';
  toggleBtn.onclick = toggleSettings;
  document.body.appendChild(toggleBtn);
  
  // Apply default values on init
  updatePanelSpacing(defaults.hSpread, defaults.vSpread, defaults.zOffset);
  installationGroup.rotation.set(
    THREE.MathUtils.degToRad(defaults.rotateX),
    THREE.MathUtils.degToRad(defaults.rotateY),
    THREE.MathUtils.degToRad(defaults.rotateZ)
  );
  
  // Setup event listeners
  setupSettingsListeners();
  
  // Initialize all displayed values
  updateAllDisplayedValues();
}

// Update all displayed values to reflect current settings
function updateAllDisplayedValues() {
  // Acrylic Panels
  document.getElementById('val-opacity').textContent = CONFIG.panel.opacity.toFixed(2);
  document.getElementById('val-thickness').textContent = CONFIG.panel.depth.toFixed(2);
  document.getElementById('val-hspread').textContent = CONFIG.defaults.hSpread.toFixed(2);
  document.getElementById('val-vspread').textContent = CONFIG.defaults.vSpread.toFixed(2);
  document.getElementById('val-zoffset').textContent = CONFIG.defaults.zOffset.toFixed(2);
  
  // TV Appearance
  document.getElementById('val-tvsize').textContent = '1.00';
  
  // Rotation
  document.getElementById('val-rotx').textContent = CONFIG.defaults.rotateX + '°';
  document.getElementById('val-roty').textContent = CONFIG.defaults.rotateY + '°';
  document.getElementById('val-rotz').textContent = CONFIG.defaults.rotateZ + '°';
  
  // Video Feed - Basic
  document.getElementById('val-threshold').textContent = imageSettings.threshold;
  document.getElementById('val-cellwidth').textContent = imageSettings.cellWidthMultiplier.toFixed(1);
  
  // Contour
  document.getElementById('val-pixelsize').textContent = imageSettings.pixelSize;
  document.getElementById('val-contoursens').textContent = imageSettings.contourSensitivity;
  document.getElementById('val-contourdensity').textContent = imageSettings.contourDensity;
  
  // Animation
  document.getElementById('val-animspeed').textContent = imageSettings.animationSpeed;
  
  // Glitch
  document.getElementById('val-glitchamt').textContent = imageSettings.glitchIntensity + '%';
  document.getElementById('val-glitchspeed').textContent = imageSettings.glitchSpeed;
  
  // Text/Grid
  document.getElementById('val-fontsize').textContent = imageSettings.defaultFontSize + 'px';
  document.getElementById('val-textdensity').textContent = imageSettings.textDensity.toFixed(1) + 'x';
  
  // Color Adjustments
  document.getElementById('val-contrast').textContent = imageSettings.contrast.toFixed(2);
  document.getElementById('val-saturation').textContent = imageSettings.saturation.toFixed(2);
  document.getElementById('val-brightness').textContent = imageSettings.brightness.toFixed(2);
}

// Toggle settings panel
window.toggleSettings = function() {
  const panel = document.getElementById('settings-panel');
  panel.classList.toggle('open');
  
  // Update words list when opening the panel
  if (panel.classList.contains('open')) {
    // Give iframe a moment to be ready
    setTimeout(() => {
      updateWordsListDisplay();
    }, 100);
  }
};

// Reset all settings
window.resetAll = function() {
  const { defaults } = CONFIG;
  
  // Acrylic panels
  document.getElementById('ctrl-opacity').value = CONFIG.panel.opacity;
  document.getElementById('ctrl-thickness').value = CONFIG.panel.depth;
  document.getElementById('ctrl-hspread').value = defaults.hSpread;
  document.getElementById('ctrl-vspread').value = defaults.vSpread;
  document.getElementById('ctrl-zoffset').value = defaults.zOffset;
  document.getElementById('ctrl-rotx').value = defaults.rotateX;
  document.getElementById('ctrl-roty').value = defaults.rotateY;
  document.getElementById('ctrl-rotz').value = defaults.rotateZ;
  
  document.getElementById('val-opacity').textContent = CONFIG.panel.opacity;
  document.getElementById('val-thickness').textContent = CONFIG.panel.depth;
  document.getElementById('val-hspread').textContent = defaults.hSpread;
  document.getElementById('val-vspread').textContent = defaults.vSpread;
  document.getElementById('val-zoffset').textContent = defaults.zOffset;
  document.getElementById('val-rotx').textContent = defaults.rotateX + '°';
  document.getElementById('val-roty').textContent = defaults.rotateY + '°';
  document.getElementById('val-rotz').textContent = defaults.rotateZ + '°';
  
  // Reset image settings to defaults
  imageSettings.threshold = 127;
  imageSettings.invert = false;
  imageSettings.flip = false;
  imageSettings.portraitMode = false;
  imageSettings.cellWidthMultiplier = 0;
  imageSettings.contour = true;
  imageSettings.pixelSize = 2;
  imageSettings.contourSensitivity = 25;
  imageSettings.contourDensity = 3;
  imageSettings.contourColor = '#FFFFFF';
  imageSettings.enableAnimation = false;
  imageSettings.animationType = 'wave';
  imageSettings.animationSpeed = 10;
  imageSettings.glitch = false;
  imageSettings.glitchType = 'vhstracking';
  imageSettings.glitchIntensity = 100;
  imageSettings.glitchSpeed = 3;
  imageSettings.defaultFontSize = 18;
  imageSettings.textDensity = 2.3;
  imageSettings.contrast = 1.25;
  imageSettings.saturation = 1.35;
  imageSettings.brightness = 1.1;
  
  // Update video feed controls
  document.getElementById('ctrl-threshold').value = 127;
  document.getElementById('val-threshold').textContent = '127';
  document.getElementById('ctrl-invert').checked = false;
  document.getElementById('ctrl-flip').checked = false;
  document.getElementById('ctrl-portrait').checked = false;
  document.getElementById('ctrl-cellwidth').value = 0;
  document.getElementById('val-cellwidth').textContent = '0.0';
  document.getElementById('ctrl-contour').checked = true;
  document.getElementById('ctrl-pixelsize').value = 2;
  document.getElementById('val-pixelsize').textContent = '2';
  document.getElementById('ctrl-contoursens').value = 25;
  document.getElementById('val-contoursens').textContent = '25';
  document.getElementById('ctrl-contourdensity').value = 3;
  document.getElementById('val-contourdensity').textContent = '3';
  document.getElementById('ctrl-contourcolor').value = '#FFFFFF';
  document.getElementById('ctrl-enableanim').checked = false;
  document.getElementById('ctrl-animtype').value = 'wave';
  document.getElementById('ctrl-animspeed').value = 10;
  document.getElementById('val-animspeed').textContent = '10';
  document.getElementById('ctrl-glitch').checked = false;
  document.getElementById('ctrl-glitchtype').value = 'vhstracking';
  document.getElementById('ctrl-glitchamt').value = 100;
  document.getElementById('val-glitchamt').textContent = '100%';
  document.getElementById('ctrl-glitchspeed').value = 3;
  document.getElementById('val-glitchspeed').textContent = '3';
  document.getElementById('ctrl-fontsize').value = 18;
  document.getElementById('val-fontsize').textContent = '18px';
  document.getElementById('ctrl-textdensity').value = 2.3;
  document.getElementById('val-textdensity').textContent = '2.3x';
  document.getElementById('ctrl-contrast').value = 1.25;
  document.getElementById('val-contrast').textContent = '1.25';
  document.getElementById('ctrl-saturation').value = 1.35;
  document.getElementById('val-saturation').textContent = '1.35';
  document.getElementById('ctrl-brightness').value = 1.1;
  document.getElementById('val-brightness').textContent = '1.10';
  
  updatePanelOpacity(CONFIG.panel.opacity);
  updatePanelThickness(CONFIG.panel.depth);
  updatePanelSpacing(defaults.hSpread, defaults.vSpread, defaults.zOffset);
  installationGroup.rotation.set(
    THREE.MathUtils.degToRad(defaults.rotateX),
    THREE.MathUtils.degToRad(defaults.rotateY),
    THREE.MathUtils.degToRad(defaults.rotateZ)
  );
  
  // Update iframe with reset settings
  updateIframeSettings();
  
  // Reset words to default
  resetWordsToDefault();
  
  // Camera is auto-controlled, reset pan angle and zoom
  panAngle = 0;
  targetZoom = 1.0;
  zoomFactor = 1.0;
  targetMouseX = 0;
  targetMouseY = 0;
};

// Setup settings input listeners
function setupSettingsListeners() {
  const { defaults } = CONFIG;
  let hSpread = defaults.hSpread;
  let vSpread = defaults.vSpread;
  let zOffset = defaults.zOffset;
  
  // Opacity
  document.getElementById('ctrl-opacity').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-opacity').textContent = v.toFixed(2);
    updatePanelOpacity(v);
  });
  
  // Thickness
  document.getElementById('ctrl-thickness').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-thickness').textContent = v.toFixed(2);
    updatePanelThickness(v);
  });
  
  // H-Spread
  document.getElementById('ctrl-hspread').addEventListener('input', (e) => {
    hSpread = parseFloat(e.target.value);
    document.getElementById('val-hspread').textContent = hSpread.toFixed(2);
    updatePanelSpacing(hSpread, vSpread, zOffset);
  });
  
  // V-Spread
  document.getElementById('ctrl-vspread').addEventListener('input', (e) => {
    vSpread = parseFloat(e.target.value);
    document.getElementById('val-vspread').textContent = vSpread.toFixed(2);
    updatePanelSpacing(hSpread, vSpread, zOffset);
  });
  
  // Z-Offset
  document.getElementById('ctrl-zoffset').addEventListener('input', (e) => {
    zOffset = parseFloat(e.target.value);
    document.getElementById('val-zoffset').textContent = zOffset.toFixed(2);
    updatePanelSpacing(hSpread, vSpread, zOffset);
  });
  
  // Rotate X
  document.getElementById('ctrl-rotx').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-rotx').textContent = v + '°';
    installationGroup.rotation.x = THREE.MathUtils.degToRad(v);
  });
  
  // Rotate Y
  document.getElementById('ctrl-roty').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-roty').textContent = v + '°';
    installationGroup.rotation.y = THREE.MathUtils.degToRad(v);
  });
  
  // Rotate Z
  document.getElementById('ctrl-rotz').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-rotz').textContent = v + '°';
    installationGroup.rotation.z = THREE.MathUtils.degToRad(v);
  });
  
  // TV Frame Color (also updates stand)
  document.getElementById('ctrl-tvcolor').addEventListener('input', (e) => {
    tvSettings.frameColor = e.target.value;
    if (tvFrame) {
      tvFrame.material.color.set(e.target.value);
    }
    if (standPole) {
      standPole.material.color.set(e.target.value);
    }
  });
  
  // TV Size
  document.getElementById('ctrl-tvsize').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-tvsize').textContent = v.toFixed(2);
    tvSettings.scale = v;
    if (tvGroup) {
      tvGroup.scale.set(v, v, v);
    }
  });
  
  // TV Border Visibility
  document.getElementById('ctrl-tvborder').addEventListener('change', (e) => {
    tvSettings.borderVisible = e.target.checked;
    if (screenBorder) {
      screenBorder.visible = e.target.checked;
    }
  });
  
  // TV Border Color
  document.getElementById('ctrl-bordercolor').addEventListener('input', (e) => {
    tvSettings.borderColor = e.target.value;
    if (screenBorder) {
      screenBorder.material.color.set(e.target.value);
    }
  });
  
  
  // === VIDEO FEED CONTROLS ===
  
  // Basic Controls
  document.getElementById('ctrl-threshold').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-threshold').textContent = v;
    imageSettings.threshold = v;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-invert').addEventListener('change', (e) => {
    imageSettings.invert = e.target.checked;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-flip').addEventListener('change', (e) => {
    imageSettings.flip = e.target.checked;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-portrait').addEventListener('change', (e) => {
    imageSettings.portraitMode = e.target.checked;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-cellwidth').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-cellwidth').textContent = v.toFixed(1);
    imageSettings.cellWidthMultiplier = v;
    updateIframeSettings();
  });
  
  // Contour Controls
  document.getElementById('ctrl-contour').addEventListener('change', (e) => {
    imageSettings.contour = e.target.checked;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-pixelsize').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-pixelsize').textContent = v;
    imageSettings.pixelSize = v;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-contoursens').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-contoursens').textContent = v;
    imageSettings.contourSensitivity = v;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-contourdensity').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-contourdensity').textContent = v;
    imageSettings.contourDensity = v;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-contourcolor').addEventListener('input', (e) => {
    imageSettings.contourColor = e.target.value;
    updateIframeSettings();
  });
  
  // Animation Controls
  document.getElementById('ctrl-enableanim').addEventListener('change', (e) => {
    imageSettings.enableAnimation = e.target.checked;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-animtype').addEventListener('change', (e) => {
    imageSettings.animationType = e.target.value;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-animspeed').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-animspeed').textContent = v;
    imageSettings.animationSpeed = v;
    updateIframeSettings();
  });
  
  // Glitch Controls
  document.getElementById('ctrl-glitch').addEventListener('change', (e) => {
    imageSettings.glitch = e.target.checked;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-glitchtype').addEventListener('change', (e) => {
    imageSettings.glitchType = e.target.value;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-glitchamt').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-glitchamt').textContent = v + '%';
    imageSettings.glitchIntensity = v;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-glitchspeed').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-glitchspeed').textContent = v;
    imageSettings.glitchSpeed = v;
    updateIframeSettings();
  });
  
  // Text/Grid Controls
  document.getElementById('ctrl-fontsize').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-fontsize').textContent = v + 'px';
    imageSettings.defaultFontSize = v;
    updateIframeSettings();
  });
  
  document.getElementById('ctrl-textdensity').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-textdensity').textContent = v.toFixed(1) + 'x';
    imageSettings.textDensity = v;
    updateIframeSettings();
  });
  
  // Color Adjustment Controls
  document.getElementById('ctrl-contrast').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-contrast').textContent = v.toFixed(2);
    imageSettings.contrast = v;
  });
  
  document.getElementById('ctrl-saturation').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-saturation').textContent = v.toFixed(2);
    imageSettings.saturation = v;
  });
  
  document.getElementById('ctrl-brightness').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-brightness').textContent = v.toFixed(2);
    imageSettings.brightness = v;
  });
  
  // Custom Words Controls
  document.getElementById('addWordBtn').addEventListener('click', function() {
    const text = document.getElementById('newWord').value.trim();
    if (text) {
      const color = document.getElementById('newWordColor').value;
      const font = document.getElementById('newWordFont').value;
      const size = parseInt(document.getElementById('newWordSize').value);
      
      addCustomWord(text, color, font, size);
      document.getElementById('newWord').value = '';
    }
  });
  
  document.getElementById('clearWordsBtn').addEventListener('click', function() {
    clearAllWords();
  });
  
  document.getElementById('resetWordsBtn').addEventListener('click', function() {
    resetWordsToDefault();
  });
  
  document.getElementById('refreshWordsBtn').addEventListener('click', function() {
    updateWordsListDisplay();
  });
  
  // Initialize words list with default values immediately
  initializeWordsListWithDefaults();
  
  // Also try to update from iframe when it's ready
  const iframe = document.getElementById('silhouette-iframe');
  if (iframe) {
    // Listen for iframe load event
    iframe.addEventListener('load', function() {
      setTimeout(() => {
        updateWordsListDisplay();
      }, 1000);
    });
  }
}

// Initialize words list with default words (from WORD SILHOUETTE defaults)
function initializeWordsListWithDefaults() {
  const wordsListElement = document.getElementById('wordsList');
  if (!wordsListElement) return;
  
  // Default words from WORD SILHOUETTE file
  const defaultWords = [
    { text: "YOU ARE", color: "#FF0000", font: "monospace", size: 10 },
    { text: "YOUR CHOICES", color: "#0000FF", font: "serif", size: 22 },
    { text: "PUBLIC SELF", color: "#00FF00", font: "monospace", size: 10 },
    { text: "POSSIBILITY", color: "#FFFF00", font: "monospace", size: 10 }
  ];
  
  displayWordsList(defaultWords);
}

// Display words list from an array
function displayWordsList(wordsData) {
  const wordsListElement = document.getElementById('wordsList');
  if (!wordsListElement) return;
  
  wordsListElement.innerHTML = '';
  
  if (wordsData.length === 0) {
    wordsListElement.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.3); font-size: 11px;">No words added yet</div>';
    return;
  }
  
  wordsData.forEach((word, index) => {
    const wordItem = document.createElement('div');
    wordItem.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px; margin-bottom: 8px;';
    
    wordItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="color: ${word.color}; font-family: ${word.font}; font-size: ${word.size}px; font-weight: 500;">${word.text}</span>
        <button onclick="deleteWord(${index})" style="background: rgba(255,100,100,0.2); border: 1px solid rgba(255,100,100,0.3); border-radius: 4px; color: #ff6464; font-size: 16px; width: 24px; height: 24px; cursor: pointer; line-height: 1;">×</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
        <div>
          <label style="font-size: 9px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 3px;">Color</label>
          <input type="color" value="${word.color}" onchange="updateWordProperty(${index}, 'color', this.value)" style="width: 100%; height: 24px; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; cursor: pointer;">
        </div>
        <div>
          <label style="font-size: 9px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 3px;">Font</label>
          <select onchange="updateWordProperty(${index}, 'font', this.value)" style="width: 100%; padding: 4px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #fff; font-size: 10px;">
            <option value="monospace" ${word.font === 'monospace' ? 'selected' : ''}>Mono</option>
            <option value="sans-serif" ${word.font === 'sans-serif' ? 'selected' : ''}>Sans</option>
            <option value="serif" ${word.font === 'serif' ? 'selected' : ''}>Serif</option>
            <option value="fantasy" ${word.font === 'fantasy' ? 'selected' : ''}>Fantasy</option>
            <option value="cursive" ${word.font === 'cursive' ? 'selected' : ''}>Cursive</option>
          </select>
        </div>
        <div>
          <label style="font-size: 9px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 3px;">Size</label>
          <input type="number" value="${word.size}" min="6" max="24" onchange="updateWordProperty(${index}, 'size', parseInt(this.value))" style="width: 100%; padding: 4px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #fff; font-size: 10px;">
        </div>
      </div>
    `;
    
    wordsListElement.appendChild(wordItem);
  });
}

// Custom Words Management Functions
function addCustomWord(text, color, font, size) {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) return;
  
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const iframeWindow = iframe.contentWindow;
    
    // Access the wordsData array in the iframe
    if (iframeWindow.wordsData) {
      iframeWindow.wordsData.push({ text, color, font, size });
      
      // Update the words list in the iframe
      if (iframeWindow.updateWordsList) {
        iframeWindow.updateWordsList();
      }
      
      // Reinitialize the grid to pick up the new word
      if (iframeWindow.initializeGrid) {
        iframeWindow.initializeGrid();
      }
      
      // Update our local display
      setTimeout(() => {
        updateWordsListDisplay();
      }, 50);
    }
  } catch (e) {
    console.log('Could not add word to iframe:', e.message);
  }
}

function clearAllWords() {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) return;
  
  try {
    const iframeWindow = iframe.contentWindow;
    
    if (iframeWindow.wordsData) {
      iframeWindow.wordsData = [];
      
      if (iframeWindow.updateWordsList) {
        iframeWindow.updateWordsList();
      }
      
      if (iframeWindow.initializeGrid) {
        iframeWindow.initializeGrid();
      }
      
      setTimeout(() => {
        updateWordsListDisplay();
      }, 50);
    }
  } catch (e) {
    console.log('Could not clear words:', e.message);
  }
}

function resetWordsToDefault() {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) return;
  
  try {
    const iframeWindow = iframe.contentWindow;
    
    if (iframeWindow.wordsData && iframeWindow.defaultWords) {
      iframeWindow.wordsData = [...iframeWindow.defaultWords];
      
      if (iframeWindow.updateWordsList) {
        iframeWindow.updateWordsList();
      }
      
      if (iframeWindow.initializeGrid) {
        iframeWindow.initializeGrid();
      }
      
      setTimeout(() => {
        updateWordsListDisplay();
      }, 50);
    }
  } catch (e) {
    console.log('Could not reset words:', e.message);
  }
}

function deleteWord(index) {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) return;
  
  try {
    const iframeWindow = iframe.contentWindow;
    
    if (iframeWindow.wordsData) {
      iframeWindow.wordsData.splice(index, 1);
      
      if (iframeWindow.updateWordsList) {
        iframeWindow.updateWordsList();
      }
      
      if (iframeWindow.initializeGrid) {
        iframeWindow.initializeGrid();
      }
      
      setTimeout(() => {
        updateWordsListDisplay();
      }, 50);
    }
  } catch (e) {
    console.log('Could not delete word:', e.message);
  }
}

function updateWordProperty(index, property, value) {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) return;
  
  try {
    const iframeWindow = iframe.contentWindow;
    
    if (iframeWindow.wordsData && iframeWindow.wordsData[index]) {
      // Update the word property
      iframeWindow.wordsData[index][property] = value;
      
      // Force a re-render of the words list in the iframe (updates the UI controls there)
      if (iframeWindow.updateWordsList) {
        iframeWindow.updateWordsList();
      }
      
      // Also reinitialize the grid if the function exists (forces text to regenerate)
      if (iframeWindow.initializeGrid) {
        iframeWindow.initializeGrid();
      }
      
      // Update our local display to reflect the change
      setTimeout(() => {
        updateWordsListDisplay();
      }, 50);
    }
  } catch (e) {
    console.log('Could not update word:', e.message);
  }
}

function updateWordsListDisplay() {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) {
    console.log('Iframe not ready yet');
    return;
  }
  
  try {
    const iframeWindow = iframe.contentWindow;
    
    // Check if iframe is ready
    if (!iframeWindow.wordsData) {
      console.log('wordsData not ready in iframe');
      return;
    }
    
    const wordsData = iframeWindow.wordsData || [];
    displayWordsList(wordsData);
  } catch (e) {
    console.log('Could not update words list display:', e.message);
  }
}

// Make functions globally accessible for inline onclick handlers
window.deleteWord = deleteWord;
window.updateWordProperty = updateWordProperty;

// Update iframe settings - synchronizes all controls with WORD SILHOUETTE iframe
function updateIframeSettings() {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) return;
  
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Basic Controls
    const thresholdEl = iframeDoc.getElementById('threshold');
    if (thresholdEl) {
      thresholdEl.value = imageSettings.threshold;
      thresholdEl.dispatchEvent(new Event('input'));
    }
    
    const invertEl = iframeDoc.getElementById('invertColors');
    if (invertEl) {
      invertEl.checked = imageSettings.invert;
      invertEl.dispatchEvent(new Event('change'));
    }
    
    const flipEl = iframeDoc.getElementById('flipVideo');
    if (flipEl) {
      flipEl.checked = imageSettings.flip;
      flipEl.dispatchEvent(new Event('change'));
    }
    
    const portraitEl = iframeDoc.getElementById('portraitMode');
    if (portraitEl) {
      portraitEl.checked = imageSettings.portraitMode;
      portraitEl.dispatchEvent(new Event('change'));
    }
    
    const cellWidthEl = iframeDoc.getElementById('cellWidthMultiplier');
    if (cellWidthEl) {
      cellWidthEl.value = imageSettings.cellWidthMultiplier;
      cellWidthEl.dispatchEvent(new Event('input'));
    }
    
    // Contour Controls
    const contourEl = iframeDoc.getElementById('showContour');
    if (contourEl) {
      contourEl.checked = imageSettings.contour;
      contourEl.dispatchEvent(new Event('change'));
    }
    
    const pixelSizeEl = iframeDoc.getElementById('pixelSize');
    if (pixelSizeEl) {
      pixelSizeEl.value = imageSettings.pixelSize;
      pixelSizeEl.dispatchEvent(new Event('input'));
    }
    
    const contourSensEl = iframeDoc.getElementById('contourSensitivity');
    if (contourSensEl) {
      contourSensEl.value = imageSettings.contourSensitivity;
      contourSensEl.dispatchEvent(new Event('input'));
    }
    
    const contourDensityEl = iframeDoc.getElementById('contourDensity');
    if (contourDensityEl) {
      contourDensityEl.value = imageSettings.contourDensity;
      contourDensityEl.dispatchEvent(new Event('input'));
    }
    
    const contourColorEl = iframeDoc.getElementById('contourColor');
    if (contourColorEl) {
      contourColorEl.value = imageSettings.contourColor;
      contourColorEl.dispatchEvent(new Event('input'));
    }
    
    // Animation Controls
    const enableAnimEl = iframeDoc.getElementById('enableAnimation');
    if (enableAnimEl) {
      enableAnimEl.checked = imageSettings.enableAnimation;
      enableAnimEl.dispatchEvent(new Event('change'));
    }
    
    const animTypeEl = iframeDoc.getElementById('animationType');
    if (animTypeEl) {
      animTypeEl.value = imageSettings.animationType;
      animTypeEl.dispatchEvent(new Event('change'));
    }
    
    const animSpeedEl = iframeDoc.getElementById('animationSpeed');
    if (animSpeedEl) {
      animSpeedEl.value = imageSettings.animationSpeed;
      animSpeedEl.dispatchEvent(new Event('input'));
    }
    
    // Glitch Controls
    const glitchEl = iframeDoc.getElementById('enableGlitch');
    if (glitchEl) {
      glitchEl.checked = imageSettings.glitch;
      glitchEl.dispatchEvent(new Event('change'));
    }
    
    const glitchTypeEl = iframeDoc.getElementById('glitchType');
    if (glitchTypeEl) {
      glitchTypeEl.value = imageSettings.glitchType;
      glitchTypeEl.dispatchEvent(new Event('change'));
    }
    
    const glitchAmtEl = iframeDoc.getElementById('glitchIntensity');
    if (glitchAmtEl) {
      glitchAmtEl.value = imageSettings.glitchIntensity;
      glitchAmtEl.dispatchEvent(new Event('input'));
    }
    
    const glitchSpeedEl = iframeDoc.getElementById('glitchSpeed');
    if (glitchSpeedEl) {
      glitchSpeedEl.value = imageSettings.glitchSpeed;
      glitchSpeedEl.dispatchEvent(new Event('input'));
    }
    
    // Text/Grid Controls
    const fontSizeEl = iframeDoc.getElementById('defaultFontSize');
    if (fontSizeEl) {
      fontSizeEl.value = imageSettings.defaultFontSize;
      fontSizeEl.dispatchEvent(new Event('input'));
    }
    
    const textDensityEl = iframeDoc.getElementById('textDensity');
    if (textDensityEl) {
      textDensityEl.value = imageSettings.textDensity;
      textDensityEl.dispatchEvent(new Event('input'));
    }
  } catch (e) {
    // Cross-origin or iframe not ready - silently fail
    console.log('Could not update iframe settings:', e.message);
  }
}

// ============================================
// Window Resize Handler
// ============================================
// Throttled resize for performance
function throttledResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(onWindowResize, PERF.throttleResize);
}

function onWindowResize() {
  const container = document.getElementById('three-container');
  if (!container || !renderer) return;
  
  const rect = container.getBoundingClientRect();
  const width = rect.width || window.innerWidth * 0.55;
  const height = rect.height || window.innerHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  
  // Dynamically adjust camera distance based on viewport
  adjustCameraForViewport(width, height);
}

// ============================================
// Adjust Camera for Viewport Size
// ============================================
// Global camera settings that animate() uses
let cameraDistance = 6;
let cameraY = 0.5;
let cameraTargetY = 0.5;
let cameraOffsetX = 0.3;
let isMobileView = false;

function adjustCameraForViewport(width, height) {
  if (!camera) return;
  
  // Original camera distance
  const baseDist = 6;
  let scaleFactor;
  
  // Check if mobile layout using VIEWPORT width (not container width)
  const viewportWidth = window.innerWidth;
  isMobileView = viewportWidth <= 768;
  
  if (isMobileView) {
    // Mobile: center the model - fit full model without cropping
    scaleFactor = 0.8;
    cameraY = 0.5;
    cameraTargetY = 0.5;
    cameraOffsetX = 0;
  } else if (width >= 1400) {
    scaleFactor = 0.9;
    cameraY = 0.5;
    cameraTargetY = 0.5;
    cameraOffsetX = 0.3;
  } else if (width >= 1200) {
    scaleFactor = 0.95;
    cameraY = 0.5;
    cameraTargetY = 0.5;
    cameraOffsetX = 0.3;
  } else if (width >= 1000) {
    scaleFactor = 1.0;
    cameraY = 0.5;
    cameraTargetY = 0.5;
    cameraOffsetX = 0.3;
  } else if (width >= 800) {
    scaleFactor = 1.1;
    cameraY = 0.5;
    cameraTargetY = 0.5;
    cameraOffsetX = 0.3;
  } else {
    scaleFactor = 1.25;
    cameraY = 0.5;
    cameraTargetY = 0.5;
    cameraOffsetX = 0.3;
  }
  
  // Reset model scale to default
  if (installationGroup) {
    installationGroup.scale.set(1, 1, 1);
  }
  
  cameraDistance = baseDist * scaleFactor;
}

// ============================================
// Animation Loop
// ============================================
function animate() {
  requestAnimationFrame(animate);
  
  // Update cinematic zoom animation if active
  if (isCinematicIntro) {
    updateCinematicZoom();
  } else {
    // Only apply user zoom when not in cinematic mode
    zoomFactor += (targetZoom - zoomFactor) * ZOOM_LERP;
  }
  
  // Smooth mouse following with lerp (linear interpolation)
  mouseX += (targetMouseX - mouseX) * MOUSE_LERP;
  mouseY += (targetMouseY - mouseY) * MOUSE_LERP;
  
  // Auto pan: smooth left-to-right oscillation
  panAngle += PAN_SPEED;
  
  // Oscillate between -PAN_RANGE and +PAN_RANGE using sine wave
  const panOffset = Math.sin(panAngle) * PAN_RANGE;
  
  // Camera position with mouse influence (subtle)
  // Mouse X affects horizontal position, mouse Y affects vertical slightly
  const mouseOffsetX = mouseX * MOUSE_SENSITIVITY;
  const mouseOffsetY = mouseY * MOUSE_SENSITIVITY * 0.5; // Less vertical movement
  
  // Apply zoom to camera distance
  const zoomedDistance = cameraDistance * zoomFactor;
  
  // Camera orbits slightly left/right, responds to mouse, and zooms
  camera.position.x = cameraOffsetX + panOffset + mouseOffsetX;
  camera.position.z = zoomedDistance;
  camera.position.y = cameraY + mouseOffsetY;
  
  // Always look at center of model
  camera.lookAt(cameraOffsetX, cameraTargetY, 0);
  
  // Render scene
  renderer.render(scene, camera);
}

// ============================================
// Initialize on DOM Load
// ============================================
document.addEventListener('DOMContentLoaded', init);

