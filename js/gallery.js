/**
 * Gallery Carousel - Smooth Horizontal Scroll
 * Supports mouse drag, touch, wheel, and keyboard navigation
 * With lazy loading for videos
 * On mobile (<=768px), uses native vertical scroll instead
 */

(function() {
  'use strict';
  
  const track = document.getElementById('carousel-track');
  const scrollHint = document.getElementById('scroll-hint');
  const wrapper = document.querySelector('.carousel-wrapper');
  
  if (!track || !wrapper) return;
  
  // Check if mobile viewport
  function isMobile() {
    return window.innerWidth <= 768;
  }
  
  // If mobile, just load videos and exit (use native scroll)
  if (isMobile()) {
    // Load all videos immediately on mobile for smooth experience
    const videos = track.querySelectorAll('video[data-src]');
    videos.forEach(video => {
      const src = video.dataset.src;
      if (src) {
        video.src = src;
        video.removeAttribute('data-src');
        video.load();
        video.addEventListener('loadeddata', () => {
          video.muted = true;
          video.play().catch(() => {});
        }, { once: true });
      }
    });
    
    // Setup Intersection Observer for video autoplay on mobile
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.5 });
    
    track.querySelectorAll('video').forEach(video => {
      observer.observe(video);
    });
    
    return; // Exit - don't set up horizontal scroll
  }
  
  // State
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentTranslate = 0;
  let targetTranslate = 0;
  let velocity = 0;
  let rafId = null;
  let hasScrolled = false;
  let swipeDirection = null;
  let dragStartTranslate = 0;
  
  // Velocity tracking (use array for smoothing)
  let velocityHistory = [];
  let lastTouchX = 0;
  let lastTouchTime = 0;
  
  // Track loaded videos
  const loadedVideos = new Set();
  
  // Configuration
  const config = {
    friction: 0.95,           // Momentum decay (lower = stops faster)
    wheelMultiplier: 1.5,
    minVelocity: 0.5,         // Stop animation below this
    maxVelocity: 50,          // Cap velocity to prevent flying off
    keyboardStep: 400,
    maxTranslate: 0,
    minTranslate: 0,
    directionThreshold: 10,   // Pixels before locking direction
    velocitySamples: 5        // Number of samples for velocity smoothing
  };
  
  // Calculate bounds
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
  
  // Apply transform directly
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
  
  // Get smoothed velocity from history
  function getSmoothedVelocity() {
    if (velocityHistory.length === 0) return 0;
    
    // Weight recent samples more heavily
    let total = 0;
    let weight = 0;
    for (let i = 0; i < velocityHistory.length; i++) {
      const w = i + 1; // Later samples get more weight
      total += velocityHistory[i] * w;
      weight += w;
    }
    return total / weight;
  }
  
  // Clamp velocity to reasonable range
  function clampVelocity(v) {
    return Math.max(-config.maxVelocity, Math.min(config.maxVelocity, v));
  }
  
  // Animation loop
  function animate() {
    if (isDragging) {
      // During drag, move directly to target (1:1 tracking)
      currentTranslate = targetTranslate;
      applyTransform();
      rafId = requestAnimationFrame(animate);
      return;
    }
    
    // Apply momentum when not dragging
    if (Math.abs(velocity) > config.minVelocity) {
      targetTranslate = clamp(targetTranslate + velocity);
      velocity *= config.friction;
      
      // Move towards target
      currentTranslate = targetTranslate;
      applyTransform();
      rafId = requestAnimationFrame(animate);
    } else {
      // Animation complete
      velocity = 0;
      currentTranslate = targetTranslate;
      applyTransform();
      rafId = null;
    }
  }
  
  // Start animation if not already running
  function startAnimation() {
    if (!rafId) {
      rafId = requestAnimationFrame(animate);
    }
  }
  
  // Stop any running animation
  function stopAnimation() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  
  // Reset all drag state
  function resetDragState() {
    isDragging = false;
    swipeDirection = null;
    velocityHistory = [];
    lastTouchX = 0;
    lastTouchTime = 0;
  }
  
  // Mouse events
  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.tagName === 'VIDEO') return;
    
    // Stop any existing momentum
    stopAnimation();
    velocity = 0;
    velocityHistory = [];
    
    isDragging = true;
    startX = e.pageX;
    dragStartTranslate = currentTranslate;
    lastTouchX = e.pageX;
    lastTouchTime = performance.now();
    
    track.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    startAnimation();
    e.preventDefault();
  }
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    const x = e.pageX;
    const dx = x - startX;
    const now = performance.now();
    const dt = now - lastTouchTime;
    
    // Calculate and store velocity
    if (dt > 0 && dt < 100) { // Ignore stale samples
      const instantVelocity = (x - lastTouchX) / dt * 16; // Normalize to ~60fps
      velocityHistory.push(clampVelocity(instantVelocity));
      if (velocityHistory.length > config.velocitySamples) {
        velocityHistory.shift();
      }
    }
    
    lastTouchX = x;
    lastTouchTime = now;
    
    // Direct 1:1 movement during drag
    targetTranslate = clamp(dragStartTranslate + dx);
  }
  
  function onMouseUp() {
    if (!isDragging) return;
    
    isDragging = false;
    track.style.cursor = 'grab';
    document.body.style.userSelect = '';
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // Apply smoothed velocity for momentum
    velocity = getSmoothedVelocity();
    velocityHistory = [];
    
    startAnimation();
  }
  
  // Touch events
  let activeTouchId = null;
  
  function onTouchStart(e) {
    // Only handle single touch
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    
    // Stop any existing momentum and reset state
    stopAnimation();
    resetDragState();
    
    activeTouchId = touch.identifier;
    isDragging = true;
    velocity = 0;
    
    startX = touch.pageX;
    startY = touch.pageY;
    dragStartTranslate = currentTranslate;
    lastTouchX = touch.pageX;
    lastTouchTime = performance.now();
    
    startAnimation();
  }
  
  function onTouchMove(e) {
    if (!isDragging || activeTouchId === null) return;
    
    // Find our tracked touch
    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId) {
        touch = e.touches[i];
        break;
      }
    }
    
    if (!touch) return;
    
    const x = touch.pageX;
    const y = touch.pageY;
    const dx = x - startX;
    const dy = y - startY;
    const now = performance.now();
    const dt = now - lastTouchTime;
    
    // Determine swipe direction on first significant movement
    if (swipeDirection === null) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      
      if (absDx > config.directionThreshold || absDy > config.directionThreshold) {
        if (absDx > absDy) {
          swipeDirection = 'horizontal';
        } else {
          swipeDirection = 'vertical';
          // Let browser handle vertical scroll
          isDragging = false;
          return;
        }
      } else {
        // Not enough movement yet, don't do anything
        return;
      }
    }
    
    // Only handle horizontal swipes
    if (swipeDirection !== 'horizontal') return;
    
    e.preventDefault();
    
    // Calculate and store velocity
    if (dt > 0 && dt < 100) {
      const instantVelocity = (x - lastTouchX) / dt * 16;
      velocityHistory.push(clampVelocity(instantVelocity));
      if (velocityHistory.length > config.velocitySamples) {
        velocityHistory.shift();
      }
    }
    
    lastTouchX = x;
    lastTouchTime = now;
    
    // Direct 1:1 movement during drag
    targetTranslate = clamp(dragStartTranslate + dx);
  }
  
  function onTouchEnd(e) {
    // Check if our touch ended
    if (activeTouchId === null) return;
    
    let touchEnded = true;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId) {
        touchEnded = false;
        break;
      }
    }
    
    if (!touchEnded) return;
    
    const wasHorizontal = swipeDirection === 'horizontal';
    
    // Apply momentum only if we were swiping horizontally
    if (wasHorizontal && isDragging) {
      velocity = getSmoothedVelocity();
    } else {
      velocity = 0;
    }
    
    // Reset state
    resetDragState();
    activeTouchId = null;
    
    startAnimation();
  }
  
  // Wheel event
  function onWheel(e) {
    e.preventDefault();
    
    // Stop any existing animation
    stopAnimation();
    velocity = 0;
    
    // Use both deltaX and deltaY
    let delta = e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      delta = e.deltaX;
    }
    
    // Apply wheel movement directly
    targetTranslate = clamp(targetTranslate - delta * config.wheelMultiplier);
    currentTranslate = targetTranslate;
    applyTransform();
  }
  
  // Keyboard navigation
  function onKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      stopAnimation();
      velocity = 0;
      targetTranslate = clamp(targetTranslate - config.keyboardStep);
      currentTranslate = targetTranslate;
      applyTransform();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      stopAnimation();
      velocity = 0;
      targetTranslate = clamp(targetTranslate + config.keyboardStep);
      currentTranslate = targetTranslate;
      applyTransform();
    }
  }
  
  // Lazy load videos
  function checkLazyVideos() {
    const videos = track.querySelectorAll('video[data-src]');
    const wrapperRect = wrapper.getBoundingClientRect();
    
    videos.forEach(video => {
      if (loadedVideos.has(video)) return;
      
      const videoRect = video.getBoundingClientRect();
      const isNearViewport = (
        videoRect.right > wrapperRect.left - 500 &&
        videoRect.left < wrapperRect.right + 500
      );
      
      if (isNearViewport) {
        loadVideo(video);
      }
    });
  }
  
  function loadVideo(video) {
    const src = video.dataset.src;
    if (!src || loadedVideos.has(video)) return;
    
    loadedVideos.add(video);
    video.src = src;
    video.removeAttribute('data-src');
    video.load();
    
    video.addEventListener('loadeddata', () => {
      video.muted = true;
      video.play().catch(() => {});
      setTimeout(updateBounds, 100);
    }, { once: true });
  }
  
  // Wait for media to load
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
    
    if (totalCount === 0) {
      updateBounds();
    }
    
    setTimeout(updateBounds, 500);
    setTimeout(updateBounds, 1500);
  }
  
  // Initialize
  function init() {
    track.style.cursor = 'grab';
    track.style.willChange = 'transform';
    
    // Mouse events
    track.addEventListener('mousedown', onMouseDown);
    
    // Touch events
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
    
    // Wait for media
    waitForMedia();
    updateBounds();
    checkLazyVideos();
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
