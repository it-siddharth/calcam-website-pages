/* One-at-a-time playback for the horizontal installation setup gallery. */
(function () {
  'use strict';

  const gallery = document.querySelector('.setup-videos-grid');
  if (!gallery) return;

  const items = Array.from(gallery.querySelectorAll('.setup-video-item'));
  const videos = items.map(item => item.querySelector('video'));
  if (!items.length || videos.some(video => !video)) return;

  let activeIndex = 0;
  let inView = false;

  function pauseOthers(index) {
    videos.forEach((video, i) => {
      if (i !== index && !video.paused) video.pause();
    });
  }

  function loadAndPlay(index) {
    const video = videos[index];
    if (!video || !inView || document.hidden) return;
    pauseOthers(index);

    if (video.dataset.src) {
      video.src = video.dataset.src;
      video.removeAttribute('data-src');
      video.load();
    }
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.play().catch(() => {});
    }
  }

  function bringIntoView(index) {
    const item = items[index];
    const galleryBox = gallery.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const left = gallery.scrollLeft + itemBox.left - galleryBox.left - (gallery.clientWidth - itemBox.width) / 2;
    gallery.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }

  function activate(index, scroll = true, restart = true) {
    activeIndex = (index + items.length) % items.length;
    items.forEach((item, i) => {
      const active = i === activeIndex;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
      if (!active) videos[i].pause();
    });
    const activeVideo = videos[activeIndex];
    if (restart && activeVideo.readyState > 0) {
      try { activeVideo.currentTime = 0; } catch (_) {}
    }
    loadAndPlay(activeIndex);
    if (scroll) requestAnimationFrame(() => bringIntoView(activeIndex));
  }

  items.forEach((item, index) => {
    const video = videos[index];
    video.loop = false;
    video.removeAttribute('autoplay');
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('canplay', () => {
      if (index === activeIndex && inView && !document.hidden) video.play().catch(() => {});
    });
    video.addEventListener('ended', () => {
      if (index === activeIndex) activate(index + 1);
    });
    video.addEventListener('play', () => {
      if (index !== activeIndex || !inView || document.hidden) video.pause();
      else pauseOthers(index);
    });
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `Play ${item.querySelector('.setup-video-label')?.textContent || `setup clip ${index + 1}`}`);
    item.addEventListener('click', () => activate(index));
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate(index);
      }
    });
  });

  activate(0, false, false);
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) loadAndPlay(activeIndex);
    else videos.forEach(video => video.pause());
  }, { threshold: 0.25 }).observe(gallery);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
    else loadAndPlay(activeIndex);
  });
})();
