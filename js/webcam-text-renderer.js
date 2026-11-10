/**
 * WebcamTextRenderer - Native webcam text silhouette renderer
 * Replaces the WORD SILHOUETTE.html iframe implementation
 */
export class WebcamTextRenderer {
  constructor(width = 640, height = 480) {
    // Canvas setup
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    
    // Video element for webcam
    this.video = document.createElement('video');
    this.video.width = width;
    this.video.height = height;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true; // Required for iOS Safari autoplay
    this.video.setAttribute('playsinline', ''); // iOS Safari
    this.video.setAttribute('webkit-playsinline', ''); // Older iOS Safari
    this.video.setAttribute('muted', '');
    
    // Camera state
    this.currentStream = null;
    this.currentCameraId = null;
    this.cameras = [];
    this.isInitialized = false;
    
    // Safari detection (includes both iOS and macOS Safari)
    this.isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Chromium');
    this.isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (this.isSafari && 'ontouchend' in document);
    this.isDesktopSafari = this.isSafari && !this.isIOSSafari;
    this.lastVideoTime = 0;
    this.videoKeepAliveInterval = null;
    
    // Safari frame caching - keep last good frame when video stalls (for both desktop and mobile)
    this.lastGoodImageData = null;
    this.lastFrameTime = 0;
    this.videoHasEverWorked = false;
    
    console.log('🔍 WebcamTextRenderer Safari detection:', { isSafari: this.isSafari, isIOSSafari: this.isIOSSafari, isDesktopSafari: this.isDesktopSafari });
    
    // Word definitions match the original WORD SILHOUETTE composition.
    this.words = [
      { text: "YOU ARE", color: "#FF0000", font: "monospace", size: 18 },
      { text: "YOU ARE", color: "#FF0000", font: "monospace", size: 18 },
      { text: "YOU ARE", color: "#FF0000", font: "monospace", size: 18 },
      { text: "YOUR CHOICES", color: "#FFFF00", font: "serif", size: 22 },
      { text: "PUBLIC SELF", color: "#0000FF", font: "monospace", size: 10 },
      { text: "PRESENT", color: "#00FF00", font: "monospace", size: 10 }
    ];
    
    // Text grid
    this.textGrid = [];
    this.textColumns = 0;
    this.textRows = 0;
    
    // Contour detection
    this.edgePixels = [];
    this.lastTextFrame = [];
    this.wordLayoutCache = new Map();
    
    // Settings (matching WORD SILHOUETTE defaults)
    this.settings = {
      // Image controls
      invertColors: false,
      flipVideo: false,
      portraitMode: false,
      threshold: 95,
      cellWidthMultiplier: 0.7,
      
      // Contour controls
      showContour: false,
      pixelSize: 1,
      contourSensitivity: 4,
      contourDensity: 2,
      contourColor: "#FFFFFF",
      
      // Text settings
      fontSize: 10,
      textDensity: 1.15,
      
      // Animation controls
      enableAnimation: false,
      animationType: 'wave',
      animationSpeed: 5,
      animationAmount: 10,
      
      // Glitch controls
      enableGlitch: false,
      glitchType: 'digitaldropout',
      glitchIntensity: 20,
      glitchSpeed: 2
    };
    
    // Glitch state
    this.glitchLastUpdate = 0;
    this.glitchRandomValues = [];
    
    // Display area (for aspect ratio handling)
    this.displayX = 0;
    this.displayY = 0;
    this.displayWidth = width;
    this.displayHeight = height;
    
    // Frame tracking
    this.frameCount = 0;
    
    console.log('✅ WebcamTextRenderer created', width, 'x', height);
    console.log('📝 Words:', this.words.map(w => `${w.text}:${w.color}`));
  }
  
