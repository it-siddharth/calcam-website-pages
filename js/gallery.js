/**
 * Gallery Carousel - Smooth Horizontal Scroll
 * Supports mouse drag, touch, wheel, and keyboard navigation
 * With lazy loading for videos
 */

(function() {
  'use strict';
  
  const track = document.getElementById('carousel-track');
  const scrollHint = document.getElementById('scroll-hint');
  const wrapper = document.querySelector('.carousel-wrapper');
  
  if (!track || !wrapper) return;
  
  // State
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let scrollLeft = 0;
  let currentTranslate = 0;
  let targetTranslate = 0;
  let velocity = 0;
  let lastX = 0;
  let lastTime = 0;
  let rafId = null;
  let hasScrolled = false;
  let isAnimating = false;
  let swipeDirection = null; // 'horizontal', 'vertical', or null
  
  // Track loaded videos
  const loadedVideos = new Set();
  
  // Configuration
  const config = {
    friction: 0.85,
    wheelMultiplier: 1.5,
    minVelocity: 0.1,
    touchMultiplier: 1,
    keyboardStep: 400,
    maxTranslate: 0,
    minTranslate: 0,
    smoothing: 0.12
  };
  
  // Calculate bounds - called after all media loads
  function updateBounds() {
    const trackWidth = track.scrollWidth;
    const viewportWidth = wrapper.offsetWidth;
    config.minTranslate = Math.min(0, -(trackWidth - viewportWidth + 100));
    config.maxTranslate = 0;
    
    // Clamp current position to bounds
    targetTranslate = clamp(targetTranslate);
    currentTranslate = clamp(currentTranslate);
  }
  
  // Clamp value to bounds
  function clamp(value) {
    return Math.max(config.minTranslate, Math.min(config.maxTranslate, value));
  }
  
  // Apply transform
  function applyTransform() {
    track.style.transform = `translate3d(${currentTranslate}px, 0, 0)`;
    
    // Hide scroll hint after first scroll
    if (!hasScrolled && Math.abs(currentTranslate) > 50) {
      hasScrolled = true;
      if (scrollHint) {
        scrollHint.classList.add('hidden');
      }
    }
    
    // Check for videos that need to be loaded
    checkLazyVideos();
  }
  
  // Smooth animation loop
  function animate() {
    if (!isDragging) {
      // Apply momentum when not dragging
      if (Math.abs(velocity) > config.minVelocity) {
        targetTranslate = clamp(targetTranslate + velocity);
        velocity *= config.friction;
      } else {
        velocity = 0;
      }
    }
    
    // Smooth interpolation to target
    const diff = targetTranslate - currentTranslate;
    
    if (Math.abs(diff) > 0.5 || Math.abs(velocity) > config.minVelocity) {
      currentTranslate += diff * config.smoothing;
      applyTransform();
      rafId = requestAnimationFrame(animate);
      isAnimating = true;
    } else {
      currentTranslate = targetTranslate;
      applyTransform();
      isAnimating = false;
      rafId = null;
    }
  }
  
  // Start animation if not already running
  function startAnimation() {
    if (!rafId) {
      rafId = requestAnimationFrame(animate);
    }
  }
  
  // Mouse events
  function onMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    
    // Don't start drag on video elements
    if (e.target.tagName === 'VIDEO') return;
    
    isDragging = true;
    velocity = 0;
    startX = e.pageX;
    scrollLeft = currentTranslate;
    lastX = e.pageX;
    lastTime = performance.now();
    
    track.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    e.preventDefault();
  }
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    const x = e.pageX;
    const dx = x - startX;
    
    // Calculate velocity
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocity = ((x - lastX) / dt) * 16;
    }
    lastX = x;
    lastTime = now;
    
    targetTranslate = clamp(scrollLeft + dx);
    startAnimation();
  }
  
  function onMouseUp() {
    isDragging = false;
    track.style.cursor = 'grab';
    document.body.style.userSelect = '';
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // Continue momentum
    startAnimation();
  }
  
  // Touch events
  let touchId = null; // Track active touch
  
  function onTouchStart(e) {
    // Always reset state at the start of a new touch
    if (e.touches.length === 1) {
      touchId = e.touches[0].identifier;
      isDragging = true;
      velocity = 0;
      swipeDirection = null;
      startX = e.touches[0].pageX;
      startY = e.touches[0].pageY;
      scrollLeft = currentTranslate;
      lastX = e.touches[0].pageX;
      lastTime = performance.now();
    }
  }
  
  function onTouchMove(e) {
    // Find our tracked touch
    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchId) {
        touch = e.touches[i];
        break;
      }
    }
    
    if (!touch || !isDragging) return;
    
    const x = touch.pageX;
    const y = touch.pageY;
    const dx = x - startX;
    const dy = y - startY;
    
    // Determine swipe direction on first significant movement
    if (swipeDirection === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        swipeDirection = 'horizontal';
      } else {
        swipeDirection = 'vertical';
      }
    }
    
    // If vertical swipe, let browser handle - but keep tracking state
    if (swipeDirection === 'vertical') {
      return; // Don't set isDragging = false, just ignore movement
    }
    
    // For horizontal swipes, prevent default and handle carousel
    if (swipeDirection === 'horizontal') {
      e.preventDefault();
      
      // Calculate velocity
      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0) {
        velocity = ((x - lastX) / dt) * 16 * config.touchMultiplier;
      }
      lastX = x;
      lastTime = now;
      
      targetTranslate = clamp(scrollLeft + dx);
      startAnimation();
    }
  }
  
  function onTouchEnd() {
    // Always reset state on touch end
    isDragging = false;
    swipeDirection = null;
    touchId = null;
    startAnimation();
  }
  
  // Wheel event - handle both vertical and horizontal wheel
  function onWheel(e) {
    e.preventDefault();
    
    // Use both deltaX and deltaY for flexibility
    let delta = e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      delta = e.deltaX;
    }
    
    // Apply wheel movement directly to target
    targetTranslate = clamp(targetTranslate - delta * config.wheelMultiplier);
    
    // Add a bit of immediate velocity for smoothness
    velocity = 0;
    
    startAnimation();
  }
  
  // Keyboard navigation
  function onKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      velocity = 0;
      targetTranslate = clamp(targetTranslate - config.keyboardStep);
      startAnimation();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      velocity = 0;
      targetTranslate = clamp(targetTranslate + config.keyboardStep);
      startAnimation();
    }
  }
  
  // Lazy load videos when they come into view
  function checkLazyVideos() {
    const videos = track.querySelectorAll('video[data-src]');
    const wrapperRect = wrapper.getBoundingClientRect();
    
    videos.forEach(video => {
      if (loadedVideos.has(video)) return;
      
      const videoRect = video.getBoundingClientRect();
      // Load video when it's within 500px of the viewport
      const isNearViewport = (
        videoRect.right > wrapperRect.left - 500 &&
        videoRect.left < wrapperRect.right + 500
      );
      
      if (isNearViewport) {
        loadVideo(video);
      }
    });
  }
  
  // Load a lazy video
  function loadVideo(video) {
    const src = video.dataset.src;
    if (!src || loadedVideos.has(video)) return;
    
    loadedVideos.add(video);
    video.src = src;
    video.removeAttribute('data-src');
    video.load();
    
    // Play when loaded
    video.addEventListener('loadeddata', () => {
      video.muted = true;
      video.play().catch(() => {});
      // Update bounds after video loads
      setTimeout(updateBounds, 100);
    }, { once: true });
  }
  
  // Wait for all images to load before calculating bounds
  function waitForMedia() {
    const images = track.querySelectorAll('img');
    
    let loadedCount = 0;
    const totalCount = images.length;
    
    function onMediaLoad() {
      loadedCount++;
      if (loadedCount >= totalCount) {
        updateBounds();
      }
    }
    
    images.forEach(img => {
      if (img.complete) {
        onMediaLoad();
      } else {
        img.addEventListener('load', onMediaLoad);
        img.addEventListener('error', onMediaLoad);
      }
    });
    
    // Fallback if no images
    if (totalCount === 0) {
      updateBounds();
    }
    
    // Also update bounds after a delay as fallback
    setTimeout(updateBounds, 500);
    setTimeout(updateBounds, 1500);
  }
  
  // Initialize
  function init() {
    // Set initial styles
    track.style.cursor = 'grab';
    track.style.willChange = 'transform';
    
    // Mouse events
    track.addEventListener('mousedown', onMouseDown);
    
    // Touch events - use passive: false for touchmove to allow preventDefault
    track.addEventListener('touchstart', onTouchStart, { passive: true });
    track.addEventListener('touchmove', onTouchMove, { passive: false });
    track.addEventListener('touchend', onTouchEnd);
    track.addEventListener('touchcancel', onTouchEnd);
    
    // Wheel event
    wrapper.addEventListener('wheel', onWheel, { passive: false });
    
    // Keyboard
    document.addEventListener('keydown', onKeyDown);
    
    // Resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateBounds, 100);
    });
    
    // Prevent context menu during drag
    track.addEventListener('contextmenu', (e) => {
      if (isDragging) e.preventDefault();
    });
    
    // Prevent image drag
    track.addEventListener('dragstart', (e) => {
      e.preventDefault();
    });
    
    // Wait for media to load
    waitForMedia();
    
    // Initial bounds calculation
    updateBounds();
    
    // Initial check for lazy videos (in case some are already visible)
    checkLazyVideos();
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


