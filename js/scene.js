import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
    poleHeight: 1.5,
    poleRadius: 0.03,
    baseWidth: 0.4
  }
};

// ============================================
// Global Variables
// ============================================
let scene, camera, renderer, controls;
let tvScreen, tvScreenTexture, tvFrame, screenBorder;
let tvGroup, standPole;
let installationGroup;
let silhouetteCanvas, silhouetteCtx;
let cinematicMode = false;
let cinematicAngle = 0;

// Studio lighting setup
const studioLights = {
  ambient: null,
  key: null,
  fill: null,
  back: null,
  accent: null,
  area: null
};

// Lighting settings
const lightSettings = {
  ambientIntensity: 0.3,
  keyIntensity: 1.2,
  fillIntensity: 0.5,
  backIntensity: 0.6,
  overheadIntensity: 1.5,
  accentIntensity: 0.8,
  shadowSoftness: 0.5
};

// TV appearance settings
const tvSettings = {
  frameColor: '#111111',
  borderVisible: true,
  borderColor: '#ffffff',
  scale: 1
};

// Performance settings
const PERF = {
  maxPixelRatio: window.devicePixelRatio > 1 ? 1.5 : 1, // Cap for performance
  shadowMapSize: 1024, // Reduced from 2048
  antialias: window.devicePixelRatio < 2, // Disable on retina
  throttleResize: 100 // ms
};

let resizeTimeout;

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
  
  // Lighting
  setupLighting();
  
  // Create installation group (for rotation controls)
  installationGroup = new THREE.Group();
  scene.add(installationGroup);
  
  // Create 3D objects
  createTV();
  createAcrylicPanels();
  createStand();
  
  // Setup silhouette texture
  setupSilhouetteTexture();
  
  // Controls
  setupControls();
  setupGUI();
  
  // Handle resize with throttling
  window.addEventListener('resize', throttledResize);
  
  // Initial viewport adjustment
  adjustCameraForViewport(width, height);
  
  // Start animation loop
  animate();
}