  /**
   * Initialize webcam and camera enumeration
   */
  async init() {
    try {
      console.log('🎥 Initializing webcam...');
      
      // Enumerate cameras first
      await this.enumerateCameras();
      
      // Start with first camera (or default)
      const deviceId = this.cameras.length > 0 ? this.cameras[0].deviceId : null;
      const success = await this.switchCamera(deviceId);
      
      // Initialize grid
      this.updateGridDimensions();
      this.initializeGrid();
      
      // Only set initialized if camera actually worked
      this.isInitialized = success;
      
      if (success) {
        console.log('✅ Webcam initialized');
      } else {
        console.warn('⚠️ Webcam initialized but camera failed');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to initialize webcam:', error);
      this.isInitialized = false;
      this.drawErrorMessage('Camera access denied or unavailable');
      return false;
    }
  }
  
  /**
   * Enumerate available cameras
   */
  async enumerateCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameras = devices.filter(device => device.kind === 'videoinput');
      console.log(`📹 Found ${this.cameras.length} cameras`);
      return this.cameras;
    } catch (error) {
      console.error('Failed to enumerate cameras:', error);
      return [];
    }
  }
  
  /**
   * Switch to a different camera
   */
  async switchCamera(deviceId) {
    try {
      // Stop current stream and cleanup
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
      }
      
      // Clear any existing keep-alive interval
      if (this.videoKeepAliveInterval) {
        clearInterval(this.videoKeepAliveInterval);
        this.videoKeepAliveInterval = null;
      }
      
      // Get new stream with iOS-optimized constraints
      const videoConstraints = deviceId 
        ? { deviceId: { exact: deviceId } } 
        : { facingMode: 'user' }; // Prefer front camera on mobile
      
      // For Safari, optimize constraints for better performance
      if (this.isSafari) {
        // Use lower resolution on mobile Safari for better performance
        if (this.isIOSSafari) {
          videoConstraints.width = { ideal: 480 };
          videoConstraints.height = { ideal: 360 };
        }
        // Request specific frame rate for Safari (helps with frame sync)
        videoConstraints.frameRate = { ideal: 30, max: 30 };
      }
      
      const constraints = {
        video: videoConstraints,
        audio: false
      };
      
      console.log('📷 Requesting camera with constraints:', JSON.stringify(constraints));
      
      this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.currentStream;
      this.currentCameraId = deviceId;
      
      // Ensure Safari mobile attributes are set
      this.video.muted = true;
      this.video.playsInline = true;
      
      // Wait for video to be ready
      await new Promise(resolve => {
        this.video.onloadedmetadata = () => {
          this.video.play().catch(() => {});
          resolve();
        };
      });
      
      // Setup Safari keep-alive workaround (for both desktop and mobile Safari)
      if (this.isSafari) {
        this.setupSafariKeepAlive();
      }
      
      console.log('✅ Camera switched:', deviceId || 'default');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to switch camera:', error.name, error.message);
      this.isInitialized = false;
      this.drawErrorMessage('Camera access denied. Please allow camera access and refresh.');
      return false;
    }
  }
  
  /**
   * Setup Safari mobile video keep-alive mechanism
   */
  setupSafariKeepAlive() {
    console.log('🍎 Setting up iOS Safari video keep-alive...');
    
    let stalledFrameCount = 0;
    
    // More aggressive keep-alive interval (100ms instead of 500ms)
    this.videoKeepAliveInterval = setInterval(() => {
      if (!this.video) return;
      
      // Always try to play if paused
      if (this.video.paused) {
        console.log('🔄 Video paused, resuming...');
        this.video.play().catch(() => {});
      }
      
      // Check for stalled video (same currentTime for multiple checks)
      if (this.video.currentTime === this.lastVideoTime && this.currentStream) {
        stalledFrameCount++;
        
        // If stalled for 3+ checks (300ms), try to recover
        if (stalledFrameCount >= 3) {
          console.log('⚠️ Video stalled, attempting recovery...');
          const tracks = this.currentStream.getVideoTracks();
          if (tracks.length > 0 && tracks[0].enabled) {
            // Toggle track to force refresh on Safari
            tracks[0].enabled = false;
            setTimeout(() => {
              if (tracks[0]) tracks[0].enabled = true;
            }, 50);
          }
          
          // Also try reloading the video source
          if (stalledFrameCount >= 10) {
            console.log('🔁 Deep recovery - resetting video source...');
            const stream = this.video.srcObject;
            this.video.srcObject = null;
            setTimeout(() => {
              this.video.srcObject = stream;
              this.video.play().catch(() => {});
            }, 100);
            stalledFrameCount = 0;
          }
        }
      } else {
        stalledFrameCount = 0;
      }
      
      this.lastVideoTime = this.video.currentTime;
    }, 100); // Check every 100ms for faster recovery
    
    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.video) {
        console.log('👁️ Page visible, resuming video...');
        setTimeout(() => {
          if (this.video.paused) {
            this.video.play().catch(() => {});
          }
        }, 100);
      }
    });
    
    // Handle touch events to keep video alive (iOS Safari quirk)
    document.addEventListener('touchstart', () => {
      if (this.video && this.video.paused) {
        this.video.play().catch(() => {});
      }
    }, { passive: true });
    
    // Handle video stall events
    this.video.addEventListener('stalled', () => {
      console.log('📹 Video stalled event');
      this.video.play().catch(() => {});
    });
    
    this.video.addEventListener('suspend', () => {
      console.log('📹 Video suspend event');
      setTimeout(() => {
        if (this.video && this.video.paused) {
          this.video.play().catch(() => {});
        }
      }, 100);
    });
    
    this.video.addEventListener('waiting', () => {
      console.log('📹 Video waiting for data...');
    });
    
    // Log when video actually plays
    this.video.addEventListener('playing', () => {
      console.log('✅ Video playing');
    });
  }
  
  /**
   * Calculate grid dimensions based on settings
   */
  updateGridDimensions() {
    const metrics = this.words.map((word) => this.getWordLayoutMetrics(word));
    const narrowestSlot = metrics.length ? Math.min(...metrics.map((item) => item.slotWidth)) : 40;
    const tallestSlot = metrics.length ? Math.max(...metrics.map((item) => item.slotHeight)) : 20;

    // Add a spare column and row because words have different measured widths.
    this.textColumns = Math.max(1, Math.ceil(this.displayWidth / narrowestSlot) + 1);
    this.textRows = Math.max(1, Math.ceil(this.displayHeight / tallestSlot) + 1);

    console.log(`📐 Collision-safe grid: ${this.textColumns}cols x ${this.textRows}rows`);
  }

  /**
   * Reserve enough room for a word's largest possible animated bounds.
   * Independent phrases can then move without entering a neighbor's slot.
   */
  getWordLayoutMetrics(word) {
    const cacheKey = [
      word.text,
      word.font,
      word.size,
      this.settings.enableAnimation,
      this.settings.animationType,
      this.settings.animationAmount,
      this.settings.cellWidthMultiplier,
      this.settings.textDensity
    ].join('|');
    const cached = this.wordLayoutCache.get(cacheKey);
    if (cached) return cached;

    this.ctx.save();
    this.ctx.font = `${word.size}px ${word.font}`;
    const measurement = this.ctx.measureText(word.text);
    this.ctx.restore();

    const baseWidth = Math.max(1, measurement.width);
    const measuredHeight = (measurement.actualBoundingBoxAscent || 0) + (measurement.actualBoundingBoxDescent || 0);
    const baseHeight = Math.max(word.size * 1.2, measuredHeight);
    const animationEnabled = this.settings.enableAnimation;
    const amount = animationEnabled ? this.settings.animationAmount : 0;
    const maxScale = animationEnabled && this.settings.animationType === 'pulse' ? 1 + amount * 0.012 : 1;
    const maxRotation = animationEnabled && this.settings.animationType === 'rotate' ? amount * 0.012 : 0;
    const verticalTravel = animationEnabled && ['wave', 'bounce'].includes(this.settings.animationType) ? amount : 0;
    const widestAngle = Math.min(maxRotation, Math.atan2(baseHeight, baseWidth));
    const tallestAngle = Math.min(maxRotation, Math.atan2(baseWidth, baseHeight));
    const rotatedWidth = maxScale * (baseWidth * Math.cos(widestAngle) + baseHeight * Math.sin(widestAngle));
    const rotatedHeight = maxScale * (baseWidth * Math.sin(tallestAngle) + baseHeight * Math.cos(tallestAngle));
    const horizontalGap = Math.max(4, 10 * this.settings.cellWidthMultiplier / this.settings.textDensity);
    const verticalGap = Math.max(4, 8 / this.settings.textDensity);

    const metrics = {
      baseWidth,
      baseHeight,
      slotWidth: Math.ceil(rotatedWidth + horizontalGap),
      slotHeight: Math.ceil(rotatedHeight + verticalTravel * 2 + verticalGap)
    };
    this.wordLayoutCache.set(cacheKey, metrics);
    return metrics;
  }

  /**
   * Resize the actual render surface so previews and exports share dimensions.
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.video.width = width;
    this.video.height = height;
    this.displayX = 0;
    this.displayY = 0;
    this.displayWidth = width;
    this.displayHeight = height;
    this.lastGoodImageData = null;
    this.lastTextFrame = [];
    this.updateGridDimensions();
    this.initializeGrid();
    this.drawPlaceholder();
  }
  
  /**
   * Initialize the text grid with random words
   */
  initializeGrid() {
    this.textGrid = [];
    if (this.words.length === 0) return;

    for (let y = 0; y < this.textRows; y++) {
      const row = [];
      for (let x = 0; x < this.textColumns; x++) {
        row.push(Math.floor(Math.random() * this.words.length));
      }
      this.textGrid.push(row);
    }
  }
  
  /**
   * Draw an error message on the canvas
   */
  drawErrorMessage(message) {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = '16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
  }
  
  /**
   * Main render method - called every frame
   */
  render() {
    // Safari (both desktop and mobile): always try to keep video playing
    if (this.isSafari && this.video) {
      if (this.video.paused || this.video.ended) {
        this.video.play().catch(() => {});
      }
    }
    
    // Check if video has any data at all (less strict for Safari)
    const hasVideoElement = this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0;
    const videoReady = hasVideoElement && this.video.readyState >= 1; // HAVE_METADATA or better
    
    // For Safari, also accept if we've ever had a good frame (prevents choppy rendering)
    const canRender = videoReady || (this.isSafari && this.videoHasEverWorked && this.lastGoodImageData);
    
    if (!canRender) {
      this.drawPlaceholder();
      return;
    }
    
    try {
      let imageData;
      
      // Check if we have a new video frame (iOS Safari optimization)
      const currentVideoTime = this.video.currentTime;
      const hasNewFrame = currentVideoTime !== this.lastFrameTime && videoReady;
      
      if (hasNewFrame || !this.isSafari) {
        // Clear canvas and draw new video frame
        this.ctx.fillStyle = this.settings.invertColors ? '#FFFFFF' : '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw a centered cover crop so portrait modes do not stretch the feed.
        this.drawVideoCover();
        
        // Get pixel data
        imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Cache this good frame for Safari (in case video stalls) - both desktop and mobile
        if (this.isSafari) {
          this.lastGoodImageData = imageData;
          this.lastFrameTime = currentVideoTime;
          this.videoHasEverWorked = true;
        }
      } else if (this.isSafari && this.lastGoodImageData) {
        // Safari: video stalled, use cached frame for smooth rendering
        imageData = this.lastGoodImageData;
      } else {
        this.drawPlaceholder();
        return;
      }
      
      // Clear for text rendering
      this.ctx.fillStyle = this.settings.invertColors ? '#FFFFFF' : '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Detect contour if enabled
      if (this.settings.showContour) {
        this.detectSilhouetteContour(imageData);
        this.drawContour();
      }
      
      // Draw text grid
      this.drawTextGrid(imageData);
      
      // Apply glitch effects if enabled
      if (this.settings.enableGlitch) {
        this.applyGlitchEffect();
      }
      
      this.frameCount++;
    } catch (error) {
      console.error('Render error:', error);
      this.drawPlaceholder();
    }
  }

  drawVideoCover() {
    const sourceWidth = this.video.videoWidth || this.canvas.width;
    const sourceHeight = this.video.videoHeight || this.canvas.height;
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = this.canvas.width / this.canvas.height;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio;
      sx = (sourceWidth - sw) / 2;
    } else if (sourceRatio < targetRatio) {
      sh = sourceWidth / targetRatio;
      sy = (sourceHeight - sh) / 2;
    }

    this.ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, this.canvas.width, this.canvas.height);
  }
  
  /**
   * Draw placeholder animation with test colors
   */
  drawPlaceholder() {
    if (this.frameCount % 30 === 0) {
      console.log('🖼️ Drawing placeholder frame', this.frameCount);
    }
    
    const time = Date.now() * 0.001;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
    
    // Simple test: Draw 4 colored squares to verify rendering works
    this.ctx.save();
    
    // Yellow square
    this.ctx.fillStyle = '#FFFF00';
    this.ctx.fillRect(50, 50, 100, 100);
    
    // Red square
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(w - 150, 50, 100, 100);
    
    // Green square
    this.ctx.fillStyle = '#00FF00';
    this.ctx.fillRect(50, h - 150, 100, 100);
    
    // Blue square
    this.ctx.fillStyle = '#0000FF';
    this.ctx.fillRect(w - 150, h - 150, 100, 100);
    
    // Draw text with colors
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    this.ctx.fillStyle = '#FFFF00';
    this.ctx.font = '24px monospace';
    this.ctx.fillText('YOU ARE', 100, 100);
    
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = '24px serif';
    this.ctx.fillText('YOUR CHOICES', w - 100, 100);
    
    this.ctx.fillStyle = '#00FF00';
    this.ctx.font = '20px monospace';
    this.ctx.fillText('PUBLIC SELF', 100, h - 100);
    
    this.ctx.fillStyle = '#0000FF';
    this.ctx.font = '20px monospace';
    this.ctx.fillText('PRESENT', w - 100, h - 100);
    
    // Center message
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '16px monospace';
    this.ctx.fillText('Allow camera access to see live feed', w / 2, h / 2);
    
    this.ctx.restore();
    
    this.frameCount++;
  }
  
  /**
   * Draw text grid based on brightness - WITH CORRECT COLORS
   */
  drawTextGrid(imageData) {
    const pixels = imageData.data;
    let currentY = this.displayY;
    this.lastTextFrame = [];
    
    for (let y = 0; y < this.textGrid.length; y++) {
      if (currentY > this.displayY + this.displayHeight) break;
      
      let currentX = this.displayX;
      let rowHeight = 1;
      
      for (let x = 0; x < this.textGrid[y].length; x++) {
        const wordIndex = this.textGrid[y][x];
        if (wordIndex >= this.words.length) continue;

        rowHeight = Math.max(rowHeight, this.getWordLayoutMetrics(this.words[wordIndex]).slotHeight);
      }
      
      for (let x = 0; x < this.textGrid[y].length; x++) {
        if (currentX > this.displayX + this.displayWidth) break;
        
        try {
          const wordIndex = this.textGrid[y][x];
          if (wordIndex >= this.words.length) continue;
          
          const word = this.words[wordIndex];
          const layout = this.getWordLayoutMetrics(word);

          if (currentX + layout.slotWidth > this.displayX + this.displayWidth) break;
          
          let vidX = Math.floor(((currentX + layout.slotWidth / 2 - this.displayX) / this.displayWidth) * this.canvas.width);
          let vidY = Math.floor(((currentY + rowHeight / 2 - this.displayY) / this.displayHeight) * this.canvas.height);
          
          if (this.settings.flipVideo) {
            vidX = this.canvas.width - vidX;
          }
          
          vidX = Math.max(0, Math.min(this.canvas.width - 1, vidX));
          vidY = Math.max(0, Math.min(this.canvas.height - 1, vidY));
          
          const pixelIndex = (vidY * this.canvas.width + vidX) * 4;
          const r = pixels[pixelIndex];
          const g = pixels[pixelIndex + 1];
          const b = pixels[pixelIndex + 2];
          const brightness = (r + g + b) / 3;
          
          const shouldDrawText = this.settings.invertColors ? 
            (brightness > this.settings.threshold) : 
            (brightness < this.settings.threshold);
          
          if (shouldDrawText) {
            this.ctx.save();
            this.ctx.fillStyle = word.color;
            this.ctx.font = `${word.size}px ${word.font}`;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            const animation = this.settings.enableAnimation ?
              this.getAnimationTransform(currentX, currentY) :
              { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
            const translateX = currentX + layout.slotWidth / 2 + animation.x;
            const translateY = currentY + rowHeight / 2 + animation.y;

            this.ctx.globalAlpha = animation.opacity;
            this.ctx.translate(translateX, translateY);
            this.ctx.rotate(animation.rotation);
            this.ctx.scale(animation.scale, animation.scale);
            this.ctx.fillText(word.text, -layout.baseWidth / 2, -layout.baseHeight / 2);
            this.lastTextFrame.push({
              text: word.text,
              color: word.color,
              font: word.font,
              size: word.size,
              x: -layout.baseWidth / 2,
              y: -layout.baseHeight / 2,
              translateX,
              translateY,
              rotation: animation.rotation,
              scale: animation.scale,
              opacity: animation.opacity
            });

            this.ctx.restore();
          }
          
          currentX += layout.slotWidth;
        } catch (error) {
          continue;
        }
      }
      
      currentY += rowHeight;
    }
  }

  /**
   * Match the motion vocabulary used by WORD SILHOUETTE.html while exposing
   * a separate amount control for the animation playground.
   */
  getAnimationTransform(x, y) {
    const time = performance.now() * 0.001;
    const speed = this.settings.animationSpeed * 0.55;
    const amount = this.settings.animationAmount;
    const phase = x * 0.018 + y * 0.008;
    const result = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };

    switch (this.settings.animationType) {
      case 'wave':
        result.y = Math.sin(time * speed + phase) * amount;
        break;
      case 'pulse':
        result.scale = Math.max(0.1, 1 + Math.sin(time * speed * 1.35 + phase) * amount * 0.012);
        break;
      case 'rotate':
        result.rotation = Math.sin(time * speed + phase) * amount * 0.012;
        break;
      case 'bounce':
        result.y = -Math.abs(Math.sin(time * speed + phase)) * amount;
        break;
      case 'flicker':
        result.opacity = Math.max(0.08, 1 - Math.abs(Math.sin(time * speed * 2.2 + phase)) * amount * 0.045);
        break;
      default:
        break;
    }

    return result;
  }

  /**
   * Export the latest silhouette as editable SVG text at the active viewport.
   */
  toSVG() {
    const escapeXML = (value) => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
    const number = (value) => Number(value).toFixed(3).replace(/\.000$/, '');
    const background = this.settings.invertColors ? '#ffffff' : '#000000';
    const nodes = this.lastTextFrame.map((item) => {
      const transform = item.translateX === undefined ? '' :
        ` transform="translate(${number(item.translateX)} ${number(item.translateY)}) rotate(${number(item.rotation * 180 / Math.PI)}) scale(${number(item.scale)})"`;
      return `  <text x="${number(item.x)}" y="${number(item.y)}"${transform} fill="${escapeXML(item.color)}" fill-opacity="${number(item.opacity)}" font-family="${escapeXML(item.font)}" font-size="${number(item.size)}" dominant-baseline="hanging">${escapeXML(item.text)}</text>`;
    }).join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}" viewBox="0 0 ${this.canvas.width} ${this.canvas.height}">`,
      '  <title>Text Silhouette</title>',
      '  <desc>Editable vector text exported from the Calculated Camouflage Text Silhouette Lab.</desc>',
      `  <rect width="100%" height="100%" fill="${background}"/>`,
      nodes,
      '</svg>'
    ].join('\n');
  }
  
  /**
   * Detect silhouette contour edges
   */
  detectSilhouetteContour(imageData) {
    this.edgePixels = [];
    const pixels = imageData.data;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    const sampleStep = Math.max(1, Math.floor(this.settings.pixelSize / this.settings.contourDensity));
    
    // Simplified edge detection
    for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
      for (let x = sampleStep; x < width - sampleStep; x += sampleStep) {
        const idx = (y * width + x) * 4;
        
        // Get brightness of current pixel
        const r1 = pixels[idx];
        const g1 = pixels[idx + 1];
        const b1 = pixels[idx + 2];
        const brightness1 = (r1 + g1 + b1) / 3;
        
        // Get brightness of pixel to the right
        const idx2 = (y * width + (x + sampleStep)) * 4;
        const r2 = pixels[idx2];
        const g2 = pixels[idx2 + 1];
        const b2 = pixels[idx2 + 2];
        const brightness2 = (r2 + g2 + b2) / 3;
        
        // Get brightness of pixel below
        const idx3 = ((y + sampleStep) * width + x) * 4;
        const r3 = pixels[idx3];
        const g3 = pixels[idx3 + 1];
        const b3 = pixels[idx3 + 2];
        const brightness3 = (r3 + g3 + b3) / 3;
        
        // Calculate difference
        const diffH = Math.abs(brightness1 - brightness2);
        const diffV = Math.abs(brightness1 - brightness3);
        
        // If difference is greater than threshold, it's an edge
        if (diffH > this.settings.contourSensitivity || diffV > this.settings.contourSensitivity) {
          // Check if this would be visible based on threshold
          const visible = this.settings.invertColors ? 
            (brightness1 > this.settings.threshold) : 
            (brightness1 < this.settings.threshold);
            
          if (visible) {
            this.edgePixels.push({ x, y });
          }
        }
      }
    }
  }
  
  /**
   * Draw contour pixels
   */
  drawContour() {
    // Save state
    this.ctx.save();
    
    this.ctx.fillStyle = this.settings.contourColor;
    
    for (let i = 0; i < this.edgePixels.length; i++) {
      const edge = this.edgePixels[i];
      
      let screenX = edge.x;
      let screenY = edge.y;
      
      // Apply flip if needed
      if (this.settings.flipVideo) {
        screenX = this.displayWidth - screenX;
      }
      
      // Draw pixel square
      this.ctx.fillRect(screenX, screenY, this.settings.pixelSize, this.settings.pixelSize);
    }
    
    // Restore state
    this.ctx.restore();
  }
  
  /**
   * Apply glitch effects to canvas
   */
  applyGlitchEffect() {
    const now = Date.now();
    const timeFactor = now * this.settings.glitchSpeed * 0.001;
    const intensity = this.settings.glitchIntensity / 100;
    
    // Update random values periodically
    if (now - this.glitchLastUpdate > 1000 / (this.settings.glitchSpeed * 2)) {
      this.glitchRandomValues = [];
      for (let i = 0; i < 20; i++) {
        this.glitchRandomValues.push(Math.random());
      }
      this.glitchLastUpdate = now;
    }
    
    // Get pixel data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageData.data;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Apply selected glitch type
    switch (this.settings.glitchType) {
      case 'scanlines':
        this.applyScanLines(pixels, width, height, intensity, timeFactor);
        break;
      case 'rgbshift':
        this.applyRGBShift(pixels, width, height, intensity, timeFactor);
        break;
      case 'noise':
        this.applyNoise(pixels, width, height, intensity);
        break;
      case 'blockshift':
        this.applyBlockShift(pixels, width, height, intensity);
        break;
      case 'digitaldropout':
        this.applyDigitalDropout(pixels, width, height, intensity);
        break;
      default:
        break;
    }
    
    // Put modified pixels back
    this.ctx.putImageData(imageData, 0, 0);
  }
  
  applyScanLines(pixels, width, height, intensity, timeFactor) {
    for (let y = 0; y < height; y += 2) {
      const offset = Math.sin(y * 0.05 + timeFactor * 5) * 10;
      const lineIntensity = 0.7 + Math.sin(y * 0.1 + timeFactor * 3) * 0.3;
      
      if (Math.sin(y * 0.2 + timeFactor) > 0.7) continue;
      
      for (let x = 0; x < width; x++) {
        const destX = Math.max(0, Math.min(width - 1, Math.floor(x + offset * intensity)));
        const idx = (y * width + destX) * 4;
        
        if (idx < pixels.length - 4) {
          pixels[idx] *= (1 - lineIntensity * intensity);
          pixels[idx + 1] *= (1 - lineIntensity * intensity);
          pixels[idx + 2] *= (1 - lineIntensity * intensity);
        }
      }
    }
  }
  
  applyRGBShift(pixels, width, height, intensity, timeFactor) {
    const origPixels = new Uint8ClampedArray(pixels);
    const shiftX = Math.sin(timeFactor) * 10 * intensity;
    const shiftY = Math.cos(timeFactor * 1.3) * 8 * intensity;
    
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (y % 3 !== 0 || x % 3 !== 0) continue;
        
        const idx = (y * width + x) * 4;
        if (idx >= pixels.length - 4) continue;
        
        // Shift red channel
        const rx = Math.max(0, Math.min(width - 1, Math.floor(x + shiftX)));
        const ry = Math.max(0, Math.min(height - 1, Math.floor(y + shiftY)));
        const ridx = (ry * width + rx) * 4;
        
        // Shift blue channel opposite direction
        const bx = Math.max(0, Math.min(width - 1, Math.floor(x - shiftX)));
        const by = Math.max(0, Math.min(height - 1, Math.floor(y - shiftY)));
        const bidx = (by * width + bx) * 4;
        
        if (ridx < origPixels.length - 4 && bidx < origPixels.length - 4) {
          pixels[ridx] = origPixels[idx];
          pixels[bidx + 2] = origPixels[idx + 2];
        }
      }
    }
  }
  
  applyNoise(pixels, width, height, intensity) {
    const numNoise = Math.floor(width * height * intensity * 0.1);
    for (let i = 0; i < numNoise; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      const idx = (y * width + x) * 4;
      
      if (idx < pixels.length - 4) {
        const val = Math.random() > 0.5 ? 255 : 0;
        pixels[idx] = val;
        pixels[idx + 1] = val;
        pixels[idx + 2] = val;
      }
    }
  }
  
  applyBlockShift(pixels, width, height, intensity) {
    const origPixels = new Uint8ClampedArray(pixels);
    const numBlocks = Math.floor(5 * intensity);
    
    for (let i = 0; i < numBlocks; i++) {
      const blockX = Math.floor(Math.random() * width * 0.8);
      const blockY = Math.floor(Math.random() * height);
      const blockW = Math.floor(Math.random() * (100 - 20) * intensity + 20);
      const blockH = Math.floor(Math.random() * (20 - 5) + 5);
      const offsetX = Math.floor((Math.random() * 60 - 30) * intensity);
      
      if (blockX + blockW >= width || blockY + blockH >= height) continue;
      
      for (let y = blockY; y < blockY + blockH; y++) {
        for (let x = blockX; x < blockX + blockW; x++) {
          const srcIdx = (y * width + x) * 4;
          const destX = Math.max(0, Math.min(width - 1, x + offsetX));
          const destIdx = (y * width + destX) * 4;
          
          if (srcIdx < origPixels.length - 4 && destIdx < pixels.length - 4) {
            pixels[destIdx] = origPixels[srcIdx];
            pixels[destIdx + 1] = origPixels[srcIdx + 1];
            pixels[destIdx + 2] = origPixels[srcIdx + 2];
            pixels[destIdx + 3] = origPixels[srcIdx + 3];
          }
        }
      }
    }
  }
  
  applyDigitalDropout(pixels, width, height, intensity) {
    const numDropouts = Math.floor(5 * intensity);
    
    for (let i = 0; i < numDropouts; i++) {
      const dropoutX = Math.floor(Math.random() * width);
      const dropoutY = Math.floor(Math.random() * height);
      const dropoutW = Math.floor(Math.random() * (100 - 10) * intensity + 10);
      const dropoutH = Math.floor(Math.random() * (30 - 5) + 5);
      const corruptionType = Math.floor(Math.random() * 3);
      
      if (dropoutX + dropoutW >= width || dropoutY + dropoutH >= height) continue;
      
      for (let y = dropoutY; y < dropoutY + dropoutH; y++) {
        for (let x = dropoutX; x < dropoutX + dropoutW; x++) {
          const idx = (y * width + x) * 4;
          
          if (idx < pixels.length - 4) {
            switch (corruptionType) {
              case 0: // Black dropout
                pixels[idx] = 0;
                pixels[idx + 1] = 0;
                pixels[idx + 2] = 0;
                break;
              case 1: // White dropout
                pixels[idx] = 255;
                pixels[idx + 1] = 255;
                pixels[idx + 2] = 255;
                break;
              case 2: // Colored static
                pixels[idx] = Math.random() * 255;
                pixels[idx + 1] = Math.random() * 255;
                pixels[idx + 2] = Math.random() * 255;
                break;
            }
          }
        }
      }
    }
  }
  
  /**
   * Get the canvas element for THREE.js texture
   */
  getCanvas() {
    return this.canvas;
  }
  
  /**
   * Cleanup resources
   */
  dispose() {
    // Stop keep-alive interval
    if (this.videoKeepAliveInterval) {
      clearInterval(this.videoKeepAliveInterval);
      this.videoKeepAliveInterval = null;
    }
    
    // Stop all tracks
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
    }
  }
}
