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
let installationGroup;
let silhouetteCanvas, silhouetteCtx;
let leftLight;

// TV appearance settings
const tvSettings = {
  frameColor: '#111111',
  borderVisible: true,
  borderColor: '#ffffff'
};

// ============================================
// Initialize Scene
// ============================================
function init() {
  const container = document.getElementById('three-container');
  if (!container) {
    console.error('Three container not found');
    return;
  }
  
  // Get container dimensions
  const rect = container.getBoundingClientRect();
  const width = rect.width || window.innerWidth * 0.55;
  const height = rect.height || window.innerHeight;
  
  console.log('Container dimensions:', width, height);
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  
  // Camera - offset slightly right to optically center the model
  const aspect = width / height;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.set(0.3, 0.5, 5);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true 
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  
  // Handle resize
  window.addEventListener('resize', onWindowResize);
  
  // Initial viewport adjustment
  adjustCameraForViewport(width, height);
  
  // Start animation loop
  animate();
}

// ============================================
// Lighting Setup
// ============================================
function setupLighting() {
  // Ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);
  
  // Main directional light
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(5, 5, 5);
  scene.add(mainLight);
  
  // Fill light from the opposite side
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);
  
  // Subtle rim light from behind
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
  rimLight.position.set(0, 2, -5);
  scene.add(rimLight);
  
  // Subtle left-side glare light
  leftLight = new THREE.SpotLight(0xffffff, 0.6);
  leftLight.position.set(-8, 2, 3);
  leftLight.angle = Math.PI / 6;
  leftLight.penumbra = 0.8;
  leftLight.decay = 1.5;
  leftLight.distance = 20;
  leftLight.target.position.set(0, 0.5, 0);
  scene.add(leftLight);
  scene.add(leftLight.target);
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
  const tvGroup = new THREE.Group();
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
  
  // Main pole
  const poleGeometry = new THREE.CylinderGeometry(
    stand.poleRadius, 
    stand.poleRadius, 
    stand.poleHeight, 
    16
  );
  const poleMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x222222,
    roughness: 0.5,
    metalness: 0.8
  });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.y = -stand.poleHeight / 2 - 0.4;
  
  installationGroup.add(pole);
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
        <input type="range" id="ctrl-vspread" min="-1" max="1" step="0.05" value="${defaults.vSpread}">
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
        <label>Border</label>
        <input type="checkbox" id="ctrl-tvborder" ${tvSettings.borderVisible ? 'checked' : ''}>
      </div>
      <div class="setting-row">
        <label>Border Color</label>
        <input type="color" id="ctrl-bordercolor" value="${tvSettings.borderColor}">
      </div>
      <div class="setting-row">
        <label>Left Light</label>
        <input type="range" id="ctrl-leftlight" min="0" max="2" step="0.1" value="0.6">
        <span class="value" id="val-leftlight">0.6</span>
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
      
      <div class="setting-buttons">
        <button onclick="setView('front')">Front</button>
        <button onclick="setView('side')">Side</button>
        <button onclick="setView('top')">Top</button>
        <button onclick="resetAll()">Reset</button>
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
  
  // TV Frame Color
  document.getElementById('ctrl-tvcolor').addEventListener('input', (e) => {
    tvSettings.frameColor = e.target.value;
    if (tvFrame) {
      tvFrame.material.color.set(e.target.value);
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
  
  // Left Light Intensity
  document.getElementById('ctrl-leftlight').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-leftlight').textContent = v.toFixed(1);
    if (leftLight) {
      leftLight.intensity = v;
    }
  });
}

// ============================================
// Window Resize Handler
// ============================================
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
  
  // Update controls
  if (controls) {
    controls.update();
  }
  
  // Render scene
  renderer.render(scene, camera);
}

// ============================================
// Initialize on DOM Load
// ============================================
document.addEventListener('DOMContentLoaded', init);

