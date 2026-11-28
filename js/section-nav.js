(() => {
  const nav = document.querySelector('.section-nav');
  if (!nav) return;

  const trigger = nav.querySelector('.section-nav__trigger');
  const menu = nav.querySelector('.section-nav__menu');
  const links = [...menu.querySelectorAll('a')];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href')));
  const count = nav.querySelector('.section-nav__count');
  const current = nav.querySelector('.section-nav__current');
  let pending = false;
  let closeTimer;

  function setOpen(open) {
    if (open === (trigger.getAttribute('aria-expanded') === 'true')) return;
    clearTimeout(closeTimer);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      menu.hidden = false;
      menu.inert = false;
      menu.classList.remove('is-closing');
      void menu.offsetWidth;
      menu.classList.add('is-open');
    } else {
      menu.inert = true;
      menu.classList.remove('is-open');
      menu.classList.add('is-closing');
      const closeMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 :
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dropdown-close-dur')) || 180;
      closeTimer = setTimeout(() => {
        menu.classList.remove('is-closing');
        menu.hidden = true;
      }, closeMs);
    }
  }

  function update() {
    pending = false;
    const visible = window.scrollY > 80;
    nav.classList.toggle('is-visible', visible);
    nav.inert = !visible;
    if (!visible) setOpen(false);

    const marker = window.innerHeight * .4;
    let active = 0;
    sections.forEach((section, index) => {
      if (section && section.getBoundingClientRect().top <= marker) active = index;
    });
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    count.textContent = `${String(active + 1).padStart(2, '0')} / ${String(links.length).padStart(2, '0')}`;
    current.textContent = links[active].textContent.trim().replace(/^\d+\s*/, '');
  }

  function scheduleUpdate() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  trigger.addEventListener('click', () => setOpen(trigger.getAttribute('aria-expanded') !== 'true'));
  links.forEach((link, index) => link.addEventListener('click', (event) => {
    const section = sections[index];
    if (!section) return;
    event.preventDefault();
    setOpen(false);
    const hash = link.getAttribute('href');
    if (location.hash !== hash) history.pushState(null, '', hash);
    section.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start'
    });
  }));
  document.addEventListener('pointerdown', (event) => {
    if (!nav.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      trigger.focus();
    }
  });
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  nav.querySelector('.section-nav__top').addEventListener('click', (event) => {
    event.preventDefault();
    setOpen(false);
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  update();
})();