// ============================================
// Lighting Setup
// ============================================
function setupLighting() {
  // Enable shadows on renderer
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // ═══════════════════════════════════════════
  // AMBIENT LIGHT - Base illumination
  // ═══════════════════════════════════════════
  studioLights.ambient = new THREE.AmbientLight(0xffffff, lightSettings.ambientIntensity);
  scene.add(studioLights.ambient);
  
  // ═══════════════════════════════════════════
  // KEY LIGHT - Main light source (like studio softbox)
  // ═══════════════════════════════════════════
  studioLights.key = new THREE.DirectionalLight(0xfff5e6, lightSettings.keyIntensity);
  studioLights.key.position.set(-4, 4, 5);
  studioLights.key.castShadow = true;
  studioLights.key.shadow.mapSize.width = PERF.shadowMapSize;
  studioLights.key.shadow.mapSize.height = PERF.shadowMapSize;
  studioLights.key.shadow.camera.near = 0.5;
  studioLights.key.shadow.camera.far = 20;
  studioLights.key.shadow.camera.left = -5;
  studioLights.key.shadow.camera.right = 5;
  studioLights.key.shadow.camera.top = 5;
  studioLights.key.shadow.camera.bottom = -5;
  studioLights.key.shadow.bias = -0.0001;
  studioLights.key.shadow.radius = 4; // Soft shadows
  scene.add(studioLights.key);
  
  // ═══════════════════════════════════════════
  // FILL LIGHT - Softens shadows (opposite side)
  // ═══════════════════════════════════════════
  studioLights.fill = new THREE.DirectionalLight(0xe6f0ff, lightSettings.fillIntensity);
  studioLights.fill.position.set(4, 2, 3);
  scene.add(studioLights.fill);
  
  // ═══════════════════════════════════════════
  // BACK/RIM LIGHT - Creates edge definition
  // ═══════════════════════════════════════════
  studioLights.back = new THREE.SpotLight(0xffffff, lightSettings.backIntensity);
  studioLights.back.position.set(0, 3, -5);
  studioLights.back.angle = Math.PI / 4;
  studioLights.back.penumbra = 0.8;
  studioLights.back.decay = 1.5;
  studioLights.back.distance = 15;
  studioLights.back.target.position.set(0, 0.5, 0);
  scene.add(studioLights.back);
  scene.add(studioLights.back.target);
  
  // ═══════════════════════════════════════════
  // OVERHEAD LIGHT - Top-down dramatic spotlight
  // ═══════════════════════════════════════════
  studioLights.overhead = new THREE.SpotLight(0xffffff, lightSettings.overheadIntensity);
  studioLights.overhead.position.set(0, 8, 0);
  studioLights.overhead.angle = Math.PI / 6; // Focused cone
  studioLights.overhead.penumbra = 0.5;
  studioLights.overhead.decay = 1.2;
  studioLights.overhead.distance = 15;
  studioLights.overhead.target.position.set(0, 0, 0);
  studioLights.overhead.castShadow = true;
  studioLights.overhead.shadow.mapSize.width = PERF.shadowMapSize;
  studioLights.overhead.shadow.mapSize.height = PERF.shadowMapSize;
  studioLights.overhead.shadow.camera.near = 1;
  studioLights.overhead.shadow.camera.far = 15;
  studioLights.overhead.shadow.bias = -0.0001;
  scene.add(studioLights.overhead);
  scene.add(studioLights.overhead.target);
  
  // ═══════════════════════════════════════════
  // ACCENT LIGHT - Left side dramatic lighting
  // ═══════════════════════════════════════════
  studioLights.accent = new THREE.SpotLight(0xffffff, lightSettings.accentIntensity);
  studioLights.accent.position.set(-6, 1, 4);
  studioLights.accent.angle = Math.PI / 5;
  studioLights.accent.penumbra = 0.6;
  studioLights.accent.decay = 1;
  studioLights.accent.distance = 20;
  studioLights.accent.castShadow = true;
  studioLights.accent.shadow.mapSize.width = PERF.shadowMapSize;
  studioLights.accent.shadow.mapSize.height = PERF.shadowMapSize;
  studioLights.accent.shadow.radius = 8;
  studioLights.accent.target.position.set(0, 0.5, 0);
  scene.add(studioLights.accent);
  scene.add(studioLights.accent.target);
  
  // ═══════════════════════════════════════════
  // AREA LIGHT - Soft overhead fill (RectAreaLight)
  // ═══════════════════════════════════════════
  // Note: RectAreaLight requires RectAreaLightUniformsLib
  // Using a point light as alternative for soft overhead
  studioLights.area = new THREE.PointLight(0xfff8f0, 0.4);
  studioLights.area.position.set(0, 6, 0);
  studioLights.area.decay = 2;
  studioLights.area.distance = 15;
  scene.add(studioLights.area);
  
}

// ============================================
// Create TV Monitor
// ============================================
function createTV() {
  const { tv } = CONFIG;
  
  // TV frame (black bezel)
  const frameGeometry = new THREE.BoxGeometry(tv.width, tv.height, tv.depth);
  const frameMaterial = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(tvSettings.frameColor),
    roughness: 0.8,
    metalness: 0.2
  });
  tvFrame = new THREE.Mesh(frameGeometry, frameMaterial);
  tvFrame.castShadow = true;
  tvFrame.receiveShadow = true;
  
  // TV screen (will display WORD SILHOUETTE)
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
  const poleMaterial = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(tvSettings.frameColor),
    roughness: 0.5,
    metalness: 0.8
  });
  standPole = new THREE.Mesh(poleGeometry, poleMaterial);
  standPole.position.y = -stand.poleHeight / 2 - 0.4;
  standPole.castShadow = true;
  standPole.receiveShadow = true;
  
  installationGroup.add(standPole);
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
    
    // Try to capture iframe content periodically
    setInterval(() => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const iframeCanvas = iframeDoc.querySelector('canvas');
        
        if (iframeCanvas) {
          // Draw iframe canvas content to our texture canvas
          silhouetteCtx.drawImage(
            iframeCanvas, 
            0, 0, 
            silhouetteCanvas.width, 
            silhouetteCanvas.height
          );
          tvScreenTexture.needsUpdate = true;
        }
      } catch (e) {
        // Cross-origin restrictions may prevent access
        // Fall back to a placeholder animation
        drawPlaceholderAnimation();
      }
    }, 1000 / 30); // 30 FPS update
  }
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
function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 10;
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = Math.PI / 1.5;
  controls.target.set(0.3, 0.5, 0); // Match camera offset for centering
  controls.update();
}


