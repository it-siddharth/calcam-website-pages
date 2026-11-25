/*
 * Rejected iteration gallery, adapted from Siddharth's original experiments:
 * Webcam_Green-Text_Working (threshold blocks and floating messages),
 * Webcam_PixelContour_Words_Working (brightness-gated word grids),
 * Webcam_Test_Ascii_Archive_0.2 (character-density mapping).
 * The installation recording supplies motion if camera access is unavailable.
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
  const cameraStatus = document.createElement('p');
  cameraStatus.className = 'iteration-status';
  cameraStatus.setAttribute('role', 'status');
  stage.append(cameraStatus);
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
  // Match the stage aspect ratio so the live image is never stretched.
  sample.width = 192;
  sample.height = 108;
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  const recording = document.createElement('video');
  recording.muted = true;
  recording.loop = true;
  recording.playsInline = true;
  recording.preload = 'auto';
  recording.src = 'assets/videos/IMG_6065-720p.mp4?v=2';
  recording.className = 'iteration-input-video';
  recording.setAttribute('aria-hidden', 'true');
  stage.append(recording);
  const live = document.createElement('video');
  live.className = 'iteration-input-video';
  live.muted = true;
  live.playsInline = true;
  live.setAttribute('aria-hidden', 'true');
  stage.append(live);
  let input = recording;
  let stream = null;
  let startingCamera = false;
  let cameraDismissed = false;
  let mode = 0;
  let visible = false;
  let frame = 0;
  let scheduledFrame = 0;
  let scheduledInput = null;
  let videoFrameSchedule = false;
  const words = [
    'DO YOU KNOW YOU?', 'ARE YOU LOOKING?', 'LIVING GHOST',
    'CAN YOU SEE ME?', 'DO YOU EXIST?', 'WATCHING YOU',
    'WHO ARE YOU NOW?', 'WHO COULD YOU BE?', 'I SEE YOU',
    'STILL BECOMING', 'LOOK AGAIN', 'WHAT DO YOU SEE?',
    'A VERSION OF YOU', 'YOU ARE HERE', 'MAKE A CHOICE'
  ];
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
      'Scattered text field on a black background'
    ][mode]);
    render(performance.now());
  }
  buttons.forEach((button, i) => button.addEventListener('click', () => setMode(i)));

  async function useCamera() {
    if (stream || startingCamera) return;
    startingCamera = true;
    cameraButton.textContent = 'STARTING CAMERA…';
    cameraStatus.textContent = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      live.srcObject = stream;
      await live.play();
      input = live;
      recording.pause();
      scheduleFrame();
      cameraButton.textContent = 'USE RECORDING';
      cameraButton.setAttribute('aria-pressed', 'true');
      cameraStatus.textContent = '';
    } catch (error) {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      stream = null;
      live.srcObject = null;
      input = recording;
      if (visible) recording.play().catch(() => {});
      scheduleFrame();
      cameraButton.textContent = 'RETRY CAMERA';
      cameraStatus.textContent = error?.name === 'NotAllowedError'
        ? 'RECORDING PREVIEW · CAMERA PERMISSION DENIED'
        : 'RECORDING PREVIEW · CAMERA UNAVAILABLE';
      console.warn('Iteration camera unavailable:', error);
    } finally {
      startingCamera = false;
    }
  }

  function toggleCamera() {
    if (stream) {
      cameraDismissed = true;
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      live.pause();
      live.srcObject = null;
      input = recording;
      cameraButton.textContent = 'USE CAMERA';
      cameraButton.setAttribute('aria-pressed', 'false');
      cameraStatus.textContent = 'RECORDING PREVIEW';
      if (visible) recording.play().catch(() => {});
      scheduleFrame();
      return;
    }
    cameraDismissed = false;
    useCamera();
  }
  cameraButton.addEventListener('click', toggleCamera);
  window.addEventListener('pagehide', () => { if (stream) stream.getTracks().forEach((track) => track.stop()); });

  function buildMask(t) {
    const mask = new Uint8Array(sample.width * sample.height);
    const isLive = input !== recording;
    if (input.readyState >= 2) {
      try {
        sampleCtx.clearRect(0, 0, sample.width, sample.height);
        // Fill the stage with a centered crop of the complete camera frame.
        const sourceWidth = input.videoWidth;
        const sourceHeight = input.videoHeight;
        const sourceAspect = sourceWidth / sourceHeight;
        const targetAspect = sample.width / sample.height;
        const cropWidth = sourceAspect > targetAspect ? sourceHeight * targetAspect : sourceWidth;
        const cropHeight = sourceAspect > targetAspect ? sourceHeight : sourceWidth / targetAspect;
        const cropX = (sourceWidth - cropWidth) / 2;
        const cropY = (sourceHeight - cropHeight) * 0.35;
        sampleCtx.save();
        if (isLive) {
          sampleCtx.translate(sample.width, 0);
          sampleCtx.scale(-1, 1);
        }
        sampleCtx.drawImage(input, cropX, cropY, cropWidth, cropHeight,
          0, 0, sample.width, sample.height);
        sampleCtx.restore();
        const data = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
        const brightness = new Uint8Array(mask.length);
        let borderTotal = 0, borderCount = 0, centerTotal = 0, centerCount = 0;
        for (let i = 0; i < mask.length; i++) {
          const p = i * 4;
          const r = data[p], g = data[p + 1], b = data[p + 2];
          if (!isLive) {
            mask[i] = g > 80 && g > r * 1.15 && g > b * 1.1 ? 255 : 0;
            continue;
          }
          const value = (r + g + b) / 3;
          brightness[i] = value;
          const x = i % sample.width, y = Math.floor(i / sample.width);
          if (x < 24 || x >= sample.width - 24 || y < 12 || y >= sample.height - 12) {
            borderTotal += value;
            borderCount++;
          } else if (x >= 48 && x < 144 && y >= 18 && y < 90) {
            centerTotal += value;
            centerCount++;
          }
        }
        if (isLive) {
          const border = borderTotal / borderCount;
          const center = centerTotal / centerCount;
          const threshold = Math.abs(center - border) >= 12 ? (center + border) / 2 : 105;
          const personIsDarker = center < border || Math.abs(center - border) < 12;
          for (let i = 0; i < mask.length; i++) {
            const x = i % sample.width;
            const contrast = personIsDarker ? threshold - brightness[i] : brightness[i] - threshold;
            const detail = x > 0 ? Math.abs(brightness[i] - brightness[i - 1]) : 0;
            mask[i] = clamp(Math.round(contrast * 5 + detail * 1.5 - 20), 0, 255);
          }
        }
        return mask;
      } catch (_) { /* Draw the built-in silhouette if a frame cannot be sampled. */ }
    }
    // A code-generated placeholder keeps the gallery alive while video loads.
    for (let y = 0; y < sample.height; y++) for (let x = 0; x < sample.width; x++) {
      const sway = Math.sin(t * .0016) * 3;
      const head = ((x - 96 - sway) / 22) ** 2 + ((y - 31) / 24) ** 2 < 1;
      const body = ((x - 96 - sway) / 49) ** 2 + ((y - 104) / 64) ** 2 < 1;
      const arm = x > 35 && x < 88 && y > 55 && y < 70;
      mask[y * sample.width + x] = head || body || arm ? 255 : 0;
    }
    return mask;
  }

  function drawMessages(t, white = false) {
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    const positions = [
      [185, 28], [520, 24], [612, 69], [318, 135], [686, 245],
      [476, 355], [73, 316], [34, 44], [335, 48], [52, 115],
      [562, 132], [384, 192], [45, 230], [542, 281],
      [237, 262], [91, 380], [336, 406], [620, 406],
      [644, 178], [252, 352]
    ];
    positions.forEach(([x, y], i) => {
      const flicker = Math.sin(t * .0011 + i * 1.71);
      ctx.globalAlpha = .68 + .3 * Math.max(0, flicker);
      ctx.fillStyle = white ? ['#aa3f63', '#615f61', '#8a913f'][i % 3] : palette[i % palette.length];
      ctx.fillText(words[i % words.length], x, y);
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function render(t) {
    frame++;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 804, 452);
    const mask = buildMask(t);
    const cols = sample.width, rows = sample.height;
    // The source experiments use thresholded blocks and brightness-gated text.
    const width = 804, height = 452;
    if (mode < 2) {
      const step = mode === 0 ? 3 : 2;
      ctx.fillStyle = mode === 0 ? '#00fb28' : '#e2dfe4';
      for (let y = 0; y < rows; y += step) for (let x = 0; x < cols; x += step) {
        const strength = mask[y * cols + x] / 255;
        if (strength < .12) continue;
        const px = x / cols * width, py = y / rows * height;
        ctx.globalAlpha = .25 + .75 * strength;
        ctx.fillRect(Math.floor(px), Math.floor(py), step / cols * width * .72, step / rows * height * .72);
      }
      ctx.globalAlpha = 1;
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
        const on = mask[ny * cols + nx] / 255;
        const seed = (x * 17 + y * 29) % 13;
        if (on < .12 && seed > 4) continue;
        ctx.fillStyle = ['#f86ad6', '#edc66a', '#a9d78e', '#e4a6bd'][(seed + frame / 18 | 0) % 4];
        ctx.globalAlpha = on >= .12 ? .35 + .55 * on : .28;
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
        const strength = mask[sy * cols + sx] / 255;
        if (strength < .12) continue;
        const index = ((x / cellW | 0) + (y / cellH | 0) * 3 + Math.floor(t / 240)) % phrase.length;
        ctx.fillStyle = blueOnly ? '#203bff' : ((x / cellW + y / cellH | 0) % 3 === 0 ? '#f34a28' : '#2549e9');
        ctx.globalAlpha = .3 + .7 * strength;
        ctx.fillText(phrase[index], x, y);
      }
      ctx.globalAlpha = 1;
      if (mode === 3) {
        ctx.fillStyle = '#9b7e84';
        ctx.font = '9px "JetBrains Mono", monospace';
        for (let i = 0; i < 22; i++) ctx.fillText(words[i % words.length], (i * 83) % 804, (i * 97) % 452);
      }
    }
  }

  function cancelFrame() {
    if (scheduledFrame) {
      if (videoFrameSchedule) scheduledInput.cancelVideoFrameCallback(scheduledFrame);
      else cancelAnimationFrame(scheduledFrame);
    }
    scheduledFrame = 0;
    scheduledInput = null;
  }

  function scheduleFrame() {
    cancelFrame();
    if (!visible) return;
    const source = input;
    videoFrameSchedule = typeof source.requestVideoFrameCallback === 'function';
    scheduledInput = source;
    if (videoFrameSchedule) {
      scheduledFrame = source.requestVideoFrameCallback(() => {
        scheduledFrame = 0;
        if (!visible || input !== source) return;
        render(performance.now());
        scheduleFrame();
      });
    } else {
      scheduledFrame = requestAnimationFrame((t) => {
        scheduledFrame = 0;
        if (!visible || input !== source) return;
        render(t);
        scheduleFrame();
      });
    }
  }
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) {
      if (input === recording) recording.play().catch(() => {});
      if (!cameraDismissed) useCamera();
      render(performance.now());
      scheduleFrame();
    } else {
      recording.pause();
      cancelFrame();
    }
  }, { rootMargin: '200px' });
  observer.observe(stage);
  recording.load();
  render(0);
})();
