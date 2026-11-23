/*
 * Rejected iteration gallery, adapted from Siddharth's original experiments:
 * Webcam_Green-Text_Working (threshold blocks and floating messages),
 * Webcam_PixelContour_Words_Working (brightness-gated word grids),
 * Webcam_Test_Ascii_Archive_0.2 (character-density mapping).
 * The installation recording supplies motion until a visitor opts into camera.
 */
(() => {
  const gallery = document.querySelector('.rejected');
  if (!gallery) return;

  const previousStage = gallery.querySelector('.rejected-main');
  const thumbStrip = gallery.querySelector('.rejected-thumbs');
  const stage = document.createElement('div');
  stage.className = 'iteration-stage';
  const canvas = document.createElement('canvas');
  canvas.width = 804;
  canvas.height = 452;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Animated code rendering of an early camera silhouette experiment');
  stage.append(canvas);
  const cameraButton = document.createElement('button');
  cameraButton.type = 'button';
  cameraButton.className = 'iteration-camera';
  cameraButton.textContent = 'USE CAMERA';
  cameraButton.setAttribute('aria-label', 'Use your camera for the rejected iteration effects');
  cameraButton.setAttribute('aria-pressed', 'false');
  stage.append(cameraButton);
  previousStage.replaceWith(stage);

  // The old thumbnail video handler lives in what-new.js. Replacing its buttons
  // keeps the same markup and removes those listeners without altering BTS code.
  const buttons = [...thumbStrip.querySelectorAll('button')].map((button) => {
    const fresh = button.cloneNode(true);
    button.replaceWith(fresh);
    return fresh;
  });

  const ctx = canvas.getContext('2d', { alpha: false });
  const sample = document.createElement('canvas');
  sample.width = 174;
  sample.height = 118;
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  const recording = document.createElement('video');
  recording.muted = true;
  recording.loop = true;
  recording.playsInline = true;
  recording.preload = 'auto';
  recording.src = 'assets/videos/IMG_6065-720p.mp4?v=2';
  recording.hidden = true;
  recording.setAttribute('aria-hidden', 'true');
  stage.append(recording);
  let input = recording;
  let stream = null;
  let mode = 0;
  let visible = false;
  let frame = 0;
  let lastTick = 0;
  let raf = 0;
  const words = ['DO YOU KNOW YOU?', 'ARE YOU LOOKING?', 'LIVING GHOST', 'CAN YOU SEE ME?', 'DO YOU EXIST?', 'WATCHING YOU'];
  const palette = ['#f86ad6', '#f1f4fa', '#fb573e', '#f5f5f5', '#fa71dc'];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function setMode(next) {
    mode = next;
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === mode)));
    canvas.setAttribute('aria-label', [
      'Green pixel silhouette with floating messages',
      'Pale pixel silhouette with red messages',
      'Blue text silhouette',
      'RGB text silhouette',
      'Scattered text field on a light background'
    ][mode]);
    render(performance.now());
  }
  buttons.forEach((button, i) => button.addEventListener('click', () => setMode(i)));

  async function toggleCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      input = recording;
      cameraButton.textContent = 'USE CAMERA';
      cameraButton.setAttribute('aria-pressed', 'false');
      if (visible) recording.play().catch(() => {});
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      const live = document.createElement('video');
      live.muted = true;
      live.playsInline = true;
      live.srcObject = stream;
      await live.play();
      input = live;
      recording.pause();
      cameraButton.textContent = 'USE RECORDING';
      cameraButton.setAttribute('aria-pressed', 'true');
    } catch (error) {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      stream = null;
      cameraButton.textContent = 'CAMERA UNAVAILABLE';
      window.setTimeout(() => { if (!stream) cameraButton.textContent = 'USE CAMERA'; }, 2200);
    }
  }
  cameraButton.addEventListener('click', toggleCamera);
  window.addEventListener('pagehide', () => { if (stream) stream.getTracks().forEach((track) => track.stop()); });

  function buildMask(t) {
    const mask = new Uint8Array(sample.width * sample.height);
    const isLive = input !== recording;
    if (input.readyState >= 2) {
      try {
        sampleCtx.clearRect(0, 0, sample.width, sample.height);
        if (isLive) {
          // Original experiments mirrored a thresholded webcam feed.
          sampleCtx.save();
          sampleCtx.translate(sample.width, 0);
          sampleCtx.scale(-1, 1);
          sampleCtx.drawImage(input, 0, 0, sample.width, sample.height);
          sampleCtx.restore();
        } else {
          // Isolate the moving green figure from the installation recording.
          sampleCtx.drawImage(input, 43, 270, 195, 270, 0, 0, sample.width, sample.height);
        }
        const data = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
        for (let i = 0; i < mask.length; i++) {
          const p = i * 4;
          const r = data[p], g = data[p + 1], b = data[p + 2];
          mask[i] = isLive ? Number((r + g + b) / 3 < 105) : Number(g > 80 && g > r * 1.15 && g > b * 1.1);
        }
        return mask;
      } catch (_) { /* Draw the built-in silhouette if a frame cannot be sampled. */ }
    }
    // A code-generated placeholder keeps the gallery alive while video loads.
    for (let y = 0; y < sample.height; y++) for (let x = 0; x < sample.width; x++) {
      const sway = Math.sin(t * .0016) * 3;
      const head = ((x - 82 - sway) / 22) ** 2 + ((y - 35) / 25) ** 2 < 1;
      const body = ((x - 82 - sway) / 49) ** 2 + ((y - 112) / 65) ** 2 < 1;
      const arm = x > 25 && x < 75 && y > 56 && y < 71;
      mask[y * sample.width + x] = Number(head || body || arm);
    }
    return mask;
  }

  function drawMessages(t, white = false) {
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    const positions = [[185, 28], [520, 24], [612, 69], [318, 135], [686, 245], [476, 355], [73, 316]];
    positions.forEach(([x, y], i) => {
      const flicker = Math.sin(t * .0011 + i * 1.71);
      ctx.globalAlpha = .56 + .4 * Math.max(0, flicker);
      ctx.fillStyle = white ? ['#aa3f63', '#615f61', '#8a913f'][i % 3] : palette[i % palette.length];
      ctx.fillText(words[i % words.length], x, y);
    });
    ctx.globalAlpha = 1;
  }

  function render(t) {
    if (t - lastTick < 45 && visible) return;
    lastTick = t;
    frame++;
    ctx.fillStyle = mode === 4 ? '#e9e7df' : mode === 2 ? '#001052' : '#0d1110';
    ctx.fillRect(0, 0, 804, 452);
    const mask = buildMask(t);
    const cols = sample.width, rows = sample.height;
    // The source experiments use thresholded blocks and brightness-gated text.
    const left = mode === 4 ? 85 : mode === 2 ? 133 : 38;
    const top = mode === 4 ? 5 : mode === 2 ? 22 : 67;
    const width = mode === 4 ? 615 : mode === 2 ? 445 : 345;
    const height = mode === 4 ? 425 : mode === 2 ? 420 : 380;
    if (mode < 2) {
      const step = mode === 0 ? 3 : 2;
      ctx.fillStyle = mode === 0 ? '#00fb28' : '#e2dfe4';
      for (let y = 0; y < rows; y += step) for (let x = 0; x < cols; x += step) {
        if (!mask[y * cols + x]) continue;
        const px = left + x / cols * width, py = top + y / rows * height;
        ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(step / cols * width) + .5, Math.ceil(step / rows * height) + .5);
      }
      drawMessages(t);
      if (mode === 0) {
        ctx.fillStyle = 'rgba(0,80,0,.13)';
        for (let y = 3; y < 452; y += 5) ctx.fillRect(0, y, 804, 1);
      }
    } else if (mode === 4) {
      // The light projection used a dense, independent word field.
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textBaseline = 'top';
      for (let y = 8; y < 452; y += 11) for (let x = 8; x < 804; x += 35) {
        const nx = Math.floor(x / 804 * cols), ny = Math.floor(y / 452 * rows);
        const on = mask[ny * cols + nx];
        const seed = (x * 17 + y * 29) % 13;
        if (!on && seed > 4) continue;
        ctx.fillStyle = ['#7d4360', '#8c7340', '#6b7a47', '#a46a7c'][(seed + frame / 18 | 0) % 4];
        ctx.globalAlpha = on ? .82 : .48;
        ctx.fillText(words[(seed + Math.floor(t / 1800)) % words.length], x, y);
      }
      ctx.globalAlpha = 1;
    } else {
      const blueOnly = mode === 2;
      const cellW = blueOnly ? 12 : 16;
      const cellH = blueOnly ? 10 : 12;
      ctx.font = `bold ${blueOnly ? 10 : 11}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';
      const phrase = 'YOU ARE YOUR CHOICES ';
      for (let y = 0; y < height; y += cellH) for (let x = 0; x < width; x += cellW) {
        const sx = clamp(Math.floor(x / width * cols), 0, cols - 1);
        const sy = clamp(Math.floor(y / height * rows), 0, rows - 1);
        if (!mask[sy * cols + sx]) continue;
        const index = ((x / cellW | 0) + (y / cellH | 0) * 3 + Math.floor(t / 240)) % phrase.length;
        ctx.fillStyle = blueOnly ? '#203bff' : ((x / cellW + y / cellH | 0) % 3 === 0 ? '#f34a28' : '#2549e9');
        ctx.fillText(phrase[index], left + x, top + y);
      }
      if (mode === 3) {
        ctx.fillStyle = '#9b7e84';
        ctx.font = '9px "JetBrains Mono", monospace';
        for (let i = 0; i < 11; i++) ctx.fillText(words[i % words.length], (i * 83) % 804, (i * 97) % 452);
      }
    }
  }

  function tick(t) {
    if (!visible) return;
    render(t);
    raf = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) {
      if (input === recording) recording.play().catch(() => {});
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    } else {
      recording.pause();
      cancelAnimationFrame(raf);
    }
  }, { rootMargin: '200px' });
  observer.observe(stage);
  recording.load();
  render(0);
})();
