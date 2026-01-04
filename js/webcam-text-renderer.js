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
    
    // Mobile Safari detection
    this.isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') && 'ontouchend' in document);
    this.lastVideoTime = 0;
    this.videoKeepAliveInterval = null;
    
    // Word definitions with CORRECT colors
    this.words = [
      { text: "YOU ARE", color: "#FFFF00", font: "monospace", size: 22 },
      { text: "YOUR CHOICES", color: "#FF0000", font: "serif", size: 22 },
      { text: "PUBLIC SELF", color: "#00FF00", font: "monospace", size: 17 },
      { text: "POSSIBILITY", color: "#0000FF", font: "monospace", size: 17 }
    ];
    
    // Text grid
    this.textGrid = [];
    this.textColumns = 0;
    this.textRows = 0;
    
    // Contour detection
    this.edgePixels = [];
    
    // Settings (matching WORD SILHOUETTE defaults)
    this.settings = {
      // Image controls
      invertColors: false,
      flipVideo: false,
      portraitMode: false,
      threshold: 95,
      cellWidthMultiplier: 1.5,
      
      // Contour controls
      showContour: false,
      pixelSize: 1,
      contourSensitivity: 4,
      contourDensity: 2,
      contourColor: "#FFFFFF",
      
      // Text settings
      fontSize: 17,
      textDensity: 0.8,
      
      // Animation controls (not implemented yet)
      enableAnimation: false,
      animationType: 'wave',
      animationSpeed: 5,
      
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
      
      // Get new stream
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      };
      
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
      
      // Setup Safari mobile keep-alive workaround
      if (this.isIOSSafari) {
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
    // Periodically ensure video is playing
    this.videoKeepAliveInterval = setInterval(() => {
      if (this.video && this.video.paused) {
        this.video.play().catch(() => {});
      }
      
      // Check for stalled video (same currentTime)
      if (this.video && this.video.currentTime === this.lastVideoTime && this.currentStream) {
        const tracks = this.currentStream.getVideoTracks();
        if (tracks.length > 0 && tracks[0].enabled) {
          // Toggle track to force refresh on Safari
          tracks[0].enabled = false;
          setTimeout(() => {
            tracks[0].enabled = true;
          }, 10);
        }
      }
      this.lastVideoTime = this.video ? this.video.currentTime : 0;
    }, 500);
    
    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.video) {
        setTimeout(() => {
          if (this.video.paused) {
            this.video.play().catch(() => {});
          }
        }, 100);
      }
    });
    
    // Handle video stall events
    this.video.addEventListener('stalled', () => {
      console.log('Video stalled, recovering...');
      this.video.play().catch(() => {});
    });
    
    this.video.addEventListener('suspend', () => {
      setTimeout(() => {
        if (this.video.paused) {
          this.video.play().catch(() => {});
        }
      }, 100);
    });
  }
  
  /**
   * Calculate grid dimensions based on settings
   */
  updateGridDimensions() {
    const avgCharWidth = this.settings.fontSize * 0.6;
    const avgWordLength = 8;
    const cellWidthNeeded = avgWordLength * avgCharWidth * this.settings.cellWidthMultiplier;
    
    this.textColumns = Math.max(1, Math.floor(this.displayWidth / (cellWidthNeeded / this.settings.textDensity)));
    this.textRows = Math.max(1, Math.floor(this.displayHeight / ((this.settings.fontSize * 1.2) / this.settings.textDensity)));
    
    const cellWidth = this.displayWidth / this.textColumns;
    const cellHeight = this.displayHeight / this.textRows;
    
    console.log(`📐 Grid: ${this.textColumns}cols x ${this.textRows}rows | Cell: ${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}`);
  }
  
  /**
   * Initialize the text grid with random words
   */
  initializeGrid() {
    this.textGrid = [];
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
    // Check if video is ready (readyState >= 2 means HAVE_CURRENT_DATA or better)
    const videoReady = this.video && this.video.readyState >= 2;
    
    if (!videoReady) {
      // Show placeholder with colored text
      this.drawPlaceholder();
      return;
    }
    
    // Safari mobile: ensure video is playing
    if (this.isIOSSafari && this.video) {
      if (this.video.paused || this.video.ended) {
        this.video.play().catch(() => {});
      }
    }
    
    try {
      // Clear canvas
      this.ctx.fillStyle = this.settings.invertColors ? '#FFFFFF' : '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw webcam frame (hidden, for pixel sampling)
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // Get pixel data
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
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
    this.ctx.fillText('POSSIBILITY', w - 100, h - 100);
    
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
    const gridColWidth = this.displayWidth / this.textColumns;
    const gridRowHeight = this.displayHeight / this.textRows;
    const cellPadding = 2;
    
    // Iterate through grid
    for (let y = 0; y < this.textRows; y++) {
      const currentY = this.displayY + (y * gridRowHeight);
      
      if (currentY > this.displayY + this.displayHeight) break;
      
      for (let x = 0; x < this.textColumns; x++) {
        const currentX = this.displayX + (x * gridColWidth);
        
        if (currentX > this.displayX + this.displayWidth) break;
        
        try {
          // Get word for this cell
          const wordIndex = this.textGrid[y][x];
          if (wordIndex >= this.words.length) continue;
          
          const word = this.words[wordIndex];
          
          // Sample pixel at center of cell
          let vidX = Math.floor(currentX + gridColWidth / 2);
          let vidY = Math.floor(currentY + gridRowHeight / 2);
          
          // Apply flip if needed
          if (this.settings.flipVideo) {
            vidX = this.canvas.width - vidX;
          }
          
          // Constrain to bounds
          vidX = Math.max(0, Math.min(this.canvas.width - 1, vidX));
          vidY = Math.max(0, Math.min(this.canvas.height - 1, vidY));
          
          // Get pixel brightness
          const pixelIndex = (vidY * this.canvas.width + vidX) * 4;
          const r = pixels[pixelIndex];
          const g = pixels[pixelIndex + 1];
          const b = pixels[pixelIndex + 2];
          const brightness = (r + g + b) / 3;
          
          // Check threshold
          const shouldDrawText = this.settings.invertColors ? 
            (brightness > this.settings.threshold) : 
            (brightness < this.settings.threshold);
          
          if (shouldDrawText) {
            // Save canvas state
            this.ctx.save();
            
            // CRITICAL: Set color for THIS word
            this.ctx.fillStyle = word.color;
            this.ctx.font = `${word.size}px ${word.font}`;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            
            // Measure text width
            const textWidth = this.ctx.measureText(word.text).width;
            const maxTextWidth = gridColWidth - cellPadding * 2;
            
            // Draw text if it fits
            if (textWidth <= maxTextWidth) {
              this.ctx.fillText(word.text, currentX + cellPadding, currentY + cellPadding);
            } else {
              // Truncate if too long
              let truncatedText = word.text;
              while (this.ctx.measureText(truncatedText).width > maxTextWidth && truncatedText.length > 1) {
                truncatedText = truncatedText.substring(0, truncatedText.length - 1);
              }
              if (truncatedText.length > 0) {
                this.ctx.fillText(truncatedText, currentX + cellPadding, currentY + cellPadding);
              }
            }
            
            // Restore canvas state
            this.ctx.restore();
          }
        } catch (error) {
          // Skip cell on error
          continue;
        }
      }
    }
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

