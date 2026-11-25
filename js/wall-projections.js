import { WebcamProjection } from './webcam-projection.js?v=2';

// Straight-on wall previews using the same webcam sampling as the installation.
const previews = [...document.querySelectorAll('.projection-live[data-wall]')].map(view => {
  const projection = new WebcamProjection(240, 180);
  if (view.dataset.wall === 'right' || projection.isMobile) projection.setSetting('invert', true);
  return {
    view, projection, canvas: view.querySelector('canvas'),
    status: view.querySelector('.projection-live-status'),
    visible: false, started: false, starting: false
  };
});

function draw({ view, projection, canvas }, time) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (!width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, width, height);

  // Cover the wide preview with a proportional camera image. Crop the excess
  // height instead of stretching a person's face and body sideways.
  const aspect = projection.isReady() ? projection.getAspectRatio() : 4 / 3;
  const imageWidth = Math.max(width, height * aspect);
  const imageHeight = imageWidth / aspect;
  const imageLeft = (width - imageWidth) / 2;
  const imageTop = (height - imageHeight) * 0.35;
  const settings = projection.getSettings();
  const square = Math.max(2, Math.round(Math.min(
    imageWidth / projection.width, imageHeight / projection.height
  ) * 0.8));
  ctx.fillStyle = '#fff';

  if (projection.isReady()) {
    for (const { x, y } of projection.captureFrame()) {
      ctx.fillRect(Math.round(imageLeft + x * imageWidth - square / 2),
        Math.round(imageTop + y * imageHeight - square / 2), square, square);
    }
  } else {
    // Same dense, wave-driven square shimmer shown on the walls before capture.
    const baseDensity = projection.isMobile ? 160 : 260;
    const columns = Math.max(40, Math.round(120 * Math.sqrt(settings.pixelDensity / baseDensity)));
    const rows = Math.round(columns * 3 / 4);
    const baseSize = Math.max(2, Math.round(Math.min(
      imageWidth / columns, imageHeight / rows
    ) * 0.8));
    const t = time / 1000;
    const right = view.dataset.wall === 'right';
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const wave1 = Math.sin(t * (right ? 3 : 2.8) + col * (right ? 0.25 : 0.22) + row * (right ? 0.2 : 0.18));
        const wave2 = Math.sin(t * (right ? 2.3 : 2.1) + col * (right ? 0.15 : 0.12) - row * (right ? 0.18 : 0.2));
        const wave3 = Math.sin(t * (right ? 1.8 : 1.6) - col * (right ? 0.1 : 0.08) + row * (right ? 0.12 : 0.14));
        const shimmer = (wave1 * wave2 + wave3 * 0.5) * 0.7;
        if (shimmer <= -0.15) continue;
        const size = Math.max(2, Math.round(baseSize * (0.9 + shimmer * 0.3)));
        ctx.fillRect(Math.round(imageLeft + col / (columns - 1) * imageWidth - size / 2),
          Math.round(imageTop + row / (rows - 1) * imageHeight - size / 2), size, size);
      }
    }
  }
}

async function start(preview) {
  if (preview.started || preview.starting) return;
  preview.starting = true;
  preview.status.textContent = 'Starting webcam projection…';
  const success = await preview.projection.init();
  preview.starting = false;
  if (success) {
    preview.started = true;
    preview.view.classList.add('is-active');
  } else {
    preview.status.textContent = 'Allow camera access to see your projection.';
  }
}

if (previews.length) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const preview = previews.find(item => item.view === entry.target);
      preview.visible = entry.isIntersecting;
      if (preview.visible) start(preview);
    }
  }, { rootMargin: '200px 0px' });
  previews.forEach(preview => observer.observe(preview.view));

  const retry = () => previews.filter(preview => preview.visible && !preview.started).forEach(start);
  document.addEventListener('pointerdown', retry);
  document.addEventListener('keydown', retry);

  let lastFrame = 0;
  function animate(time) {
    requestAnimationFrame(animate);
    if (document.hidden || time - lastFrame < 33) return;
    lastFrame = time;
    previews.filter(preview => preview.visible).forEach(preview => draw(preview, time));
  }
  requestAnimationFrame(animate);
  window.addEventListener('pagehide', () => previews.forEach(preview => preview.projection.dispose()));
}
