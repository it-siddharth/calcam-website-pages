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

// Keep each particle in the same place between frames while breaking up the
// camera's regular sampling grid. Moving the offsets every frame would flicker.
function hash(x, y) {
  let value = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

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
  const sampleSize = Math.min(imageWidth / projection.width, imageHeight / projection.height);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();

  if (projection.isReady()) {
    for (const { x, y } of projection.captureFrame()) {
      const seed = hash(Math.round(x * projection.width), Math.round(y * projection.height));
      const jitterX = ((seed & 255) / 255 - 0.5) * sampleSize * 0.8;
      const jitterY = (((seed >>> 8) & 255) / 255 - 0.5) * sampleSize * 0.8;
      const radius = Math.max(0.8, sampleSize * (0.18 + ((seed >>> 16) & 255) / 255 * 0.13));
      ctx.moveTo(imageLeft + x * imageWidth + jitterX + radius, imageTop + y * imageHeight + jitterY);
      ctx.arc(imageLeft + x * imageWidth + jitterX, imageTop + y * imageHeight + jitterY,
        radius, 0, Math.PI * 2);
    }
  } else {
    // A sparse ambient field while the camera starts or awaits permission.
    const t = time / 1000;
    const right = view.dataset.wall === 'right';
    for (let i = 0; i < 2200; i++) {
      const seed = hash(i, right ? 1 : 0);
      const x = (seed & 65535) / 65535;
      const y = ((seed >>> 16) & 65535) / 65535;
      const shimmer = Math.sin(x * 15 + y * 9 + t * 1.8) * Math.sin(y * 13 - t * 1.2);
      if (shimmer < -0.1) continue;
      const radius = Math.max(0.8, sampleSize * (0.13 + (seed & 7) * 0.018));
      const px = imageLeft + x * imageWidth;
      const py = imageTop + y * imageHeight;
      ctx.moveTo(px + radius, py);
      ctx.arc(px, py, radius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
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
