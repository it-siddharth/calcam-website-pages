(() => {
  const overview = document.querySelector('#overview');
  const track = document.querySelector('.story-cards');
  const cards = Array.from(track?.querySelectorAll('.story-card') || []);
  const details = new Map(Array.from(document.querySelectorAll('.detail')).map(detail => [detail.id, detail]));
  const previous = document.querySelector('.card-prev');
  const next = document.querySelector('.card-next');
  const count = document.querySelector('.card-count');
  if (!overview || !track || !cards.length || !previous || !next || !count) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phoneLayout = window.matchMedia('(max-width: 650px)');
  const motionStyles = getComputedStyle(document.documentElement);
  const openDuration = parseFloat(motionStyles.getPropertyValue('--story-open-duration')) || 370;
  const closeDuration = parseFloat(motionStyles.getPropertyValue('--story-close-duration')) || 250;
  const carouselDuration = parseFloat(motionStyles.getPropertyValue('--story-carousel-duration')) || 500;
  let current = 0;
  let active = null;
  let busy = false;
  let rotating = false;
  let queuedTurn = 0;

  function placeCard(card, offset) {
    card.dataset.carouselOffset = String(offset);
    card.style.setProperty('--card-x', offset * 100 + '%');
    card.style.setProperty('--card-z', -Math.abs(offset) * 50 + 'px');
    card.style.setProperty('--card-turn', offset * 24 + 'deg');
    card.classList.toggle('is-current', offset === 0);
    card.classList.toggle('is-neighbor', Math.abs(offset) === 1);
    card.classList.toggle('is-far', Math.abs(offset) > 1);
    card.tabIndex = offset !== 0 ? -1 : 0;
  }

  function updateCardControls(index, farOffset = 2) {
    current = (index + cards.length) % cards.length;
    count.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
    previous.disabled = false;
    next.disabled = false;
    cards.forEach((card, cardIndex) => {
      let offset = (cardIndex - current + cards.length) % cards.length;
      if (offset > cards.length / 2) offset -= cards.length;
      if (Math.abs(offset) === cards.length / 2) offset = farOffset;
      placeCard(card, offset);
    });
  }

  function goToCard(index) {
    track.classList.add('carousel-instant');
    updateCardControls(index);
    void track.offsetWidth;
    track.classList.remove('carousel-instant');
  }

  function rotate(direction) {
    if (rotating) {
      queuedTurn = direction;
      return;
    }
    if (reducedMotion.matches) {
      goToCard(current + direction);
      return;
    }
    rotating = true;
    const entering = cards[(current + direction * 2 + cards.length * 2) % cards.length];
    entering.classList.add('carousel-instant');
    placeCard(entering, direction * 2);
    void entering.offsetWidth;
    entering.classList.remove('carousel-instant');
    requestAnimationFrame(() => updateCardControls(current + direction, -direction * 2));
    setTimeout(() => {
      rotating = false;
      if (queuedTurn) {
        const turn = queuedTurn;
        queuedTurn = 0;
        rotate(turn);
      }
    }, carouselDuration);
  }

  previous.addEventListener('click', () => rotate(-1));
  next.addEventListener('click', () => rotate(1));
  phoneLayout.addEventListener('change', () => goToCard(current));

  let pointerStart = null;
  let suppressClick = false;
  track.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  track.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    suppressClick = true;
    rotate(dx < 0 ? 1 : -1);
    setTimeout(() => { suppressClick = false; }, 400);
  });
  track.addEventListener('pointercancel', () => { pointerStart = null; });
  track.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);
  track.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const target = cards[(current + direction + cards.length) % cards.length];
    rotate(direction);
    target.focus({ preventScroll: true });
  });

  function cardFor(id) {
    return cards.find(card => card.hash === '#' + id);
  }

  function pauseInactiveMedia(playActive = true) {
    for (const detail of details.values()) {
      if (detail !== active || !playActive) detail.querySelectorAll('video').forEach(video => video.pause());
    }
    if (playActive) active?.querySelectorAll('video[autoplay]').forEach(video => video.play().catch(() => {}));
  }

  function focusDetail(detail) {
    const heading = detail.querySelector('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  function waitForFade(element, duration) {
    return new Promise(resolve => {
      const finish = () => {
        clearTimeout(fallback);
        element.removeEventListener('transitionend', onEnd);
        resolve();
      };
      const onEnd = event => {
        if (event.target === element && event.propertyName === 'opacity') finish();
      };
      const fallback = setTimeout(finish, duration + 80);
      element.addEventListener('transitionend', onEnd);
    });
  }

  async function openDetail(id, animate = true) {
    if (busy || !details.has(id) || active?.id === id) return;
    const detail = details.get(id);
    const card = cardFor(id);
    busy = true;
    goToCard(cards.indexOf(card));

    if (active) {
      active.classList.remove('is-active', 'is-opening', 'is-closing');
      active.inert = true;
      active.setAttribute('aria-hidden', 'true');
      active = detail;
      detail.classList.add('is-active');
      detail.inert = false;
      detail.setAttribute('aria-hidden', 'false');
      detail.querySelector('.detail-panel').scrollTop = 0;
      overview.classList.add('is-hidden');
      overview.inert = true;
      overview.setAttribute('aria-hidden', 'true');
      pauseInactiveMedia();
      focusDetail(detail);
      busy = false;
      return;
    }

    const transitioning = animate && !reducedMotion.matches;
    if (transitioning) detail.dataset.transitioning = 'true';
    detail.classList.add('is-active');
    if (transitioning) detail.classList.add('is-opening');
    detail.inert = false;
    detail.setAttribute('aria-hidden', 'false');
    detail.querySelector('.detail-panel').scrollTop = 0;
    active = detail;
    pauseInactiveMedia(false);

    if (transitioning) {
      // Commit the hidden start state before changing classes on the next frame.
      void detail.offsetWidth;
      requestAnimationFrame(() => {
        detail.classList.remove('is-opening');
        overview.classList.add('is-leaving');
      });
      await waitForFade(detail.querySelector('.detail-panel'), openDuration);
    }

    overview.classList.add('is-hidden');
    overview.inert = true;
    overview.setAttribute('aria-hidden', 'true');
    delete detail.dataset.transitioning;
    detail.dispatchEvent(new Event('what-detail-opened', { bubbles: true }));
    pauseInactiveMedia();
    focusDetail(detail);
    busy = false;
  }

  async function closeDetail(animate = true) {
    if (busy || !active) return;
    busy = true;
    const detail = active;
    const card = cardFor(detail.id);
    goToCard(cards.indexOf(card));
    overview.classList.remove('is-hidden');
    overview.inert = false;
    overview.setAttribute('aria-hidden', 'false');

    if (animate && !reducedMotion.matches) {
      void overview.offsetWidth;
      detail.classList.add('is-closing');
      requestAnimationFrame(() => overview.classList.remove('is-leaving'));
      await Promise.all([
        waitForFade(detail.querySelector('.detail-panel'), closeDuration),
        new Promise(resolve => setTimeout(resolve, closeDuration))
      ]);
    } else {
      overview.classList.remove('is-leaving');
    }

    detail.classList.remove('is-active', 'is-closing');
    detail.inert = true;
    detail.setAttribute('aria-hidden', 'true');
    active = null;
    pauseInactiveMedia();
    card.focus({ preventScroll: true });
    busy = false;
  }

  function routeFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (details.has(id)) openDetail(id, false);
    else closeDetail(false);
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const id = link.hash.slice(1);
      if (id !== 'overview' && !details.has(id)) return;
      event.preventDefault();
      if (busy) return;
      if (link.classList.contains('story-card') && link !== cards[current]) {
        rotate(Number(link.dataset.carouselOffset) > 0 ? 1 : -1);
        return;
      }
      if (link.classList.contains('story-card') && rotating) return;
      history.pushState(null, '', '#' + id);
      if (id === 'overview') closeDetail();
      else openDetail(id, cardFor(id) === link && !active);
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active && !busy) {
      event.preventDefault();
      history.pushState(null, '', '#overview');
      closeDetail();
    }
  });
  window.addEventListener('popstate', routeFromHash);
  window.addEventListener('hashchange', routeFromHash);

  for (const detail of details.values()) {
    detail.inert = true;
    detail.setAttribute('aria-hidden', 'true');
  }
  goToCard(0);
  routeFromHash();
})();
