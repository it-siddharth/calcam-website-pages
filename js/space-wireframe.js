import * as THREE from '../vendor/three-0.160.0/three.module.js';

const container = document.getElementById('space-model');

if (container) {
  try {
    const scene = new THREE.Scene();
    const model = new THREE.Group();
    scene.add(model);
    const white = 0xf3f3f3;
    const soft = 0x888888;
    const room = { width: 5.18, depth: 4.57, height: 3.05 }; // 17 × 15 ft footprint; height is illustrative.
    const hoverTargets = [];
    const solid = (geometry, x, y, z, color, label) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      mesh.position.set(x, y, z);
      model.add(mesh);
      mesh.userData.label = label;
      hoverTargets.push(mesh);
      return mesh;
    };
    const lines = (points, color = white, opacity = 1) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
      const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      model.add(line);
      return line;
    };
    const edgeBox = (width, height, depth, x, y, z, color = white, opacity = 1, label = '', fill = 0x181818) => {
      solid(new THREE.BoxGeometry(width, height, depth), x, y, z, fill, label);
      const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
      const box = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      box.position.set(x, y, z);
      model.add(box);
      return box;
    };
    const ring = (radius, x, y, z, rotation = 0, color = white) => {
      const points = [];
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * Math.PI * 2;
        points.push([x + Math.cos(a) * radius, y + Math.sin(a) * radius, z]);
        const b = (i + 1) / 32 * Math.PI * 2;
        points.push([x + Math.cos(b) * radius, y + Math.sin(b) * radius, z]);
      }
      const line = lines(points, color);
      line.rotation.y = rotation;
      return line;
    };

    const w = room.width / 2, d = room.depth / 2, h = room.height;
    // Open front and ceiling keep the full floor plan legible from outside.
    const backWall = solid(new THREE.PlaneGeometry(room.width, h), 0, h / 2, -d, 0x050505, 'Back wall');
    // From behind, the wall must not cover the room's interior as a black slab.
    backWall.material.side = THREE.FrontSide;
    const floor = solid(new THREE.PlaneGeometry(room.width, room.depth), 0, 0, 0, 0x050505, 'Gallery floor');
    floor.rotation.x = -Math.PI / 2;
    lines([
      [-w, 0, -d], [w, 0, -d], [w, 0, -d], [w, 0, d],
      [w, 0, d], [-w, 0, d], [-w, 0, d], [-w, 0, -d],
      [-w, 0, -d], [-w, h, -d], [w, 0, -d], [w, h, -d],
      [-w, 0, d], [-w, h, d], [w, 0, d], [w, h, d],
      [-w, h, -d], [w, h, -d], [-w, h, -d], [-w, h, d],
      [w, h, -d], [w, h, d]
    ], white, .8);
    // Subtle floor guides establish depth without filling the room.
    for (let z = -d + 1; z < d; z += 1) lines([[-w, .003, z], [w, .003, z]], soft, .18);
    for (let x = -w + 1; x < w; x += 1) lines([[x, .003, -d], [x, .003, d]], soft, .18);

    // Central TV and stand, positioned at the far wall.
    const backZ = -d + .22;
    edgeBox(1.23, .72, .08, 0, 1.55, backZ, white, 1, '55-inch TV');
    edgeBox(1.12, .61, .005, 0, 1.55, backZ + .045, soft, .65, 'TV screen', 0x090909);
    lines([[0, 1.19, backZ], [0, .22, backZ], [-.34, .22, backZ], [.34, .22, backZ]], white, .75);

    // Solid faces keep objects behind the acrylic sheets from showing through.
    const panels = [
      [-.53, 2.05, backZ + .38], [.53, 2.19, backZ + .55],
      [-.45, 1.28, backZ + .72], [.48, 1.38, backZ + .88]
    ];
    panels.forEach(([x, y, z], i) => {
      edgeBox(.60, 1.02, .018, x, y, z, [0xffed00, 0x24f13e, 0xff3434, 0x344eff][i], .95, `Hanging acrylic panel ${i + 1}`, [0x786f00, 0x0c6e1c, 0x771515, 0x17267c][i]);
      lines([[x, y + .51, z], [x, h, z]], soft, .55);
    });

    // Speakers on the floor, with visible circular drivers.
    [-1.52, 1.52].forEach((x, i) => {
      edgeBox(.21, .48, .2, x, .24, backZ + .65, white, 1, `${i === 0 ? 'Left' : 'Right'} speaker`);
      ring(.075, x, .19, backZ + .755);
      ring(.03, x, .35, backZ + .755);
    });

    // Each ceiling projector faces the opposite wall, angled 45° downward.
    [-1.85, 1.85].forEach((x, i) => {
      lines([[x, h, .22], [x, h - .18, .22]], soft, .75);
      const projector = new THREE.Group();
      projector.position.set(x, h - .27, .22);
      const aim = new THREE.Vector3(i === 0 ? 1 : -1, -1, 0).normalize();
      projector.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aim);
      const geometry = new THREE.BoxGeometry(.34, .17, .42);
      const body = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x181818 }));
      body.userData.label = `${i === 0 ? 'Left' : 'Right'} ceiling projector`;
      hoverTargets.push(body);
      projector.add(body);
      projector.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: white })
      ));
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(.055, 32),
        new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide })
      );
      lens.position.z = .213;
      projector.add(lens);
      const rim = new THREE.Mesh(
        new THREE.RingGeometry(.052, .057, 32),
        new THREE.MeshBasicMaterial({ color: white, side: THREE.DoubleSide })
      );
      rim.position.z = .215;
      projector.add(rim);
      model.add(projector);
    });

    // Two compact camera markers at eye level.
    [[-w + .15, -.3], [w - .15, -.3]].forEach(([x, z], i) => {
      edgeBox(.16, .12, .16, x, 1.65, z, soft, .85, `Camera ${i + 1}`);
      lines([[x, 1.59, z], [x, 1.05, z]], soft, .55);
    });

    const camera = new THREE.PerspectiveCamera(44, 1, .1, 100);
    const target = new THREE.Vector3(0, 1.35, -.15);
    let azimuth = .47, elevation = .32;
    const distance = 8.75;
    const updateCamera = () => {
      camera.position.set(
        target.x + distance * Math.sin(azimuth) * Math.cos(elevation),
        target.y + distance * Math.sin(elevation),
        target.z + distance * Math.cos(azimuth) * Math.cos(elevation)
      );
      camera.lookAt(target);
    };
    updateCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    container.classList.add('is-live');

    const tooltip = document.createElement('span');
    tooltip.className = 't-tt space-model-tooltip';
    tooltip.id = 'space-model-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.dataset.show = 'false';
    const tooltipText = document.createElement('span');
    tooltipText.className = 't-tt-text';
    tooltip.appendChild(tooltipText);
    container.appendChild(tooltip);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let activeLabel = '';
    const hideTooltip = () => {
      activeLabel = '';
      tooltip.dataset.show = 'false';
      tooltip.setAttribute('aria-hidden', 'true');
      renderer.domElement.style.cursor = dragging ? 'grabbing' : 'grab';
    };
    const showTooltip = event => {
      if (dragging || event.pointerType === 'touch') return hideTooltip();
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      model.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hoverTargets, false)[0];
      if (!hit || !hit.object.userData.label) return hideTooltip();
      const label = hit.object.userData.label;
      if (label !== activeLabel) {
        tooltipText.textContent = label;
        const styles = getComputedStyle(tooltip);
        const width = Math.ceil(tooltipText.scrollWidth + parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight));
        if (!activeLabel) tooltip.style.transition = 'none';
        tooltip.style.width = `${width}px`;
        tooltip.style.setProperty('--tt-x', `${Math.max(8, Math.min(rect.width - width - 8, event.clientX - rect.left - width / 2))}px`);
        if (!activeLabel) { void tooltip.offsetWidth; tooltip.style.transition = ''; }
        activeLabel = label;
      } else {
        const width = tooltip.getBoundingClientRect().width;
        tooltip.style.setProperty('--tt-x', `${Math.max(8, Math.min(rect.width - width - 8, event.clientX - rect.left - width / 2))}px`);
      }
      tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 50)}px`;
      tooltip.dataset.show = 'true';
      tooltip.setAttribute('aria-hidden', 'false');
    };

    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      render();
    };
    new ResizeObserver(resize).observe(container);
    resize();

    // A small, slow turn makes the room read as a model without hiding its open front.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dragging = false, lastX = 0, lastY = 0;
    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
      }).observe(container);
    }
    const animate = time => {
      if (visible && !dragging && !reducedMotion) {
        model.rotation.y = Math.sin(time * .00035) * .16;
        render();
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    renderer.domElement.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      hideTooltip();
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', event => {
      if (!dragging) return showTooltip(event);
      azimuth = THREE.MathUtils.clamp(azimuth + (event.clientX - lastX) * .006, -100 * Math.PI / 180, 100 * Math.PI / 180);
      elevation = THREE.MathUtils.clamp(elevation + (lastY - event.clientY) * .006, .08, 1.25);
      lastX = event.clientX;
      lastY = event.clientY;
      updateCamera();
      render();
    });
    renderer.domElement.addEventListener('pointerup', () => { dragging = false; });
    renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });
    renderer.domElement.addEventListener('lostpointercapture', () => { dragging = false; });
    renderer.domElement.addEventListener('pointerleave', hideTooltip);
  } catch (error) {
    console.warn('Room model could not be displayed:', error);
  }
}
