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
let tvScreen, tvScreenTexture;
let installationGroup;
let silhouetteCanvas, silhouetteCtx;
let gui;

// Image quality settings (synced with WORD SILHOUETTE iframe)
const imageSettings = {
  threshold: 83,
  invertColors: false,
  flipVideo: false,
  contourEnabled: true,
  glitchEnabled: true,
  glitchIntensity: 20
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
}

// ============================================
// Create TV Monitor
// ============================================
function createTV() {
  const { tv } = CONFIG;
  
  // TV frame (black bezel)
  const frameGeometry = new THREE.BoxGeometry(tv.width, tv.height, tv.depth);
  const frameMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x111111,
    roughness: 0.8,
    metalness: 0.2
  });
  const tvFrame = new THREE.Mesh(frameGeometry, frameMaterial);
  
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
  const borderMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const screenBorder = new THREE.LineSegments(borderGeometry, borderMaterial);
  screenBorder.position.z = tv.depth / 2 + 0.002;
  
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
// Update Silhouette Settings via iframe
// ============================================
function updateSilhouetteSettings() {
  const iframe = document.getElementById('silhouette-iframe');
  if (!iframe || !iframe.contentWindow) return;
  
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Update threshold
    const thresholdInput = iframeDoc.getElementById('threshold');
    if (thresholdInput) {
      thresholdInput.value = imageSettings.threshold;
      thresholdInput.dispatchEvent(new Event('input'));
    }
    
    // Update invert colors
    const invertInput = iframeDoc.getElementById('invertColors');
    if (invertInput) {
      invertInput.checked = imageSettings.invertColors;
      invertInput.dispatchEvent(new Event('change'));
    }
    
    // Update flip video
    const flipInput = iframeDoc.getElementById('flipVideo');
    if (flipInput) {
      flipInput.checked = imageSettings.flipVideo;
      flipInput.dispatchEvent(new Event('change'));
    }
    
    // Update contour
    const contourInput = iframeDoc.getElementById('showContour');
    if (contourInput) {
      contourInput.checked = imageSettings.contourEnabled;
      contourInput.dispatchEvent(new Event('change'));
    }
    
    // Update glitch
    const glitchInput = iframeDoc.getElementById('enableGlitch');
    if (glitchInput) {
      glitchInput.checked = imageSettings.glitchEnabled;
      glitchInput.dispatchEvent(new Event('change'));
    }
    
    // Update glitch intensity
    const glitchIntensityInput = iframeDoc.getElementById('glitchIntensity');
    if (glitchIntensityInput) {
      glitchIntensityInput.value = imageSettings.glitchIntensity;
      glitchIntensityInput.dispatchEvent(new Event('input'));
    }
  } catch (e) {
    // Cross-origin restrictions - silently fail
    console.log('Cannot access iframe settings:', e.message);
  }
}