// ============================================
// Setup GUI Controls - Simple flat list
// ============================================
// Image settings for WORD SILHOUETTE
const imageSettings = {
  threshold: 83,
  invert: false,
  flip: false,
  contour: true,
  glitch: true,
  glitchIntensity: 20
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
      <div class="setting-section">Studio Lighting</div>
      <div class="setting-row">
        <label>Ambient</label>
        <input type="range" id="ctrl-ambient" min="0" max="1" step="0.05" value="${lightSettings.ambientIntensity}">
        <span class="value" id="val-ambient">${lightSettings.ambientIntensity}</span>
      </div>
      <div class="setting-row">
        <label>Key Light</label>
        <input type="range" id="ctrl-key" min="0" max="3" step="0.1" value="${lightSettings.keyIntensity}">
        <span class="value" id="val-key">${lightSettings.keyIntensity}</span>
      </div>
      <div class="setting-row">
        <label>Fill Light</label>
        <input type="range" id="ctrl-fill" min="0" max="2" step="0.1" value="${lightSettings.fillIntensity}">
        <span class="value" id="val-fill">${lightSettings.fillIntensity}</span>
      </div>
      <div class="setting-row">
        <label>Back Light</label>
        <input type="range" id="ctrl-back" min="0" max="2" step="0.1" value="${lightSettings.backIntensity}">
        <span class="value" id="val-back">${lightSettings.backIntensity}</span>
      </div>
      <div class="setting-row">
        <label>Overhead</label>
        <input type="range" id="ctrl-overhead" min="0" max="5" step="0.1" value="${lightSettings.overheadIntensity}">
        <span class="value" id="val-overhead">${lightSettings.overheadIntensity}</span>
      </div>
      <div class="setting-row">
        <label>Accent</label>
        <input type="range" id="ctrl-accent" min="0" max="3" step="0.1" value="${lightSettings.accentIntensity}">
        <span class="value" id="val-accent">${lightSettings.accentIntensity}</span>
      </div>
      
      <div class="setting-section">Image / Video</div>
      <div class="setting-row">
        <label>Threshold</label>
        <input type="range" id="ctrl-threshold" min="0" max="255" step="1" value="${imageSettings.threshold}">
        <span class="value" id="val-threshold">${imageSettings.threshold}</span>
      </div>
      <div class="setting-row">
        <label>Invert</label>
        <input type="checkbox" id="ctrl-invert" ${imageSettings.invert ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Flip</label>
        <input type="checkbox" id="ctrl-flip" ${imageSettings.flip ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Contour</label>
        <input type="checkbox" id="ctrl-contour" ${imageSettings.contour ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Glitch</label>
        <input type="checkbox" id="ctrl-glitch" ${imageSettings.glitch ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Glitch %</label>
        <input type="range" id="ctrl-glitchamt" min="0" max="100" step="5" value="${imageSettings.glitchIntensity}">
        <span class="value" id="val-glitchamt">${imageSettings.glitchIntensity}</span>
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
      
      <div class="setting-section">Camera</div>
      <div class="setting-buttons">
        <button onclick="setView('front')">Front</button>
        <button onclick="setView('side')">Side</button>
        <button onclick="setView('top')">Top</button>
        <button id="btn-cinematic" onclick="toggleCinematic()">🎬 Cine</button>
      </div>
      <div class="setting-buttons" style="margin-top: 8px;">
        <button onclick="resetAll()" style="grid-column: span 4;">Reset All</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  // Create toggle button
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
}

// Toggle settings panel
window.toggleSettings = function() {
  const panel = document.getElementById('settings-panel');
  panel.classList.toggle('open');
};

// Set camera view
window.setView = function(view) {
  switch(view) {
    case 'front':
      camera.position.set(0.3, 0.5, 5);
      break;
    case 'side':
      camera.position.set(5, 0.5, 0.3);
      break;
    case 'top':
      camera.position.set(0.3, 5, 0.1);
      break;
  }
  controls.target.set(0.3, 0.5, 0);
  controls.update();
};

// Reset all settings
window.resetAll = function() {
  const { defaults } = CONFIG;
  
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
  
  updatePanelOpacity(CONFIG.panel.opacity);
  updatePanelThickness(CONFIG.panel.depth);
  updatePanelSpacing(defaults.hSpread, defaults.vSpread, defaults.zOffset);
  installationGroup.rotation.set(
    THREE.MathUtils.degToRad(defaults.rotateX),
    THREE.MathUtils.degToRad(defaults.rotateY),
    THREE.MathUtils.degToRad(defaults.rotateZ)
  );
  camera.position.set(0.3, 0.5, 5);
  controls.target.set(0.3, 0.5, 0);
  controls.update();
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
  
  // Studio Lighting Controls
  
  // Ambient Light
  document.getElementById('ctrl-ambient').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-ambient').textContent = v.toFixed(2);
    lightSettings.ambientIntensity = v;
    if (studioLights.ambient) studioLights.ambient.intensity = v;
  });
  
  // Key Light
  document.getElementById('ctrl-key').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-key').textContent = v.toFixed(1);
    lightSettings.keyIntensity = v;
    if (studioLights.key) studioLights.key.intensity = v;
  });
  
  // Fill Light
  document.getElementById('ctrl-fill').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-fill').textContent = v.toFixed(1);
    lightSettings.fillIntensity = v;
    if (studioLights.fill) studioLights.fill.intensity = v;
  });
  
  // Back Light
  document.getElementById('ctrl-back').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-back').textContent = v.toFixed(1);
    lightSettings.backIntensity = v;
    if (studioLights.back) studioLights.back.intensity = v;
  });
  
  // Overhead Light (top-down)
  document.getElementById('ctrl-overhead').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-overhead').textContent = v.toFixed(1);
    lightSettings.overheadIntensity = v;
    if (studioLights.overhead) studioLights.overhead.intensity = v;
  });
  
  // Accent Light (left side)
  document.getElementById('ctrl-accent').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-accent').textContent = v.toFixed(1);
    lightSettings.accentIntensity = v;
    if (studioLights.accent) studioLights.accent.intensity = v;
  });
  
  // Image Controls - Threshold
  document.getElementById('ctrl-threshold').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-threshold').textContent = v;
    imageSettings.threshold = v;
    updateIframeSettings();
  });
  
  // Image Controls - Invert
  document.getElementById('ctrl-invert').addEventListener('change', (e) => {
    imageSettings.invert = e.target.checked;
    updateIframeSettings();
  });
  
  // Image Controls - Flip
  document.getElementById('ctrl-flip').addEventListener('change', (e) => {
    imageSettings.flip = e.target.checked;
    updateIframeSettings();
  });
  
  // Image Controls - Contour
  document.getElementById('ctrl-contour').addEventListener('change', (e) => {
    imageSettings.contour = e.target.checked;
    updateIframeSettings();
  });
  
  // Image Controls - Glitch
  document.getElementById('ctrl-glitch').addEventListener('change', (e) => {
    imageSettings.glitch = e.target.checked;
    updateIframeSettings();
  });
  
  // Image Controls - Glitch Intensity
  document.getElementById('ctrl-glitchamt').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('val-glitchamt').textContent = v;
    imageSettings.glitchIntensity = v;
    updateIframeSettings();
  });
}

