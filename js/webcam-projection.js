/**
 * WebcamProjection - Webcam-based pixel projection for the left wall
 * Shows pixels where the thresholded webcam feed is white (bright)
 */
export class WebcamProjection {
  constructor(width = 320, height = 240) {
    // Lower resolution for performance - we're sampling, not displaying
    this.width = width;
    this.height = height;
    
    // Hidden canvas for processing
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
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    
    // Camera state
    this.currentStream = null;
    this.isInitialized = false;
    this.isInitializing = false;
    
    // Cached image data
    this.imageData = null;
    this.lastFrameTime = 0;
    
    // Settings with defaults
    this.settings = {
      threshold: 96,           // 0-255, brightness cutoff
      pixelSize: 0.350,        // Size of each particle (larger for mobile visibility)
      pixelDensity: 150,       // Percentage of potential pixels to show (can go over 100%)
      pixelStyle: 'glow',      // 'glow' or 'squares'
      pixelColor: '#ffffff',   // Color of pixels
      flipHorizontal: true,    // Mirror the webcam (natural for facing camera)
      invert: false,           // Invert threshold (show dark areas instead)
      intensity: 0.5           // Overall opacity (slightly brighter)
    };
    
    // Sampling grid - positions where we check brightness
    this.sampleGrid = [];
    this.maxSamples = 8000; // Increased to support higher density
    
    console.log('📽️ WebcamProjection created:', width, 'x', height);
  }
  
  /**
   * Initialize webcam capture
   * Must be called after user gesture (browser requirement)
   */
  async init() {
    if (this.isInitialized || this.isInitializing) {
      return this.isInitialized;
    }
    
    this.isInitializing = true;
    
    try {
      console.log('🎥 WebcamProjection: Initializing webcam...');
      
      const constraints = {
        video: {
          width: { ideal: this.width },
          height: { ideal: this.height },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      };
      
      this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.currentStream;
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          this.video.play()
            .then(resolve)
            .catch(reject);
        };
        this.video.onerror = reject;
      });
      
      this.isInitialized = true;
      this.isInitializing = false;
      
      console.log('✅ WebcamProjection: Webcam initialized');
      return true;
      
    } catch (error) {
      console.error('❌ WebcamProjection: Failed to initialize:', error);
      this.isInitializing = false;
      return false;
    }
  }
  
  /**
   * Capture current frame and apply threshold
   * Returns array of normalized positions (0-1) where pixels should appear
   */
  captureFrame() {
    if (!this.isInitialized || !this.video.videoWidth) {
      return [];
    }
    
    // Draw video frame to canvas
    this.ctx.drawImage(this.video, 0, 0, this.width, this.height);
    
    // Get pixel data
    this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
    
    return this.sampleThresholdedPositions();
  }
  
  /**
   * Sample positions where brightness passes threshold
   * Returns array of { x, y } normalized to 0-1 range
   */
  sampleThresholdedPositions() {
    if (!this.imageData) return [];
    
    const pixels = this.imageData.data;
    const positions = [];
    const width = this.width;
    const height = this.height;
    const threshold = this.settings.threshold;
    const invert = this.settings.invert;
    const flipH = this.settings.flipHorizontal;
    const maxSamples = this.maxSamples;
    
    // Calculate sample step based on density (optimized)
    // Higher density = smaller step = more samples
    const densityFactor = this.settings.pixelDensity / 100;
    const baseStep = Math.max(1, Math.floor(3 / densityFactor));
    
    // Pre-calculate width inverse for normalization
    const invWidth = 1 / width;
    const invHeight = 1 / height;
    
    for (let y = 0; y < height; y += baseStep) {
      const rowOffset = y * width;
      
      for (let x = 0; x < width; x += baseStep) {
        const sampleX = flipH ? (width - 1 - x) : x;
        const idx = (rowOffset + sampleX) << 2; // Faster than * 4
        
        // Fast brightness calculation (approximate)
        const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) * 0.333333;
        
        // Check threshold
        const passesThreshold = invert ? (brightness < threshold) : (brightness > threshold);
        
        if (passesThreshold) {
          positions.push({
            x: x * invWidth,
            y: y * invHeight
          });
          
          // Early exit if we have enough samples
          if (positions.length >= maxSamples) {
            return positions;
          }
        }
      }
    }
    
    return positions;
  }
  
  /**
   * Get brightness at a specific normalized position
   * @param {number} nx - Normalized x (0-1)
   * @param {number} ny - Normalized y (0-1)
   * @returns {number} Brightness 0-255, or -1 if no data
   */
  getBrightnessAt(nx, ny) {
    if (!this.imageData) return -1;
    
    let x = Math.floor(nx * this.width);
    let y = Math.floor(ny * this.height);
    
    // Apply flip
    if (this.settings.flipHorizontal) {
      x = this.width - 1 - x;
    }
    
    // Clamp to bounds
    x = Math.max(0, Math.min(this.width - 1, x));
    y = Math.max(0, Math.min(this.height - 1, y));
    
    const idx = (y * this.width + x) * 4;
    const pixels = this.imageData.data;
    
    return (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
  }
  
  /**
   * Check if a normalized position passes threshold
   */
  passesThreshold(nx, ny) {
    const brightness = this.getBrightnessAt(nx, ny);
    if (brightness < 0) return false;
    
    if (this.settings.invert) {
      return brightness < this.settings.threshold;
    } else {
      return brightness > this.settings.threshold;
    }
  }
  
  /**
   * Update a setting
   */
  setSetting(key, value) {
    if (key in this.settings) {
      this.settings[key] = value;
      console.log(`📽️ WebcamProjection: ${key} = ${value}`);
    }
  }
  
  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }
  
  /**
   * Get parsed color as RGB object
   */
  getColorRGB() {
    const hex = this.settings.pixelColor.replace('#', '');
    return {
      r: parseInt(hex.substr(0, 2), 16) / 255,
      g: parseInt(hex.substr(2, 2), 16) / 255,
      b: parseInt(hex.substr(4, 2), 16) / 255
    };
  }
  
  /**
   * Check if webcam is ready
   */
  isReady() {
    return this.isInitialized && this.video.videoWidth > 0;
  }
  
  /**
   * Cleanup resources
   */
  dispose() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    this.isInitialized = false;
  }
}

