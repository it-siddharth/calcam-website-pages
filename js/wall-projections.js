import { WebcamProjection } from './webcam-projection.js?v=2';

const previews = [...document.querySelectorAll('.projection-live[data-wall]')].map(view => ({
  view,
  projection: new WebcamProjection(160, 120),
  canvas: view.querySelector('canvas'),
  status: view.querySelector('.projection-live-status'),
  visible: false,
  started: false,
  starting: false
}));

function hash(x, y) {
  let n = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function draw({ projection, canvas, view }, time) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (!width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, width, height);
  const t = time / 1000;
  const points = [];
  const imageWidth = projection.width;
  const imageHeight = projection.height;

  if (projection.isReady()) {
    projection.captureFrame();
    const pixels = projection.imageData?.data;
    if (pixels) {
      let edgeTotal = 0;
      let edgeCount = 0;
      for (let y = 0; y < imageHeight; y += 4) for (let x = 0; x < imageWidth; x += 4) {
        if (x > 15 && x < imageWidth - 15 && y > 12 && y < imageHeight - 12) continue;
        const i = (y * imageWidth + x) * 4;
        edgeTotal += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        edgeCount++;
      }
      const background = edgeTotal / Math.max(1, edgeCount);
      const insetX = 12;
      const insetY = 6;
      for (let y = insetY; y < imageHeight - insetY; y++) for (let x = insetX; x < imageWidth - insetX; x++) {
        const sx = imageWidth - 1 - x;
        const i = (y * imageWidth + sx) * 4;
        const luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        const difference = view.dataset.wall === 'right' ? background - luminance : luminance - background;
        if (difference < 24 || hash(x, y) < .12) continue;
        points.push({
          x: (x - insetX) / (imageWidth - insetX * 2),
          y: (y - insetY) / (imageHeight - insetY * 2),
          strength: Math.min(1, difference / 100)
        });
      }
    }
  }

  if (points.length < 160) {
    // A clearly figurative preview when camera access is unavailable.
    const sway = Math.sin(t * 1.1) * .025;
    for (let y = 0; y < 120; y++) for (let x = 0; x < 165; x++) {
      const nx = x / 165;
      const ny = y / 120;
      const cx = nx - .5 - sway;
      const head = (cx / .09) ** 2 + ((ny - .22) / .15) ** 2 < 1;
      const torso = Math.abs(cx) < .12 + .025 * Math.sin(ny * 5) && ny > .37 && ny < .78;
      const leftArm = Math.abs(cx + .16 + .08 * (ny - .45)) < .035 && ny > .4 && ny < .78;
      const rightArm = Math.abs(cx - .16 + .08 * (ny - .45)) < .035 && ny > .4 && ny < .78;
      const legs = ny >= .76 && ny < 1 && (Math.abs(cx + .06 + .05 * (ny - .76)) < .045 || Math.abs(cx - .06 - .05 * (ny - .76)) < .045);
      if ((head || torso || leftArm || rightArm || legs) && hash(x, y) > .18) points.push({ x: nx, y: ny, strength: .65 + hash(y, x) * .35 });
    }
  }

  points.forEach((point, i) => {
    const jitter = (hash(i, Math.floor(t * 10)) - .5) * 1.2 * ratio;
    const x = point.x * width + jitter;
    const y = point.y * height;
    const alpha = .48 + point.strength * .48;
    const radius = (i % 4 === 0 ? 1.05 : .72) * ratio;
    ctx.fillStyle = `rgba(246,247,250,${alpha})`;
    if (i % 3 === 0) ctx.fillRect(x, y, radius * 1.8, radius * 1.8);
    else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
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
    preview.status.textContent = 'Animated preview · allow camera for your silhouette';
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
  const retry = () => previews.filter(item => item.visible && !item.started).forEach(start);
  document.addEventListener('pointerdown', retry);
  document.addEventListener('keydown', retry);
  let lastFrame = 0;
  function animate(time) {
    requestAnimationFrame(animate);
    if (document.hidden || time - lastFrame < 33) return;
    lastFrame = time;
    previews.filter(item => item.visible).forEach(item => draw(item, time));
  }
  requestAnimationFrame(animate);
  window.addEventListener('pagehide', () => previews.forEach(item => item.projection.dispose()));
}
