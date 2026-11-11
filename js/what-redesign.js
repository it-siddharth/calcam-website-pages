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
  const duration = 550;
  let current = 0;
  let active = null;
  let busy = false;

  function updateCardControls(index) {
    current = (index + cards.length) % cards.length;
    count.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
    previous.disabled = false;
    next.disabled = false;
    cards.forEach((card, cardIndex) => {
      let offset = (cardIndex - current + cards.length) % cards.length;
      if (offset > cards.length / 2) offset -= cards.length;
      card.style.setProperty('--card-x', offset * 72 + '%');
      card.style.setProperty('--card-z', -Math.abs(offset) * 105 + 'px');
      card.style.setProperty('--card-turn', offset * 50 + 'deg');
      card.classList.toggle('is-current', offset === 0);
      card.classList.toggle('is-neighbor', Math.abs(offset) === 1);
      card.classList.toggle('is-far', Math.abs(offset) > 1);
      card.tabIndex = phoneLayout.matches && offset !== 0 ? -1 : 0;
    });
  }

  function goToCard(index) {
    updateCardControls(index);
  }

  previous.addEventListener('click', () => goToCard(current - 1));
  next.addEventListener('click', () => goToCard(current + 1));
  phoneLayout.addEventListener('change', () => updateCardControls(current));

  let pointerStart = null;
  let suppressClick = false;
  track.addEventListener('pointerdown', event => {
    if (!phoneLayout.matches || event.pointerType === 'mouse') return;
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  track.addEventListener('pointerup', event => {
    if (!pointerStart || !phoneLayout.matches) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    suppressClick = true;
    goToCard(current + (dx < 0 ? 1 : -1));
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
    if (!phoneLayout.matches || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    goToCard(current + (event.key === 'ArrowRight' ? 1 : -1));
    cards[current].focus({ preventScroll: true });
  });

  function cardFor(id) {
    return cards.find(card => card.hash === '#' + id);
  }

  function pauseInactiveMedia() {
    for (const detail of details.values()) {
      if (detail !== active) detail.querySelectorAll('video').forEach(video => video.pause());
    }
    active?.querySelectorAll('video[autoplay]').forEach(video => video.play().catch(() => {}));
  }

  function focusDetail(detail) {
    const heading = detail.querySelector('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  function makeGhost(card, rect) {
    const ghost = document.createElement('div');
    const style = getComputedStyle(card);
    ghost.className = 'card-transition-ghost';
    ghost.style.background = style.backgroundColor;
    ghost.style.color = style.color;
    ghost.style.borderRadius = style.borderRadius;
    Object.assign(ghost.style, {
      top: rect.top + 'px', left: rect.left + 'px',
      width: rect.width + 'px', height: rect.height + 'px'
    });
    ghost.append(card.querySelector('.card-label').cloneNode(true));
    document.body.append(ghost);
    return ghost;
  }

  async function moveGhost(ghost, from, to, reverse = false) {
    const start = {
      top: from.top + 'px', left: from.left + 'px',
      width: from.width + 'px', height: from.height + 'px',
      borderRadius: reverse ? '14px' : '0px'
    };
    const end = {
      top: to.top + 'px', left: to.left + 'px',
      width: to.width + 'px', height: to.height + 'px',
      borderRadius: reverse ? '0px' : '14px'
    };
    try {
      await ghost.animate([start, end], {
        duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards'
      }).finished;
    } catch (_) {
      // The final state still applies if a resize cancels the animation.
    }
    ghost.remove();
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

    const from = card.getBoundingClientRect();
    detail.classList.add('is-active', 'is-opening');
    detail.inert = false;
    detail.setAttribute('aria-hidden', 'false');
    detail.querySelector('.detail-panel').scrollTop = 0;
    const to = detail.querySelector('.detail-panel').getBoundingClientRect();
    active = detail;
    pauseInactiveMedia();

    if (animate && !reducedMotion.matches) {
      const ghost = makeGhost(card, from);
      card.classList.add('is-transition-source');
      requestAnimationFrame(() => {
        detail.classList.remove('is-opening');
        overview.classList.add('is-leaving');
      });
      await moveGhost(ghost, from, to);
      card.classList.remove('is-transition-source');
    } else {
      detail.classList.remove('is-opening');
    }

    overview.classList.add('is-hidden');
    overview.inert = true;
    overview.setAttribute('aria-hidden', 'true');
    focusDetail(detail);
    busy = false;
  }

  async function closeDetail(animate = true) {
    if (busy || !active) return;
    busy = true;
    const detail = active;
    const card = cardFor(detail.id);
    goToCard(cards.indexOf(card));
    overview.classList.remove('is-hidden', 'is-leaving');
    overview.inert = false;
    overview.setAttribute('aria-hidden', 'false');

    if (animate && !reducedMotion.matches) {
      const from = detail.querySelector('.detail-panel').getBoundingClientRect();
      const to = card.getBoundingClientRect();
      const ghost = makeGhost(card, from);
      detail.classList.add('is-closing');
      card.classList.add('is-transition-source');
      await moveGhost(ghost, from, to, true);
      card.classList.remove('is-transition-source');
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
      if (link.classList.contains('story-card') && phoneLayout.matches && link !== cards[current]) {
        goToCard(cards.indexOf(link));
        return;
      }
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
  updateCardControls(0);
  routeFromHash();
})();
