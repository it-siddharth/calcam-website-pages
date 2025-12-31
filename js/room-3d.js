/**
 * Interactive 3D Room Model - Outside View
 * Shows the installation from an exterior perspective
 * Matching the installation-scene.js setup exactly
 */

class Room3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    // Config matching installation-scene.js
    this.CONFIG = {
      room: {
        width: 5,
        height: 7,
        depth: 10
      },
      colors: {
        yellow: 0xFDFF00,
        red: 0xFF0505,
        green: 0x11FF00,
        blue: 0x2600FF
      },
      panel: {
        width: 1.2,
        height: 1.5,
        depth: 0.02,
        opacity: 0.45
      },
      tv: {
        width: 1.8,
        height: 2.5,
        depth: 0.1,
        bezelWidth: 0.08
      },
      stand: {
        poleRadius: 0.03
      }
    };

    this.roomSettings = {
      wallColor: '#545454',
      floorColor: '#3d3d3d',
      ceilingColor: '#3d3d3d',
      tvFrameColor: '#1c1c1c',
      tvHeight: 2.25,
      panelOpacity: 0.45
    };

    // Panel base positions (matching installation-scene.js)
    this.panelBasePositions = [
      { x: -0.45, y: 0.75, z: 0.10 },
      { x: 0.50, y: 0.95, z: 0.12 },
      { x: -0.35, y: 0.05, z: 0.14 },
      { x: 0.60, y: 0.25, z: 0.16 }
    ];

    this.defaults = {
      hSpread: 0.35,
      vSpread: 1,
      zOffset: 0.50
    };

    this.acrylicPanels = [];
    this.autoRotate = true;
    this.autoRotateSpeed = 0.002;

    this.init();
    this.createRoom();
    this.createInstallation();
    this.createProjection();
    this.createSpeakers();
    this.createProjectors();
    this.addLights();
    this.animate();
    this.handleResize();
    this.setupInteraction();
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);

    // Camera - positioned outside for cutaway view, looking at the installation
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(6, 4, 8);
    this.camera.lookAt(0, 2, -3);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // Controls - orbit around the room
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI / 1.5;
    this.controls.minPolarAngle = Math.PI / 10;
    this.controls.target.set(0, 2.5, -2);  // Focus on installation area
    this.controls.autoRotate = false;
    this.controls.update();
  }

  createRoom() {
    const { width, height, depth } = this.CONFIG.room;
    
    // Materials - matching installation colors (darker)
    const wallMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.roomSettings.wallColor),
      side: THREE.DoubleSide
    });
    
    const backWallMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.roomSettings.wallColor).multiplyScalar(0.85),
      side: THREE.DoubleSide
    });
    
    const floorMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.roomSettings.floorColor),
      side: THREE.DoubleSide
    });

    // Floor
    const floorGeom = new THREE.PlaneGeometry(width, depth);
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.scene.add(floor);

    // NO ceiling - removed for cutaway view

    // Back wall (where installation is) - darker
    const backWallGeom = new THREE.PlaneGeometry(width, height);
    const backWall = new THREE.Mesh(backWallGeom, backWallMat);
    backWall.position.set(0, height / 2, -depth / 2);
    this.scene.add(backWall);

    // Left wall - full wall (where projection goes)
    const leftWallGeom = new THREE.PlaneGeometry(depth, height);
    const leftWall = new THREE.Mesh(leftWallGeom, wallMat.clone());
    leftWall.position.set(-width / 2, height / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);

    // Right wall - full wall
    const rightWallGeom = new THREE.PlaneGeometry(depth, height);
    const rightWall = new THREE.Mesh(rightWallGeom, wallMat.clone());
    rightWall.position.set(width / 2, height / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);

    // NO front wall - cutaway view to see inside

    // Add subtle edge wireframe for the room
    this.addRoomEdges(width, height, depth);
  }

  addRoomEdges(width, height, depth) {
    const edgeMaterial = new THREE.LineBasicMaterial({ 
      color: 0x666666,
      transparent: true,
      opacity: 0.6
    });

    const edges = [
      // Floor edges
      [[-width/2, 0, -depth/2], [width/2, 0, -depth/2]],
      [[-width/2, 0, depth/2], [width/2, 0, depth/2]],
      [[-width/2, 0, -depth/2], [-width/2, 0, depth/2]],
      [[width/2, 0, -depth/2], [width/2, 0, depth/2]],
      // Ceiling edges
      [[-width/2, height, -depth/2], [width/2, height, -depth/2]],
      [[-width/2, height, -depth/2], [-width/2, height, depth/2]],
      [[width/2, height, -depth/2], [width/2, height, depth/2]],
      [[-width/2, height, depth/2], [width/2, height, depth/2]],
      // Vertical edges
      [[-width/2, 0, -depth/2], [-width/2, height, -depth/2]],
      [[width/2, 0, -depth/2], [width/2, height, -depth/2]],
      [[-width/2, 0, depth/2], [-width/2, height, depth/2]],
      [[width/2, 0, depth/2], [width/2, height, depth/2]],
    ];

    edges.forEach(edge => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...edge[0]),
        new THREE.Vector3(...edge[1])
      ]);
      const line = new THREE.Line(geometry, edgeMaterial);
      this.scene.add(line);
    });
  }

  createInstallation() {
    const { room, tv } = this.CONFIG;
    
    this.installationGroup = new THREE.Group();
    this.installationGroup.position.set(0, 0, -room.depth / 2 + tv.depth / 2 + 0.01);
    
    this.createTV();
    this.createStand();
    this.createAcrylicPanels();
    
    this.scene.add(this.installationGroup);
  }

  createTV() {
    const { tv } = this.CONFIG;
    
    // TV frame (bezel)
    const frameGeometry = new THREE.BoxGeometry(tv.width, tv.height, tv.depth);
    const frameMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.roomSettings.tvFrameColor)
    });
    const tvFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    
    // TV screen - animated gradient/glow effect
    const screenWidth = tv.width - tv.bezelWidth * 2;
    const screenHeight = tv.height - tv.bezelWidth * 2;
    const screenGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
    
    // Create a canvas for the screen texture
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 256;
    this.screenCanvas.height = 192;
    this.screenCtx = this.screenCanvas.getContext('2d');
    
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    
    const screenMaterial = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      side: THREE.FrontSide
    });
    const tvScreen = new THREE.Mesh(screenGeometry, screenMaterial);
    tvScreen.position.z = tv.depth / 2 + 0.001;
    
    // Group TV components
    this.tvGroup = new THREE.Group();
    this.tvGroup.add(tvFrame);
    this.tvGroup.add(tvScreen);
    
    // Position TV
    this.tvGroup.position.y = this.roomSettings.tvHeight;
    
    this.installationGroup.add(this.tvGroup);
  }

  createStand() {
    const { tv, stand, room } = this.CONFIG;
    
    // Calculate height from TV bottom to floor
    const tvBottomY = this.roomSettings.tvHeight - tv.height / 2;
    const poleHeight = tvBottomY + room.depth / 2;
    
    // Main pole
    const poleGeometry = new THREE.CylinderGeometry(
      stand.poleRadius,
      stand.poleRadius,
      poleHeight,
      16
    );
    const poleMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.roomSettings.tvFrameColor)
    });
    const standPole = new THREE.Mesh(poleGeometry, poleMaterial);
    standPole.position.y = tvBottomY - poleHeight / 2;
    
    this.installationGroup.add(standPole);
  }

  createAcrylicPanels() {
    const { panel, colors } = this.CONFIG;
    const { hSpread, vSpread, zOffset } = this.defaults;
    
    const panelColors = [colors.yellow, colors.green, colors.red, colors.blue];
    
    this.panelBasePositions.forEach((basePos, index) => {
      const geometry = new THREE.BoxGeometry(panel.width, panel.height, panel.depth);
      
      // Additive blending for the colored acrylic effect - brighter for outside view
      const material = new THREE.MeshBasicMaterial({
        color: panelColors[index],
        transparent: true,
        opacity: 0.65, // Higher opacity for better visibility
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      
      const panelMesh = new THREE.Mesh(geometry, material);
      
      // Calculate spread position
      const xDir = index % 2 === 0 ? -1 : 1;
      const yDir = index < 2 ? 1 : -1;
      
      panelMesh.position.set(
        basePos.x + (xDir * hSpread * 0.5),
        basePos.y + (yDir * vSpread * 0.3) + 1.8,
        basePos.z + zOffset
      );
      
      this.acrylicPanels.push(panelMesh);
      this.installationGroup.add(panelMesh);
    });
  }

  createProjection() {
    // Particle projection on left wall (matching installation)
    const PARTICLE_COUNT = 3000;
    this.particlePositions = [];
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particlePositions.push({
        x: (Math.random() - 0.5) * 4,
        y: Math.random() * 2.5 + 0.5,
        z: 0,
        vx: (Math.random() - 0.5) * 0.01,
        vy: (Math.random() - 0.5) * 0.01,
        baseX: 0,
        baseY: 0
      });
    }
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = this.particlePositions[i].x;
      positions[i * 3 + 1] = this.particlePositions[i].y;
      positions[i * 3 + 2] = this.particlePositions[i].z;
      
      // Warm white/cream colors
      colors[i * 3] = 0.85 + Math.random() * 0.15;
      colors[i * 3 + 1] = 0.8 + Math.random() * 0.15;
      colors[i * 3 + 2] = 0.75 + Math.random() * 0.15;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    this.projectionMaterial = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    
    this.projectionPlane = new THREE.Points(geometry, this.projectionMaterial);
    this.projectionPlane.position.set(-this.CONFIG.room.width / 2 + 0.1, 0, -1);
    this.projectionPlane.rotation.y = Math.PI / 2;
    this.scene.add(this.projectionPlane);
  }

  createSpeakers() {
    const speakerColor = 0x0a0a0a;
    const speakerWidth = 0.15;
    const speakerHeight = 0.35;
    const speakerDepth = 0.12;
    
    const positions = [
      { x: -1.2, z: -this.CONFIG.room.depth / 2 + 0.8 },
      { x: 1.2, z: -this.CONFIG.room.depth / 2 + 0.8 }
    ];
    
    positions.forEach(pos => {
      // Speaker cabinet
      const cabinetGeom = new THREE.BoxGeometry(speakerWidth, speakerHeight, speakerDepth);
      const cabinetMat = new THREE.MeshBasicMaterial({ color: speakerColor });
      const cabinet = new THREE.Mesh(cabinetGeom, cabinetMat);
      cabinet.position.set(pos.x, speakerHeight / 2, pos.z);
      
      // Speaker cone
      const coneRadius = 0.04;
      const coneGeom = new THREE.CircleGeometry(coneRadius, 16);
      const coneMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
      const cone = new THREE.Mesh(coneGeom, coneMat);
      cone.position.set(pos.x, speakerHeight / 2 - 0.03, pos.z + speakerDepth / 2 + 0.001);
      
      // Tweeter
      const tweeterGeom = new THREE.CircleGeometry(0.015, 12);
      const tweeterMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
      const tweeter = new THREE.Mesh(tweeterGeom, tweeterMat);
      tweeter.position.set(pos.x, speakerHeight / 2 + 0.08, pos.z + speakerDepth / 2 + 0.001);
      
      this.scene.add(cabinet);
      this.scene.add(cone);
      this.scene.add(tweeter);
    });
  }

  createProjectors() {
    const { room } = this.CONFIG;
    const projectorColor = 0x1a1a1a;
    
    // Projector dimensions (small ceiling-mounted projectors)
    const projectorWidth = 0.25;
    const projectorHeight = 0.15;
    const projectorDepth = 0.35;
    
    // Two projectors on opposite walls, mounted near the ceiling
    const positions = [
      { x: -room.width / 2 + 0.3, z: 0, rotation: Math.PI / 2 },   // Left wall, pointing right
      { x: room.width / 2 - 0.3, z: 0, rotation: -Math.PI / 2 }    // Right wall, pointing left
    ];
    
    positions.forEach(pos => {
      // Projector body
      const bodyGeom = new THREE.BoxGeometry(projectorWidth, projectorHeight, projectorDepth);
      const bodyMat = new THREE.MeshBasicMaterial({ color: projectorColor });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.set(pos.x, room.height - 0.3, pos.z);
      body.rotation.y = pos.rotation;
      
      // Projector lens (cylinder)
      const lensGeom = new THREE.CylinderGeometry(0.04, 0.05, 0.08, 16);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
      const lens = new THREE.Mesh(lensGeom, lensMat);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(
        pos.x + (pos.rotation > 0 ? 0.15 : -0.15),
        room.height - 0.3,
        pos.z
      );
      
      // Mounting bracket (connects to ceiling)
      const bracketGeom = new THREE.BoxGeometry(0.08, 0.25, 0.08);
      const bracketMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
      const bracket = new THREE.Mesh(bracketGeom, bracketMat);
      bracket.position.set(pos.x, room.height - 0.125, pos.z);
      
      // Light beam (subtle cone showing projection)
      const beamGeom = new THREE.ConeGeometry(1.5, 3, 4);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffffee,
        transparent: true,
        opacity: 0.03,
        side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beam.position.set(
        pos.rotation > 0 ? pos.x + 1.8 : pos.x - 1.8,
        room.height - 1.5,
        pos.z
      );
      beam.rotation.z = pos.rotation > 0 ? -Math.PI / 2 : Math.PI / 2;
      
      this.scene.add(body);
      this.scene.add(lens);
      this.scene.add(bracket);
      this.scene.add(beam);
    });
  }

  addLights() {
    // Ambient light for overall visibility
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambient);

    // Main directional light from camera's direction
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.4);
    mainLight.position.set(5, 8, 8);
    this.scene.add(mainLight);

    // Glow from TV
    const tvGlow = new THREE.PointLight(0xffffff, 0.5, 6, 2);
    tvGlow.position.set(0, this.roomSettings.tvHeight, -this.CONFIG.room.depth / 2 + 0.8);
    this.scene.add(tvGlow);

    // Colored accent lights from acrylic panels - brighter for visibility
    const blueLight = new THREE.PointLight(0x2600ff, 0.3, 5);
    blueLight.position.set(0.5, 2.5, -this.CONFIG.room.depth / 2 + 1);
    this.scene.add(blueLight);

    const greenLight = new THREE.PointLight(0x11ff00, 0.25, 5);
    greenLight.position.set(-0.3, 2.2, -this.CONFIG.room.depth / 2 + 1);
    this.scene.add(greenLight);
    
    const yellowLight = new THREE.PointLight(0xfdff00, 0.2, 5);
    yellowLight.position.set(-0.4, 2.8, -this.CONFIG.room.depth / 2 + 1);
    this.scene.add(yellowLight);
    
    const redLight = new THREE.PointLight(0xff0505, 0.2, 5);
    redLight.position.set(0.5, 2.1, -this.CONFIG.room.depth / 2 + 1);
    this.scene.add(redLight);
  }

  updateScreenAnimation(time) {
    if (!this.screenCtx) return;
    
    const ctx = this.screenCtx;
    const w = this.screenCanvas.width;
    const h = this.screenCanvas.height;
    
    // Dark background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    
    // Draw animated word silhouette effect
    const words = ['YOU ARE', 'YOUR CHOICES', 'PUBLIC SELF', 'POSSIBILITY'];
    const textColors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00'];
    
    ctx.save();
    
    // Create silhouette clip path
    ctx.beginPath();
    const centerX = w / 2;
    const centerY = h / 2;
    
    // Head
    ctx.ellipse(centerX, centerY - 15, 45, 55, 0, 0, Math.PI * 2);
    
    // Body
    ctx.moveTo(centerX - 45, centerY + 40);
    ctx.quadraticCurveTo(centerX - 65, centerY + 60, centerX - 75, h);
    ctx.lineTo(centerX + 75, h);
    ctx.quadraticCurveTo(centerX + 65, centerY + 60, centerX + 45, centerY + 40);
    
    ctx.clip();
    
    // Fill with animated words
    for (let y = 10; y < h; y += 12) {
      for (let x = 0; x < w; x += 60) {
        const wordIndex = Math.floor((x + y + time * 25) / 60) % words.length;
        const fontSize = 6 + Math.sin(time * 1.5 + x * 0.02 + y * 0.02) * 1;
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = textColors[wordIndex];
        ctx.fillText(words[wordIndex], x + Math.sin(time * 1.5 + y * 0.04) * 2, y);
      }
    }
    
    ctx.restore();
    
    // Subtle border glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - 15, 45, 55, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    this.screenTexture.needsUpdate = true;
  }

  updateProjection(time) {
    if (!this.projectionPlane) return;
    
    const positions = this.projectionPlane.geometry.attributes.position.array;
    
    for (let i = 0; i < this.particlePositions.length; i++) {
      const p = this.particlePositions[i];
      
      const noiseX = Math.sin(time * 0.3 + p.baseY * 2) * 0.2;
      const noiseY = Math.cos(time * 0.2 + p.baseX * 2) * 0.12;
      
      p.x += p.vx + noiseX * 0.006;
      p.y += p.vy + noiseY * 0.006;
      
      // Keep particles within silhouette shape
      const centerY = 1.8;
      const centerX = 0;
      const headRadiusX = 0.8;
      const headRadiusY = 1;
      const headCenterY = centerY + 0.3;
      
      const inHead = Math.pow((p.x - centerX) / headRadiusX, 2) + 
                     Math.pow((p.y - headCenterY) / headRadiusY, 2) < 1;
      
      const bodyTop = centerY - 0.5;
      const inBody = p.y < bodyTop && p.y > 0.3 &&
                     Math.abs(p.x) < 1.5 - (bodyTop - p.y) * 0.35;
      
      if (!inHead && !inBody) {
        if (Math.random() > 0.5) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random();
          p.x = centerX + Math.cos(angle) * headRadiusX * r;
          p.y = headCenterY + Math.sin(angle) * headRadiusY * r;
        } else {
          p.x = (Math.random() - 0.5) * 2;
          p.y = Math.random() * (bodyTop - 0.3) + 0.3;
        }
        p.vx = (Math.random() - 0.5) * 0.006;
        p.vy = (Math.random() - 0.5) * 0.006;
      }
      
      p.baseX = p.x;
      p.baseY = p.y;
      
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = Math.sin(time + i * 0.001) * 0.02;
    }
    
    this.projectionPlane.geometry.attributes.position.needsUpdate = true;
  }

  setupInteraction() {
    // Stop auto-rotate on user interaction
    this.controls.addEventListener('start', () => {
      this.autoRotate = false;
    });
    
    // Resume auto-rotate after inactivity
    let timeout;
    this.controls.addEventListener('end', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.autoRotate = true;
      }, 3000);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const time = performance.now() * 0.001;
    
    // Auto-rotate camera slowly
    if (this.autoRotate) {
      const angle = time * this.autoRotateSpeed;
      const radius = this.camera.position.length();
      const baseAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
      // Very subtle rotation
      this.camera.position.x = Math.sin(baseAngle + 0.0003) * radius * 0.7;
      this.camera.position.z = Math.cos(baseAngle + 0.0003) * radius * 0.85;
    }
    
    // Update animations
    this.updateScreenAnimation(time);
    this.updateProjection(time);
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    window.addEventListener('resize', () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    });
  }

  dispose() {
    this.renderer.dispose();
    this.controls.dispose();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const room = new Room3D('room-3d-container');
});
