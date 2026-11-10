/* Live version of the scattered text artwork used behind the hero and closing links. */
(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const palette = [
    { text: 'WHICH VERSION', color: '#2047ff', font: 'monospace', size: 15 },
    { text: 'OF YOU', color: '#ee3b2d', font: 'Georgia, serif', size: 20 },
    { text: 'IS READING THIS?', color: '#d6e638', font: 'monospace', size: 14 }
  ];

  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function makeClusters(variant) {
    const rng = random(variant === 'hero' ? 1024 : 2026);
    const clusters = [];
    const count = variant === 'hero' ? 19 : 34;
    for (let i = 0; i < count; i++) {
      const x = rng() * 1.12 - .06;
      const spread = variant === 'hero' ? .48 : .86;
      const y = variant === 'hero' ? .49 + rng() * spread : .06 + Math.pow(rng(), .68) * spread;
      clusters.push({
        x, y,
        phase: rng() * Math.PI * 2,
        speed: .55 + rng() * .95,
        drift: 2 + rng() * 11,
        size: .72 + rng() * .48,
        show: [rng() > .22, rng() > .35, rng() > .2]
      });
    }
    // The isolated lines at the edges are part of the composition too.
    clusters.push({ x: .03, y: .1, phase: 0, speed: .7, drift: 4, size: .9, show: [true, false, false] });
    clusters.push({ x: .92, y: .82, phase: 2, speed: .6, drift: 9, size: 1.1, show: [true, true, true] });
    return clusters;
  }

  function mount(element, variant) {
    const canvas = document.createElement('canvas');
    canvas.className = 'phrase-animation-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    element.append(canvas);
    const ctx = canvas.getContext('2d');
    const clusters = makeClusters(variant);
    let width = 0, height = 0, visible = false, lastFrame = 0;

    function resize() {
      const box = element.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    function draw(now) {
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(1.25, Math.max(.65, width / 1138));
      clusters.forEach((cluster, index) => {
        const seconds = now * .001;
        const wave = Math.sin(seconds * cluster.speed + cluster.phase);
        const driftX = wave * cluster.drift * scale;
        const driftY = Math.cos(seconds * cluster.speed * .75 + cluster.phase) * cluster.drift * .55 * scale;
        const anchorX = cluster.x * width + driftX;
        const anchorY = cluster.y * height + driftY;
        palette.forEach((phrase, line) => {
          if (!cluster.show[line]) return;
          const blink = Math.sin(seconds * (1.8 + line * .3) + cluster.phase + line * 1.7);
          if (blink < -.92 && !reducedMotion.matches) return;
          const opacity = reducedMotion.matches ? .88 : .65 + .28 * (blink + 1) / 2;
          const x = anchorX + (line === 1 ? 25 : line === 2 ? 11 : 0) * scale;
          const y = anchorY + line * 21 * scale;
          const fontSize = phrase.size * cluster.size * scale;
          ctx.font = `${line === 1 ? '400' : '700'} ${fontSize}px ${phrase.font}`;
          ctx.fillStyle = phrase.color;
          ctx.globalAlpha = opacity;
          ctx.fillText(phrase.text, x, y);
          // An occasional offset copy gives the words their signal-like movement.
          if (!reducedMotion.matches && index % 5 === 0 && wave > .86) {
            ctx.globalAlpha = .22;
            ctx.fillText(phrase.text, x + 4 * scale, y - 2 * scale);
          }
        });
      });
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden || reducedMotion.matches || now - lastFrame < 33) return;
      lastFrame = now;
      draw(now);
    }

    new ResizeObserver(resize).observe(element);
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) draw(performance.now());
    }, { rootMargin: '100px' }).observe(element);
    reducedMotion.addEventListener('change', () => draw(performance.now()));
    resize();
    requestAnimationFrame(frame);
  }

  const hero = document.querySelector('.hero-glitch-main');
  const ending = document.querySelector('.page-end-glitch');
  if (hero) mount(hero, 'hero');
  if (ending) mount(ending, 'ending');
})();
