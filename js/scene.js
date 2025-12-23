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
    depth: 0.02,
    opacity: 0.7
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
  
  // Camera
  const aspect = width / height;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.set(0, 0.5, 5);
  
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
// Create Acrylic Panels
// ============================================
function createAcrylicPanels() {
  const { panel, colors } = CONFIG;
  
  // Panel configurations (positions matching the Figma layout - 2x2 grid arrangement)
  // The panels overlap in the center to create the color mixing effect
  const panelConfigs = [
    { color: colors.yellow, x: -0.35, y: 0.95, z: 0.12 },    // Top-left
    { color: colors.green, x: 0.45, y: 1.15, z: 0.14 },      // Top-right
    { color: colors.red, x: -0.25, y: 0.15, z: 0.16 },       // Bottom-left
    { color: colors.blue, x: 0.55, y: 0.35, z: 0.18 }        // Bottom-right
  ];
  
  panelConfigs.forEach((config, index) => {
    const geometry = new THREE.PlaneGeometry(panel.width, panel.height);
    
    // Create material with additive blending for lighten effect
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: panel.opacity,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const panelMesh = new THREE.Mesh(geometry, material);
    panelMesh.position.set(config.x, config.y, config.z);
    panelMesh.userData.isAcrylicPanel = true;
    
    installationGroup.add(panelMesh);
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
  
  // Vertical line extending down (matching Figma design)
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -0.9, 0.08),
    new THREE.Vector3(0, -2.5, 0.08)
  ]);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const verticalLine = new THREE.Line(lineGeometry, lineMaterial);
  
  installationGroup.add(pole);
  installationGroup.add(verticalLine);
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
  controls.target.set(0, 0.5, 0);
  controls.update();
}

// ============================================
// Setup GUI Controls
// ============================================
function setupGUI() {
  gui = new lil.GUI({ 
    title: '3D Controls',
    width: 250
  });
  
  // Position GUI in bottom-right
  gui.domElement.style.position = 'fixed';
  gui.domElement.style.bottom = '20px';
  gui.domElement.style.right = '20px';
  gui.domElement.style.top = 'auto';
  
  // Rotation controls
  const rotationFolder = gui.addFolder('Rotation');
  
  const rotationParams = {
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0
  };
  
  rotationFolder.add(rotationParams, 'rotateX', -180, 180, 1)
    .name('X Rotation')
    .onChange((value) => {
      installationGroup.rotation.x = THREE.MathUtils.degToRad(value);
    });
  
  rotationFolder.add(rotationParams, 'rotateY', -180, 180, 1)
    .name('Y Rotation')
    .onChange((value) => {
      installationGroup.rotation.y = THREE.MathUtils.degToRad(value);
    });
  
  rotationFolder.add(rotationParams, 'rotateZ', -180, 180, 1)
    .name('Z Rotation')
    .onChange((value) => {
      installationGroup.rotation.z = THREE.MathUtils.degToRad(value);
    });
  
  rotationFolder.open();
  
  // View presets
  const viewFolder = gui.addFolder('View Presets');
  
  const viewPresets = {
    front: () => {
      camera.position.set(0, 0.5, 5);
      controls.target.set(0, 0.5, 0);
      controls.update();
    },
    side: () => {
      camera.position.set(5, 0.5, 0);
      controls.target.set(0, 0.5, 0);
      controls.update();
    },
    top: () => {
      camera.position.set(0, 5, 0.1);
      controls.target.set(0, 0.5, 0);
      controls.update();
    },
    diagonal: () => {
      camera.position.set(3, 2, 4);
      controls.target.set(0, 0.5, 0);
      controls.update();
    },
    reset: () => {
      rotationParams.rotateX = 0;
      rotationParams.rotateY = 0;
      rotationParams.rotateZ = 0;
      installationGroup.rotation.set(0, 0, 0);
      camera.position.set(0, 0.5, 5);
      controls.target.set(0, 0.5, 0);
      controls.update();
      gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
  };
  
  viewFolder.add(viewPresets, 'front').name('Front View');
  viewFolder.add(viewPresets, 'side').name('Side View');
  viewFolder.add(viewPresets, 'top').name('Top View');
  viewFolder.add(viewPresets, 'diagonal').name('Diagonal View');
  viewFolder.add(viewPresets, 'reset').name('Reset All');
  
  viewFolder.open();
  
  // Panel opacity control
  const panelFolder = gui.addFolder('Acrylic Panels');
  
  const panelParams = {
    opacity: CONFIG.panel.opacity
  };
  
  panelFolder.add(panelParams, 'opacity', 0.1, 1, 0.05)
    .name('Panel Opacity')
    .onChange((value) => {
      installationGroup.children.forEach(child => {
        if (child.userData && child.userData.isAcrylicPanel) {
          child.material.opacity = value;
        }
      });
    });
  
  // Close this folder by default to save space
  panelFolder.close();
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

