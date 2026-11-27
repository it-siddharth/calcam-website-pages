import * as THREE from '../vendor/three-0.160.0/three.module.js';
    // The journal uses two page faces with separate materials. Merge their
    // non-indexed attributes so the page curl still moves them as one sheet.
    function mergeGeometries(geometries) {
      const faces = geometries.map(geometry => geometry.toNonIndexed());
      const merged = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) {
        const itemSize = faces[0].getAttribute(name).itemSize;
        const length = faces.reduce((sum, face) => sum + face.getAttribute(name).array.length, 0);
        const values = new Float32Array(length);
        let offset = 0;
        for (const face of faces) {
          const source = face.getAttribute(name).array;
          values.set(source, offset);
          offset += source.length;
        }
        merged.setAttribute(name, new THREE.BufferAttribute(values, itemSize));
      }
      let start = 0;
      faces.forEach((face, index) => {
        const count = face.getAttribute('position').count;
        merged.addGroup(start, count, index);
        start += count;
        face.dispose();
      });
      return merged;
    }
    
    // Use the global three.modifiers from UMD bundle
    const MODIFIERS = window;

    // ============================================
    // Page images configuration
    // ============================================
    const pageImages = [
      'journal pages/new froint .png',
      'journal pages/1.png',
      'journal pages/2-min.png',
      'journal pages/3.png',
      'journal pages/4-min.png',
      'journal pages/5.png',
      'journal pages/6-min.png',
      'journal pages/1923.png',
      'journal pages/1924-min.png',
      'journal pages/1925-min.png',
      'journal pages/1926.png',
      'journal pages/1927.png',
      'journal pages/1928-min.png',
      'journal pages/1929.png',
      'journal pages/1930-min.png',
      'journal pages/1931.png',
      'journal pages/1932-min.png',
      'journal pages/1933.png',
      'journal pages/1934-min.png',
      'journal pages/1935.png',
      'journal pages/1936-min.png',
      'journal pages/1937.png',
      'journal pages/1938-min.png',
      'journal pages/1939.png',
      'journal pages/1940-min.png',
      'journal pages/1941.png',
      'journal pages/1942-min.png',
      'journal pages/1943.png',
      'journal pages/1944-min.png',
      'journal pages/1945.png',
      'journal pages/1946.png',
      'journal pages/1947-min.png',
      'journal pages/1948-min.png',
      'journal pages/1949.png',
      'journal pages/1950-min.png',
      'journal pages/back-min.png'
    ];

    // ============================================
    // PageCurve Modifier (custom modifier for book page curl)
    // ============================================
    class PageCurve extends MODIFIERS.UserDefined {
      constructor(elevationAxis = MODIFIERS.ModConstant.Y, alongAxis = MODIFIERS.ModConstant.X, effectRange = 0.5, effectMid = 0.5, elevationHeight = 0.5) {
        super();
        this.elevationAxis = elevationAxis;
        this.alongAxis = alongAxis;
        this.effectRange = effectRange;
        this.effectMid = effectMid;
        this.elevationHeight = elevationHeight;
        this.intensity = 1;
        this.renderVector = this._renderVector;
      }

      _renderVector(vec, i, l) {
        let radio = vec.getRatio(this.alongAxis);
        let val = vec.getValue(this.elevationAxis);

        if (radio <= this.effectRange) {
          radio /= this.effectRange;
          let elevation = 0;

          if (radio < this.effectMid) {
            radio = radio / this.effectMid;
            elevation = Math.sqrt(1 - Math.pow(radio, 2) + radio * 2 - 1);
          } else {
            radio = (radio - this.effectMid) / (1 - this.effectMid);
            elevation = (Math.cos(radio * Math.PI) - (-1)) / 2;
          }

          vec.setValue(this.elevationAxis, val + elevation * this.elevationHeight * this.intensity);
        }
      }
    }

    // ============================================
    // FlipPage class
    // ============================================
    const flipXUV = (geo) => {
      const uvAttribute = geo.attributes.uv;
      for (let i = 0; i < uvAttribute.count; i++) {
        const u = uvAttribute.getX(i);
        const v = uvAttribute.getY(i);
        uvAttribute.setXY(i, 1 - u, v);
      }
      return geo;
    };

    const NOTEXTURE = new THREE.MeshStandardMaterial({ color: "#ffffff" });

    class FlipPage extends THREE.Mesh {
      constructor(subdivisions = 10) {
        super();

        const plane = new THREE.Mesh(
          mergeGeometries(
            [
              flipXUV(new THREE.PlaneGeometry(1, 1, subdivisions, subdivisions)),
              flipXUV(new THREE.PlaneGeometry(1, 1, subdivisions, subdivisions).rotateY(Math.PI))
            ],
            true
          ),
          [NOTEXTURE, NOTEXTURE]
        );

        plane.castShadow = true;
        plane.receiveShadow = true;
        plane.rotateX(Math.PI / 2);
        plane.position.x = 0.5;
        this.scale.z = -1;
        this.add(plane);
        this.page = plane;

        this.modifiers = new MODIFIERS.ModifierStack(plane);

        this.bend = new MODIFIERS.Bend(0, 0, 0);
        this.bend.constraint = MODIFIERS.ModConstant.LEFT;

        this.twist = new MODIFIERS.Twist(0);
        this.twist.vector = new MODIFIERS.Vector3(2, 0, 0);
        this.twist.center = new MODIFIERS.Vector3(-0.5, 0, 0);

        this.pageCurve = new PageCurve(
          MODIFIERS.ModConstant.Z,
          MODIFIERS.ModConstant.X,
          0.812,
          0.325,
          0.054
        );

        this.modifiers.addModifier(this.pageCurve);
        this.modifiers.addModifier(this.bend);
        this.modifiers.addModifier(this.twist);
      }

      setPageMaterial(newMaterial, index) {
        this.page.material[index] = newMaterial;
      }

      flip(progress, direction, pageCurveIntensity = 1) {
        this.rotation.z = Math.PI * progress;
        this.bend.force = Math.min(-Math.sin(this.rotation.z) / 2, -0.0001) * direction;
        this.twist.angle = Math.sin(this.rotation.z) / 10;
        this.pageCurve.intensity = (-1 + 2 * progress) * (-Math.sin(this.rotation.z) + 1) * pageCurveIntensity;
        this.modifiers.apply();
      }

      reset() {
        this.setPageMaterial(NOTEXTURE, 0);
        this.setPageMaterial(NOTEXTURE, 1);
      }

      dispose(materialToo = false) {
        if (materialToo) {
          if (this.page.material[0] !== NOTEXTURE) this.page.material[0].dispose();
          if (this.page.material[1] !== NOTEXTURE) this.page.material[1].dispose();
        }
        this.page.geometry.dispose();
        this.modifiers.destroy();
      }
    }

    // ============================================
    // FlipBook class
    // ============================================
    const AOTexture = (() => {
      let texture;
      return () => {
        if (!texture) {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          gradient.addColorStop(0, 'black');
          gradient.addColorStop(0.1, 'white');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          texture = new THREE.CanvasTexture(canvas);
          canvas.remove();
        }
        return texture;
      };
    })();

    // A small repeating grain adds paper relief without altering the scanned pages.
    const PaperGrain = (() => {
      let texture;
      return () => {
        if (!texture) {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 128;
          const ctx = canvas.getContext('2d');
          const image = ctx.createImageData(128, 128);
          let seed = 9037;
          for (let i = 0; i < image.data.length; i += 4) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const shade = 205 + (seed >>> 24) % 40;
            image.data[i] = image.data[i + 1] = image.data[i + 2] = shade;
            image.data[i + 3] = 255;
          }
          ctx.putImageData(image, 0, 0);
          texture = new THREE.CanvasTexture(canvas);
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(8, 10);
          texture.generateMipmaps = true;
        }
        return texture;
      };
    })();

    class FlipBook extends THREE.Mesh {
      constructor(config) {
        super();
        this.pages = [];
        this.pool = [];
        this._url2Loader = new Map();
        this._currentProgress = 0;
        this._flipDuration = config?.flipDuration || 1;
        this._ySpacing = config?.yBetweenPages || 0.001;
        this._pageSubdivisions = config?.pageSubdivisions || 20;
        this._stepSize = 0;
        this._flipDirection = 1;
        this._goalProgress = 0;
        this._currentPage = 0;
        this.currentPage = 0;
      }

      [Symbol.iterator]() {
        let index = 0;
        return {
          next: () => index < this.pages.length 
            ? { value: this.pages[index++], done: false } 
            : { value: null, done: true }
        };
      }

      setPages(pagesSources) {
        if (pagesSources.length % 2 !== 0) {
          pagesSources.push("");
        }

        while (this.pages.length) {
          const page = this.pages.pop();
          page.reset();
          this.pool.push(page);
          this.remove(page);
        }

        let prom = Promise.resolve();

        for (let i = 0; i < pagesSources.length; i += 2) {
          const urlA = pagesSources[i];
          const urlB = pagesSources[i + 1];
          let page = this.pool.pop();

          if (!page) {
            page = new FlipPage(this._pageSubdivisions);
          }

          this.add(page);
          page.position.y = -this._ySpacing * this.pages.length;
          this.pages.push(page);
          page.name = `Page#${this.pages.length}`;

          prom = prom.then(this.loadPages(urlA, urlB, page));
        }

        if (this.currentPage > this.pages.length * 2 - 1) {
          this._currentPage = this.pages.length * 2 - 1;
          this._currentProgress = this.pages.length;
        }

        this.flipPages();
      }

      get totalPages() {
        return this.pages.length * 2;
      }

      loadPages(sourceA, sourceB, page) {
        return () => Promise.all([
          this.loadPage(sourceA, 1, page),
          this.loadPage(sourceB, 0, page)
        ]);
      }

      loadPage(source, side, page) {
        if (!source || source === '') {
          const blankPage = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.6,
            roughness: 1,
            roughnessMap: PaperGrain(),
            bumpMap: PaperGrain(),
            bumpScale: 0.008,
            aoMapIntensity: 0.7,
            aoMap: side == 1 ? AOTexture() : null
          });
          page.setPageMaterial(blankPage, side);
          return Promise.resolve();
        }

        if (source instanceof THREE.Material) {
          page.setPageMaterial(source, side);
          return Promise.resolve();
        }

        if (source instanceof THREE.Texture) {
          page.setPageMaterial(this.textureToMaterial(source, side), side);
          return Promise.resolve();
        }

        const url = source;

        if (!this._url2Loader.has(url)) {
          this._url2Loader.set(url, new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(
              location.protocol === 'file:' ? window.JOURNAL_LOCAL_PAGES?.[source] || source : source,
              (texture) => resolve(this.textureToMaterial(texture, side, source === pageImages[0])),
              undefined,
              (err) => resolve(null)
            );
          }));
        }

        return this._url2Loader.get(url).then((material) => {
          page.setPageMaterial(material, side);
        });
      }

      textureToMaterial(texture, side, isFrontCover = false) {
        if (isFrontCover) {
          const source = texture.image;
          const cover = document.createElement('canvas');
          cover.width = source.naturalWidth || source.width;
          cover.height = source.naturalHeight || source.height;
          const ctx = cover.getContext('2d');
          ctx.drawImage(source, 0, 0);

          // A fixed grain pattern gives the cover a matte, printed-paper feel
          // without changing the supplied artwork or shifting every frame.
          const grain = document.createElement('canvas');
          grain.width = grain.height = 192;
          const grainCtx = grain.getContext('2d');
          let seed = 2171;
          const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
          };
          for (let y = 0; y < grain.height; y += 3) {
            for (let x = 0; x < grain.width; x += 3) {
              const shade = Math.round(82 + random() * 112);
              grainCtx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
              grainCtx.fillRect(x, y, 3, 3);
            }
          }
          ctx.globalCompositeOperation = 'soft-light';
          ctx.globalAlpha = 0.42;
          ctx.fillStyle = ctx.createPattern(grain, 'repeat');
          ctx.fillRect(0, 0, cover.width, cover.height);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          texture.dispose();
          texture = new THREE.CanvasTexture(cover);
        }
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: texture,
          emissive: isFrontCover ? 0x000000 : 0xffffff,
          emissiveMap: isFrontCover ? null : texture,
          emissiveIntensity: isFrontCover ? 0 : 0.6,
          roughness: isFrontCover ? 0.86 : 1,
          roughnessMap: isFrontCover ? null : PaperGrain(),
          bumpMap: isFrontCover ? null : PaperGrain(),
          bumpScale: isFrontCover ? 0 : 0.008,
          aoMapIntensity: 0.7,
          aoMap: side == 1 ? AOTexture() : null,
          toneMapped: false
        });
      }

      get currentPage() {
        return this._currentPage;
      }

      set currentPage(n) {
        let goal = Math.ceil(n / 2);
        let distance = goal - this._currentProgress;
        this._stepSize = distance / this._flipDuration;
        this._flipDirection = this._stepSize > 0 ? 1 : -1;
        this._currentPage = Math.ceil(n);
        this._goalProgress = goal;
        this.flipPages();
      }

      get progress() {
        return this._currentProgress;
      }

      set progress(p) {
        let oldProgress = this._currentProgress;
        this._currentProgress = Math.max(0, Math.min(p, this.pages.length));
        this._currentPage = Math.floor(this._currentProgress * 2);
        this._stepSize = 0;
        this._flipDirection = this._currentProgress > oldProgress ? 1 : -1;
        this.flipPages();
      }

      animate(delta) {
        if (this._stepSize != 0) {
          this._currentProgress += this._stepSize * delta;

          if ((this._stepSize > 0 && this._currentProgress > this._goalProgress) ||
              (this._stepSize < 0 && this._currentProgress < this._goalProgress)) {
            this._currentProgress = this._goalProgress;
            this._stepSize = 0;
          }

          this.flipPages();
        }
      }

      flipPage(page) {
        const pageIndex = this.pages.indexOf(page);
        if (pageIndex < 0) throw new ReferenceError("I don't own that page!");

        const A = pageIndex * 2;
        const B = A + 1;
        this.currentPage = this._currentPage <= A ? B : A;
      }

      nextPage() {
        this.currentPage = Math.min(Math.ceil(this.currentPage / 2) + 1, this.pages.length) * 2;
      }

      previousPage() {
        this.currentPage = Math.max(Math.ceil(this.currentPage / 2) - 1, 0) * 2;
      }

      flipPages() {
        const totalPages = this.pages.length;
        let activeProgress = this._currentProgress % 1;
        let activeIndex = Math.floor(this._currentProgress);

        for (let i = 0; i < totalPages; i++) {
          const page = this.pages[i];
          const pageProgress = activeIndex < i ? 0 : activeIndex > i ? 1 : activeProgress;
          const yProgress = pageProgress < 0.5 ? 0 : (pageProgress - 0.5) / 0.5;
          const leftPileY = -this._ySpacing * (totalPages - i);
          const rightPileY = -this._ySpacing * i;
          const pageCurveEffectIntensity = this._currentProgress < 1 ? activeProgress :
            this._currentProgress >= totalPages ? 0 :
            this._currentProgress >= totalPages - 1 ? 1 - activeProgress : 1;

          page.flip(pageProgress, this._flipDirection, pageCurveEffectIntensity);
          page.position.y = rightPileY + yProgress * (leftPileY - rightPileY);
        }

        // A closed cover spans x=0..1, so offset its center by half a page.
        const coverOffset = 0.5;
        const offset = activeIndex == 0 ? -coverOffset + coverOffset * activeProgress :
          activeIndex == totalPages - 1 ? coverOffset * activeProgress :
          activeIndex == totalPages ? coverOffset : 0;

        // At narrower desktop widths, let the full-size spread move into the
        // text column instead of clipping its far page at the window edge.
        const openAmount = Math.max(0, Math.min(1, this._currentProgress, totalPages - this._currentProgress));
        const shiftFactor = window.innerWidth <= 768 ? 0 :
          Math.max(0, Math.min(0.25, (1500 - window.innerWidth) / 1200));
        const shiftWorld = this.scale.x * shiftFactor * openAmount;
        // Center the pages inside the rotation pivot. Keep the layout shift
        // on the pivot so dragging does not make the book orbit its spine.
        this.position.x = offset * this.scale.x;
        if (this.parent) this.parent.position.x = -shiftWorld;
      }

      dispose() {
        while (this.pages.length) {
          const page = this.pages.pop();
          this.remove(page);
        }
        while (this.pool.length) {
          this.pool.pop().dispose(true);
        }
        this._url2Loader.forEach(m => m.then(mat => mat?.dispose()));
        this._url2Loader.clear();
      }
    }

    // ============================================
    // Scene Setup (matching demo's main.js)
    // ============================================
    const container = document.getElementById('book-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;

    // Lighting (matching demo)
    const light = new THREE.DirectionalLight(0xffffff, 0.45);
    light.position.set(0.2, 1, 0);
    light.castShadow = true;
    light.shadow.mapSize.width = 512 * 4;
    light.shadow.mapSize.height = 512 * 4;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 3;
    light.shadow.bias = -0.003;
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Camera (zoomed out for smaller book)
    const MAXFOV = 32;
    const camera = new THREE.PerspectiveCamera(0, width / height, 0.1, 1000);
    camera.setFocalLength(MAXFOV);
    camera.position.set(0, 4, 1.2);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);

    // FlipBook
    const book = new FlipBook({
      flipDuration: 0.5,
      yBetweenPages: 0.001,
      pageSubdivisions: 20
    });

    book.scale.x = 0.8;
    const bookPivot = new THREE.Group();
    bookPivot.add(book);
    scene.add(bookPivot);

    book.setPages(pageImages);

    // Clock for animation
    const clock = new THREE.Clock();

    // ============================================
    // Page Flip Sound
    // ============================================
    const flipSound = new Audio('vendor/3dflipbook/sounds/start-flip.mp3');
    flipSound.volume = 0.4;
    
    function playFlipSound() {
      flipSound.currentTime = 0;
      flipSound.play().catch(() => {}); // Catch autoplay restrictions
    }

    // Levitation animation
    let levitationTime = 0;
    const LEVITATION_HEIGHT = 0.04;
    const LEVITATION_TILT = 0.015;
    
    // Random seeds for organic movement
    const randomSeed1 = Math.random() * 100;
    const randomSeed2 = Math.random() * 100;
    const randomSeed3 = Math.random() * 100;

    // ============================================
    // Interactive Rotation Controls
    // ============================================
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartTime = 0;
    let totalDragDistance = 0;
    
    // User-controlled rotation (persists)
    let userRotationX = isMobile() ? 0 : 0.35;
    let userRotationY = isMobile() ? 0 : 0.04;
    let idleVerticalTurn = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const IDLE_SPIN_SPEED = (Math.PI * 2) / 60; // One slow 3D turn per minute.
    let idleSpinActive = !reducedMotion;
    let lastInteractionTime = performance.now();

    function stopIdleSpin() {
      lastInteractionTime = performance.now();
      if (!idleSpinActive) return;
      // Return to the nearest face-on angle when someone starts interacting.
      idleVerticalTurn = Math.atan2(Math.sin(idleVerticalTurn), Math.cos(idleVerticalTurn));
      idleSpinActive = false;
    }
    
    // Velocity for inertia
    let velocityX = 0;
    let velocityY = 0;
    
    // Previous positions for velocity calculation
    let prevDragX = 0;
    let prevDragY = 0;
    
    const DRAG_SENSITIVITY = 0.0045;
    const INERTIA_FRICTION = 0.82;
    const INERTIA_THRESHOLD = 0.0001;
    const CLICK_THRESHOLD = isMobile() ? 30 : 15; // pixels - max movement for a click (more forgiving on mobile)
    const CLICK_TIME_THRESHOLD = 400; // ms - max time for a click
    
    // Rotation limits
    const MAX_ROTATION_X = Math.PI / 2.5; // How much you can tilt up/down
    const MIN_ROTATION_X = -0.2;

    // ============================================
    // Pinch-to-Zoom (Mobile)
    // ============================================
    let currentZoom = 1; // 1 = default, higher = zoomed in
    const MIN_ZOOM = 0.6;
    const MAX_ZOOM = 2.5;
    
    // Pinch-to-zoom state
    let isPinching = false;
    let initialPinchDistance = 0;
    let initialPinchZoom = 1;

    function getDistance(touch1, touch2) {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    function applyZoom() {
      if (!isMobile()) return;
      // The mobile canvas extends beyond the layout section, so preserve the
      // book's on-screen size while giving rotations room to render there.
      const sectionHeight = container.parentElement.clientHeight;
      camera.filmGauge = 35 * Math.pow(container.clientHeight / sectionHeight, 0.72);
      
      // Pull the camera back far enough that the tilted open book
      // stays inside the shorter mobile canvas (header + controls).
      // Wider / farther than the old mobile camera so the tilted open
      // spread stays inside the canvas, including the bottom corners.
      const baseFocal = 39;
      const baseCamY = 2.7;
      const baseCamZ = 0.92;
      
      // Apply zoom by adjusting focal length (higher = more zoomed in)
      const zoomedFocal = baseFocal * currentZoom;
      camera.setFocalLength(zoomedFocal);
      camera.position.set(0, baseCamY / currentZoom, baseCamZ / currentZoom);
      camera.lookAt(0, 0.02, 0);
      camera.updateProjectionMatrix();
    }

    // ============================================
    // Responsive Camera Adjustment
    // ============================================
    function isMobile() {
      return window.innerWidth <= 768;
    }

    function mobileBookScale() {
      const openAmount = Math.max(0, Math.min(1, book.progress, book.pages.length - book.progress));
      return 1.16 - 0.12 * openAmount;
    }

    function setMobileBookScale() {
      const scale = mobileBookScale();
      book.scale.set(scale * 0.92, scale, scale * 1.1);
    }
    
    function adjustBookFraming() {
      if (isMobile()) {
        // Keep the journal prominent with a slightly narrower page proportion.
        setMobileBookScale();
      } else {
        const bookSection = container.parentElement;
        const height = bookSection.clientHeight;
        const width = bookSection.clientWidth;
        // Keep one size for the cover and every open page. The wider drawing
        // canvas lets the spread extend over the text column when needed.
        const fit = Math.min(
          1.1,
          (height / 720) ** 2,
          1600 / height,
          width / 680
        );
        book.scale.set(1.38 * fit, 1.75 * fit, 1.75 * fit);
      }
    }

    function adjustCameraForDevice() {
      // Frame the book against its layout column, not the wider drawing canvas.
      const bookSection = container.parentElement;
      const sectionWidth = bookSection.clientWidth;
      const sectionHeight = bookSection.clientHeight;
      
      adjustBookFraming();
      
      if (isMobile()) {
        // Mobile: apply current zoom level
        applyZoom();
        book.flipPages();
        return; // applyZoom handles everything for mobile
      } else {
        // Reset zoom when switching to desktop
        currentZoom = 1;
        // A wider transparent canvas prevents page clipping. Preserve the
        // original vertical field of view so widening it cannot zoom the book.
        camera.filmGauge = 35 * Math.max(camera.aspect, 1) /
          Math.max(sectionWidth / sectionHeight, 1);
        // Desktop - use WINDOW width for viewport check
        const viewportWidth = window.innerWidth;
        
        // Maximum size settings (for viewport >= 1000px) - 15% bigger
        const MAX_FOCAL = 39;
        const MAX_CAM_Y = 3.4;
        const MAX_CAM_Z = 1.02;
        
        // Minimum size settings (for viewport ~769px, just above mobile) - 15% bigger
        const MIN_FOCAL = 30;
        const MIN_CAM_Y = 4.1;
        const MIN_CAM_Z = 1.2;
        
        // Viewport >= 1000px: keep at max size (no scaling)
        if (viewportWidth >= 1000) {
          camera.setFocalLength(MAX_FOCAL);
          camera.position.set(0, MAX_CAM_Y, MAX_CAM_Z);
        } else {
          // Viewport < 1000px: scale smoothly from max to min
          // Linear interpolation from 1000px down to 769px (mobile breakpoint)
          const minViewport = 769;
          const maxViewport = 1000;
          const t = Math.max(0, Math.min(1, (viewportWidth - minViewport) / (maxViewport - minViewport)));
          
          // Interpolate focal length and camera position
          const focal = MIN_FOCAL + t * (MAX_FOCAL - MIN_FOCAL);
          const camY = MIN_CAM_Y + t * (MAX_CAM_Y - MIN_CAM_Y);
          const camZ = MIN_CAM_Z + t * (MAX_CAM_Z - MIN_CAM_Z);
          
          camera.setFocalLength(focal);
          camera.position.set(0, camY, camZ);
        }
      }
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      // Recenter the cover and align the controls using the current camera.
      book.flipPages();
    }

    // ============================================
    // Event Handlers
    // ============================================
    function onWindowResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      adjustCameraForDevice();
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    function tryFlipPage(clientX, clientY) {
      stopIdleSpin();
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length) {
        // Find the FlipPage parent
        let obj = intersects[0].object;
        while (obj && !(obj instanceof FlipPage)) {
          obj = obj.parent;
        }
        if (obj && obj instanceof FlipPage) {
          book.flipPage(obj);
          playFlipSound();
          updatePageIndicator();
          return true;
        }
      }
      
      // Mobile fallback: if raycast missed but tap was on book area, flip based on screen position
      if (isMobile() && book.pages.length > 0) {
        // Calculate normalized X position within canvas
        const normalizedX = (clientX - rect.left) / rect.width;
        
        // Flip forward if tapped on right side, backward if left side
        if (normalizedX > 0.5 && book.currentPage < book.totalPages) {
          book.nextPage();
          playFlipSound();
          updatePageIndicator();
          return true;
        } else if (normalizedX <= 0.5 && book.currentPage > 0) {
          book.previousPage();
          playFlipSound();
          updatePageIndicator();
          return true;
        }
      }
      
      return false;
    }

    // ============================================
    // Mouse Drag Controls
    // ============================================
    function onMouseDown(event) {
      stopIdleSpin();
      isDragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      prevDragX = event.clientX;
      prevDragY = event.clientY;
      dragStartTime = Date.now();
      totalDragDistance = 0;
      velocityX = 0;
      velocityY = 0;
      renderer.domElement.style.cursor = 'grabbing';
    }

    function onMouseMove(event) {
      if (!isDragging) return;
      
      const deltaX = event.clientX - prevDragX;
      const deltaY = event.clientY - prevDragY;
      
      // Update total drag distance for click detection
      totalDragDistance += Math.abs(deltaX) + Math.abs(deltaY);
      
      // Update rotation based on drag
      userRotationY += deltaX * DRAG_SENSITIVITY;
      userRotationX += deltaY * DRAG_SENSITIVITY;
      
      // Clamp X rotation
      userRotationX = Math.max(MIN_ROTATION_X, Math.min(MAX_ROTATION_X, userRotationX));
      
      // Calculate velocity for inertia
      velocityX = deltaY * DRAG_SENSITIVITY;
      velocityY = deltaX * DRAG_SENSITIVITY;
      
      prevDragX = event.clientX;
      prevDragY = event.clientY;
    }

    function onMouseUp(event) {
      if (!isDragging) return;
      isDragging = false;
      velocityX *= 0.12;
      velocityY *= 0.12;
      renderer.domElement.style.cursor = 'grab';
      // Page flipping is now handled by the click event listener
    }

    // ============================================
    // Touch Controls for Mobile
    // ============================================
    function onTouchStart(event) {
      stopIdleSpin();
      // Two-finger touch: start pinch-to-zoom
      if (event.touches.length === 2) {
        event.preventDefault();
        isPinching = true;
        isDragging = false;
        initialPinchDistance = getDistance(event.touches[0], event.touches[1]);
        initialPinchZoom = currentZoom;
        return;
      }
      
      // Single finger touch: rotation/drag
      if (event.touches.length === 1 && !isPinching) {
        // Prevent default touch behavior on the canvas for better control
        event.preventDefault();
        
        const touch = event.touches[0];
        isDragging = true;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        prevDragX = touch.clientX;
        prevDragY = touch.clientY;
        dragStartTime = Date.now();
        totalDragDistance = 0;
        velocityX = 0;
        velocityY = 0;
      }
    }

    function onTouchMove(event) {
      // Two-finger move: pinch-to-zoom
      if (event.touches.length === 2 && isPinching) {
        event.preventDefault();
        
        const currentDistance = getDistance(event.touches[0], event.touches[1]);
        const scale = currentDistance / initialPinchDistance;
        
        // Apply zoom based on pinch scale
        currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialPinchZoom * scale));
        applyZoom();
        return;
      }
      
      // Single finger move: rotation
      if (!isDragging || event.touches.length !== 1 || isPinching) return;
      
      event.preventDefault(); // Prevent scrolling while rotating
      
      const touch = event.touches[0];
      const deltaX = touch.clientX - prevDragX;
      const deltaY = touch.clientY - prevDragY;
      
      // Update total drag distance for click detection
      totalDragDistance += Math.abs(deltaX) + Math.abs(deltaY);
      
      // Update rotation based on drag
      userRotationY += deltaX * DRAG_SENSITIVITY;
      userRotationX += deltaY * DRAG_SENSITIVITY;
      
      // Clamp X rotation
      userRotationX = Math.max(MIN_ROTATION_X, Math.min(MAX_ROTATION_X, userRotationX));
      
      // Calculate velocity for inertia
      velocityX = deltaY * DRAG_SENSITIVITY;
      velocityY = deltaX * DRAG_SENSITIVITY;
      
      prevDragX = touch.clientX;
      prevDragY = touch.clientY;
    }

    function onTouchEnd(event) {
      // End pinch-to-zoom
      if (isPinching) {
        if (event.touches.length < 2) {
          isPinching = false;
        }
        return;
      }
      
      if (!isDragging) return;
      
      const dragDuration = Date.now() - dragStartTime;
      const wasClick = totalDragDistance < CLICK_THRESHOLD && dragDuration < CLICK_TIME_THRESHOLD;
      
      isDragging = false;
      velocityX *= 0.12;
      velocityY *= 0.12;
      
      // If it was a tap (not a drag), try to flip page using the ORIGINAL touch position
      if (wasClick) {
        // Prevent default to ensure our tap handler works on iOS
        event.preventDefault();
        event.stopPropagation();
        
        // Small delay to ensure raycasting works after touch release on iOS Safari
        requestAnimationFrame(() => {
          tryFlipPage(dragStartX, dragStartY);
        });
      }
    }

    function updatePageIndicator() {
      const currentPageNum = book.currentPage + 1;
      document.getElementById('current-page').textContent = Math.min(currentPageNum, book.totalPages);
      document.getElementById('total-pages').textContent = book.totalPages;

      document.getElementById('btn-prev').disabled = book.currentPage === 0;
      document.getElementById('btn-next').disabled = book.currentPage >= book.totalPages;
    }

    // ============================================
    // Button Controls
    // ============================================
    document.getElementById('btn-prev').addEventListener('click', () => {
      stopIdleSpin();
      if (book.currentPage > 0) {
        book.previousPage();
        playFlipSound();
        updatePageIndicator();
      }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      stopIdleSpin();
      if (book.currentPage < book.totalPages) {
        book.nextPage();
        playFlipSound();
        updatePageIndicator();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        stopIdleSpin();
        if (book.currentPage < book.totalPages) {
          book.nextPage();
          playFlipSound();
          updatePageIndicator();
        }
      } else if (e.key === 'ArrowLeft') {
        stopIdleSpin();
        if (book.currentPage > 0) {
          book.previousPage();
          playFlipSound();
          updatePageIndicator();
        }
      }
    });

    // ============================================
    // Event Listeners
    // ============================================
    window.addEventListener('resize', onWindowResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onWindowResize);
    }
    
    // Track if last interaction was a drag (to prevent click from firing after drag)
    let wasDragged = false;
    
    // Mouse events for rotation
    renderer.domElement.addEventListener('mousedown', (event) => {
      onMouseDown(event);
      wasDragged = false;
    });
    window.addEventListener('mousemove', (event) => {
      onMouseMove(event);
      if (isDragging && totalDragDistance > CLICK_THRESHOLD) wasDragged = true;
    });
    window.addEventListener('mouseup', onMouseUp);
    
    // Click handler for page flipping
    renderer.domElement.addEventListener('click', (event) => {
      // Only flip page if it wasn't a drag
      if (!wasDragged) {
        tryFlipPage(event.clientX, event.clientY);
      }
      wasDragged = false;
    });
    
    // Touch events - all non-passive to ensure proper handling on iOS Safari
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
    renderer.domElement.addEventListener('touchcancel', onTouchEnd, { passive: false });
    
    // Set initial cursor
    renderer.domElement.style.cursor = 'grab';

    // ============================================
    // Animation Loop
    // ============================================
    const spotlight = document.querySelector('.journal-spotlight');
    function animate() {
      requestAnimationFrame(animate);
      
      const delta = clock.getDelta();
      book.animate(delta);
      if (isMobile()) {
        const scale = mobileBookScale();
        if (Math.abs(book.scale.x - scale * 0.92) > 0.0001) {
          setMobileBookScale();
          book.flipPages();
        }
      }
      spotlight.classList.toggle('is-on', book.progress >= 1 && book.progress <= book.pages.length - 1);
      if (!reducedMotion && !idleSpinActive && !isDragging && !isPinching &&
          book.progress <= 0.01 && performance.now() - lastInteractionTime > 3000 &&
          Math.abs(velocityX) < INERTIA_THRESHOLD && Math.abs(velocityY) < INERTIA_THRESHOLD) {
        idleSpinActive = true;
      }
      if (idleSpinActive && book.progress <= 0.01) {
        idleVerticalTurn += Math.min(delta, 0.05) * IDLE_SPIN_SPEED;
      } else if (!idleSpinActive && idleVerticalTurn !== 0) {
        idleVerticalTurn *= Math.exp(-Math.min(delta, 0.05) * 5);
        if (Math.abs(idleVerticalTurn) < 0.001) idleVerticalTurn = 0;
      }
      
      // Update time
      levitationTime += delta;
      
      // Apply inertia when not dragging
      if (!isDragging) {
        if (Math.abs(velocityX) > INERTIA_THRESHOLD || Math.abs(velocityY) > INERTIA_THRESHOLD) {
          userRotationX += velocityX;
          userRotationY += velocityY;
          
          // Clamp X rotation
          userRotationX = Math.max(MIN_ROTATION_X, Math.min(MAX_ROTATION_X, userRotationX));
          
          // Apply friction
          velocityX *= INERTIA_FRICTION;
          velocityY *= INERTIA_FRICTION;
        }
      }
      
      // Subtle organic levitation (reduced when user is interacting)
      const interactionDamping = isDragging ? 0.3 : 1;
      const floatY = 
        Math.sin(levitationTime * 1.2 + randomSeed1) * LEVITATION_HEIGHT * 0.6 * interactionDamping +
        Math.sin(levitationTime * 0.7 + randomSeed2) * LEVITATION_HEIGHT * 0.3 * interactionDamping +
        Math.sin(levitationTime * 2.1 + randomSeed3) * LEVITATION_HEIGHT * 0.1 * interactionDamping;
      
      // Very subtle organic tilt variations (reduced for user control)
      const baseTiltZ = Math.cos(levitationTime * 0.6 + randomSeed2) * LEVITATION_TILT * 0.5 * interactionDamping;
      
      // The pages lie in the XZ plane, so world Z is the journal's visible
      // vertical axis. Turn the centered pivot rather than orbiting its spine.
      bookPivot.position.y = floatY;
      bookPivot.rotation.x = userRotationX;
      bookPivot.rotation.y = userRotationY;
      bookPivot.rotation.z = idleVerticalTurn + (isMobile() ? 0 : -0.025 + baseTiltZ);
      
      renderer.render(scene, camera);
    }

    // ============================================
    // Initialize
    // ============================================
    adjustCameraForDevice();
    onWindowResize();
    updatePageIndicator();
    requestAnimationFrame(onWindowResize);
    window.addEventListener('load', onWindowResize);

    // Hide loading overlay
    setTimeout(() => {
      document.getElementById('loading').classList.add('hidden');
      
      const overlay = document.querySelector('.page-transition-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      }
    }, 500);

    animate();