// ============================================
// Setup GUI Controls
// ============================================
function setupGUI() {
  gui = new lil.GUI({ 
    title: 'Settings',
    width: 240
  });
  
  const { defaults } = CONFIG;
  
  // All parameters
  const params = {
    opacity: CONFIG.panel.opacity,
    thickness: CONFIG.panel.depth,
    hSpread: defaults.hSpread,
    vSpread: defaults.vSpread,
    zOffset: defaults.zOffset,
    rotateX: defaults.rotateX,
    rotateY: defaults.rotateY,
    rotateZ: defaults.rotateZ,
    // View presets
    viewFront: () => {
      camera.position.set(0.3, 0.5, 5);
      controls.target.set(0.3, 0.5, 0);
      controls.update();
    },
    viewSide: () => {
      camera.position.set(5, 0.5, 0.3);
      controls.target.set(0.3, 0.5, 0);
      controls.update();
    },
    viewTop: () => {
      camera.position.set(0.3, 5, 0.1);
      controls.target.set(0.3, 0.5, 0);
      controls.update();
    },
    resetAll: () => {
      // Reset panel params
      params.opacity = CONFIG.panel.opacity;
      params.thickness = CONFIG.panel.depth;
      params.hSpread = defaults.hSpread;
      params.vSpread = defaults.vSpread;
      params.zOffset = defaults.zOffset;
      params.rotateX = defaults.rotateX;
      params.rotateY = defaults.rotateY;
      params.rotateZ = defaults.rotateZ;
      // Reset image params
      imageSettings.threshold = 83;
      imageSettings.invertColors = false;
      imageSettings.flipVideo = false;
      imageSettings.contourEnabled = true;
      imageSettings.glitchEnabled = true;
      imageSettings.glitchIntensity = 20;
      // Apply changes
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
      updateSilhouetteSettings();
      gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
  };
  
  // Apply default values on init
  updatePanelSpacing(defaults.hSpread, defaults.vSpread, defaults.zOffset);
  installationGroup.rotation.set(
    THREE.MathUtils.degToRad(defaults.rotateX),
    THREE.MathUtils.degToRad(defaults.rotateY),
    THREE.MathUtils.degToRad(defaults.rotateZ)
  );
  
  // ═══════════════════════════════════════════
  // ACRYLIC PANELS
  // ═══════════════════════════════════════════
  const panelFolder = gui.addFolder('Acrylic Panels');
  
  panelFolder.add(params, 'opacity', 0.1, 1, 0.05).name('Opacity')
    .onChange(updatePanelOpacity);
  
  panelFolder.add(params, 'thickness', 0.01, 0.2, 0.01).name('Thickness')
    .onChange(updatePanelThickness);
  
  panelFolder.add(params, 'hSpread', -1, 1, 0.05).name('H-Spread')
    .onChange((v) => updatePanelSpacing(v, params.vSpread, params.zOffset));
  
  panelFolder.add(params, 'vSpread', -1, 1, 0.05).name('V-Spread')
    .onChange((v) => updatePanelSpacing(params.hSpread, v, params.zOffset));
  
  panelFolder.add(params, 'zOffset', -0.5, 0.5, 0.02).name('Z-Offset')
    .onChange((v) => updatePanelSpacing(params.hSpread, params.vSpread, v));
  
  panelFolder.open();
  
  // ═══════════════════════════════════════════
  // ROTATION
  // ═══════════════════════════════════════════
  const rotationFolder = gui.addFolder('Rotation');
  
  rotationFolder.add(params, 'rotateX', -180, 180, 1).name('X')
    .onChange((v) => { installationGroup.rotation.x = THREE.MathUtils.degToRad(v); });
  
  rotationFolder.add(params, 'rotateY', -180, 180, 1).name('Y')
    .onChange((v) => { installationGroup.rotation.y = THREE.MathUtils.degToRad(v); });
  
  rotationFolder.add(params, 'rotateZ', -180, 180, 1).name('Z')
    .onChange((v) => { installationGroup.rotation.z = THREE.MathUtils.degToRad(v); });
  
  rotationFolder.open();
  
  // ═══════════════════════════════════════════
  // IMAGE / VIDEO
  // ═══════════════════════════════════════════
  const imageFolder = gui.addFolder('Image / Video');
  
  imageFolder.add(imageSettings, 'threshold', 0, 255, 1).name('Threshold')
    .onChange(updateSilhouetteSettings);
  
  imageFolder.add(imageSettings, 'invertColors').name('Invert')
    .onChange(updateSilhouetteSettings);
  
  imageFolder.add(imageSettings, 'flipVideo').name('Flip')
    .onChange(updateSilhouetteSettings);
  
  imageFolder.add(imageSettings, 'contourEnabled').name('Contour')
    .onChange(updateSilhouetteSettings);
  
  imageFolder.add(imageSettings, 'glitchEnabled').name('Glitch')
    .onChange(updateSilhouetteSettings);
  
  imageFolder.add(imageSettings, 'glitchIntensity', 10, 100, 5).name('Glitch %')
    .onChange(updateSilhouetteSettings);
  
  imageFolder.open();
  
  // ═══════════════════════════════════════════
  // CAMERA VIEWS
  // ═══════════════════════════════════════════
  const viewFolder = gui.addFolder('Camera Views');
  
  viewFolder.add(params, 'viewFront').name('Front');
  viewFolder.add(params, 'viewSide').name('Side');
  viewFolder.add(params, 'viewTop').name('Top');
  viewFolder.add(params, 'resetAll').name('⟳ Reset All');
  
  viewFolder.open();
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