// Update iframe settings
function updateIframeSettings() {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) return;
  
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Threshold
    const thresholdEl = iframeDoc.getElementById('threshold');
    if (thresholdEl) {
      thresholdEl.value = imageSettings.threshold;
      thresholdEl.dispatchEvent(new Event('input'));
    }
    
    // Invert
    const invertEl = iframeDoc.getElementById('invertColors');
    if (invertEl) {
      invertEl.checked = imageSettings.invert;
      invertEl.dispatchEvent(new Event('change'));
    }
    
    // Flip
    const flipEl = iframeDoc.getElementById('flipVideo');
    if (flipEl) {
      flipEl.checked = imageSettings.flip;
      flipEl.dispatchEvent(new Event('change'));
    }
    
    // Contour
    const contourEl = iframeDoc.getElementById('showContour');
    if (contourEl) {
      contourEl.checked = imageSettings.contour;
      contourEl.dispatchEvent(new Event('change'));
    }
    
    // Glitch
    const glitchEl = iframeDoc.getElementById('enableGlitch');
    if (glitchEl) {
      glitchEl.checked = imageSettings.glitch;
      glitchEl.dispatchEvent(new Event('change'));
    }
    
    // Glitch Intensity
    const glitchAmtEl = iframeDoc.getElementById('glitchIntensity');
    if (glitchAmtEl) {
      glitchAmtEl.value = imageSettings.glitchIntensity;
      glitchAmtEl.dispatchEvent(new Event('input'));
    }
  } catch (e) {
    // Cross-origin - silently fail
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
function adjustCameraForViewport(width, height) {
  if (!camera || !controls) return;
  
  // Calculate optimal camera distance based on viewport
  const minDimension = Math.min(width, height);
  const baseDist = 5;
  
  // Scale camera distance inversely with viewport size
  // Smaller viewport = closer camera, larger = further
  let scaleFactor = 1;
  
  if (minDimension < 400) {
    scaleFactor = 0.8;
  } else if (minDimension < 600) {
    scaleFactor = 0.9;
  } else if (minDimension > 900) {
    scaleFactor = 1.1;
  }
  
  // Update camera position while maintaining direction
  const direction = camera.position.clone().normalize();
  const newDist = baseDist * scaleFactor;
  
  // Only adjust if not actively using orbit controls
  if (!controls.enabled || controls.autoRotate) {
    camera.position.copy(direction.multiplyScalar(newDist));
  }
  
  // Update controls limits
  controls.minDistance = newDist * 0.6;
  controls.maxDistance = newDist * 2;
  controls.update();
}

// ============================================
// Animation Loop
// ============================================
function animate() {
  requestAnimationFrame(animate);
  
  // Cinematic pan mode
  if (cinematicMode && controls) {
    cinematicAngle += 0.002; // Slow rotation speed
    const radius = 6;
    const height = 0.8; // Slightly below center for downward angle
    
    camera.position.x = Math.sin(cinematicAngle) * radius;
    camera.position.z = Math.cos(cinematicAngle) * radius;
    camera.position.y = height;
    
    controls.target.set(0, 0.5, 0);
    camera.lookAt(0, 0.5, 0);
  }
  
  // Update controls
  if (controls) {
    controls.update();
  }
  
  // Render scene
  renderer.render(scene, camera);
}

// Toggle cinematic mode
window.toggleCinematic = function() {
  cinematicMode = !cinematicMode;
  if (cinematicMode) {
    cinematicAngle = Math.atan2(camera.position.x, camera.position.z);
    controls.enabled = false;
  } else {
    controls.enabled = true;
  }
  document.getElementById('btn-cinematic').textContent = cinematicMode ? '⏸ Stop' : '🎬 Cine';
};

// ============================================
// Initialize on DOM Load
// ============================================
document.addEventListener('DOMContentLoaded', init);

