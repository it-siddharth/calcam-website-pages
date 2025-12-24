/**
 * Gallery Carousel - Smooth Horizontal Scroll
 * Supports mouse drag, touch, wheel, and keyboard navigation
 */

(function() {
  'use strict';
  
  const track = document.getElementById('carousel-track');
  const scrollHint = document.getElementById('scroll-hint');
  
  if (!track) return;
  
  // State
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;
  let currentTranslate = 0;
  let velocity = 0;
  let lastX = 0;
  let lastTime = 0;
  let animationId = null;
  let hasScrolled = false;
  
  // Configuration
  const config = {
    friction: 0.92,
    wheelMultiplier: 2.5,
    minVelocity: 0.5,
    touchMultiplier: 1,
    keyboardStep: 300,
    maxTranslate: 0,
    minTranslate: 0
  };
  
  // Calculate bounds
  function updateBounds() {
    const trackWidth = track.scrollWidth;
    const viewportWidth = track.parentElement.offsetWidth;
    config.minTranslate = -(trackWidth - viewportWidth + 50);
    config.maxTranslate = 0;
  }
  
  // Apply transform with bounds
  function setTranslate(value) {
    currentTranslate = Math.max(config.minTranslate, Math.min(config.maxTranslate, value));
    track.style.transform = `translateX(${currentTranslate}px)`;
    
    // Hide scroll hint after first scroll
    if (!hasScrolled && Math.abs(currentTranslate) > 50) {
      hasScrolled = true;
      if (scrollHint) {
        scrollHint.classList.add('hidden');
      }
    }
  }
  
  // Momentum animation
  function animate() {
    if (Math.abs(velocity) > config.minVelocity) {
      setTranslate(currentTranslate + velocity);
      velocity *= config.friction;
      animationId = requestAnimationFrame(animate);
    } else {
      velocity = 0;
    }
  }
  
  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    velocity = 0;
  }
  
  // Mouse events
  function onMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    
    isDragging = true;
    stopAnimation();
    startX = e.pageX;
    scrollLeft = currentTranslate;
    lastX = e.pageX;
    lastTime = Date.now();
    
    track.style.cursor = 'grabbing';
    track.style.transition = 'none';
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    e.preventDefault();
  }
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    const x = e.pageX;
    const dx = x - startX;
    
    // Calculate velocity
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocity = (x - lastX) / dt * 16; // Normalize to ~60fps
    }
    lastX = x;
    lastTime = now;
    
    setTranslate(scrollLeft + dx);
  }
  
  function onMouseUp() {
    isDragging = false;
    track.style.cursor = 'grab';
    track.style.transition = 'transform 0.05s ease-out';
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // Start momentum if there's velocity
    if (Math.abs(velocity) > config.minVelocity) {
      animate();
    }
  }
  
  // Touch events
  function onTouchStart(e) {
    isDragging = true;
    stopAnimation();
    startX = e.touches[0].pageX;
    scrollLeft = currentTranslate;
    lastX = e.touches[0].pageX;
    lastTime = Date.now();
    
    track.style.transition = 'none';
  }
  
  function onTouchMove(e) {
    if (!isDragging) return;
    
    const x = e.touches[0].pageX;
    const dx = x - startX;
    
    // Calculate velocity
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocity = (x - lastX) / dt * 16 * config.touchMultiplier;
    }
    lastX = x;
    lastTime = now;
    
    setTranslate(scrollLeft + dx);
  }
  
  function onTouchEnd() {
    isDragging = false;
    track.style.transition = 'transform 0.05s ease-out';
    
    // Start momentum if there's velocity
    if (Math.abs(velocity) > config.minVelocity) {
      animate();
    }
  }
  
  // Wheel event
  function onWheel(e) {
    // Prevent default vertical scroll
    e.preventDefault();
    
    stopAnimation();
    
    // Use deltaY for horizontal scrolling (natural scroll direction)
    const delta = -e.deltaY * config.wheelMultiplier;
    
    // Smooth transition for wheel
    track.style.transition = 'transform 0.15s ease-out';
    setTranslate(currentTranslate + delta);
    
    // Reset transition after animation
    setTimeout(() => {
      track.style.transition = 'transform 0.05s ease-out';
    }, 150);
  }
  
  // Keyboard navigation
  function onKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      stopAnimation();
      track.style.transition = 'transform 0.3s ease-out';
      setTranslate(currentTranslate - config.keyboardStep);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      stopAnimation();
      track.style.transition = 'transform 0.3s ease-out';
      setTranslate(currentTranslate + config.keyboardStep);
    }
  }
  
  // Initialize
  function init() {
    updateBounds();
    
    // Mouse events
    track.addEventListener('mousedown', onMouseDown);
    
    // Touch events
    track.addEventListener('touchstart', onTouchStart, { passive: true });
    track.addEventListener('touchmove', onTouchMove, { passive: true });
    track.addEventListener('touchend', onTouchEnd);
    
    // Wheel event
    track.parentElement.addEventListener('wheel', onWheel, { passive: false });
    
    // Keyboard
    document.addEventListener('keydown', onKeyDown);
    
    // Resize
    window.addEventListener('resize', updateBounds);
    
    // Prevent context menu during drag
    track.addEventListener('contextmenu', (e) => {
      if (isDragging) e.preventDefault();
    });
    
    // Initialize videos - play on hover
    const videos = track.querySelectorAll('video');
    videos.forEach(video => {
      video.addEventListener('mouseenter', () => video.play());
      video.addEventListener('mouseleave', () => video.pause());
    });
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Recalculate bounds after images load
  window.addEventListener('load', updateBounds);
})();

