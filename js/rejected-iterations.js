// Five camera-driven studies, rendered from the current video frame on black.
(() => {
  const gallery = document.querySelector('.rejected');
  if (!gallery) return;

  const oldStage = gallery.querySelector('.rejected-main');
  const stage = document.createElement('div');
  stage.className = 'iteration-stage';
  const canvas = document.createElement('canvas');
  canvas.width = 804;
  canvas.height = 452;
  canvas.setAttribute('role', 'img');
  stage.append(canvas);

  const status = document.createElement('p');
  status.className = 'iteration-status';
  status.setAttribute('role', 'status');
  stage.append(status);
  oldStage.replaceWith(stage);

  // Remove the old video-gallery handlers while keeping the button labels.
  const buttons = [...gallery.querySelectorAll('.rejected-thumbs button')].map(button => {
    const fresh = button.cloneNode(false);
    button.replaceWith(fresh);
    return fresh;
  });

  const output = canvas.getContext('2d', { alpha: false });
  let sample;
  let sampleContext;
  let trackingThreshold = null;
  let trackedBounds = null;
  function resetSampler() {
    sample = document.createElement('canvas');
    sample.width = 160;
    sample.height = 90;
    sampleContext = sample.getContext('2d', { willReadFrequently: true });
    trackingThreshold = null;
    trackedBounds = null;
  }
  resetSampler();
  const recording = document.createElement('video');
  recording.src = 'assets/videos/IMG_6065-720p.mp4?v=2';
  recording.loop = true;
  recording.preload = 'auto';
  const camera = document.createElement('video');
  for (const video of [recording, camera]) {
    video.muted = true;
    video.playsInline = true;
    video.className = 'iteration-input-video';
    video.setAttribute('aria-hidden', 'true');
    stage.append(video);
  }

  const names = [
    'Green pixel silhouette with floating questions',
    'White pixel silhouette with floating questions',
    'Blue YOU ARE HERE text silhouette',
    'Red and blue YOU ARE HERE text silhouette',
    'ARE YOU LOOKING and PRESENT text field'
  ];
  const controlSets = [
    { title: '01 / GREEN PIXELS', fields: [
      ['sensitivity', 'Silhouette sensitivity', 0, 50, 1, 0],
      ['pixelSize', 'Pixel size', 1, 6, 1, 3],
      ['textSize', 'Question size', 7, 20, 1, 11],
      ['primary', 'Pixel color', '#9fff3b']
    ] },
    { title: '02 / WHITE PIXELS', fields: [
      ['sensitivity', 'Silhouette sensitivity', 0, 50, 1, 0],
      ['pixelSize', 'Pixel size', 1, 6, 1, 2],
      ['textSize', 'Question size', 7, 20, 1, 11],
      ['primary', 'Pixel color', '#f1eff4']
    ] },
    { title: '03 / BLUE TEXT', fields: [
      ['sensitivity', 'Silhouette sensitivity', 0, 50, 1, 0],
      ['textSize', 'Text size', 5, 18, 1, 7],
      ['spacing', 'Text spacing', 30, 110, 2, 58],
      ['primary', 'Text color', '#6276ff']
    ] },
    { title: '04 / RED + BLUE TEXT', fields: [
      ['sensitivity', 'Silhouette sensitivity', 0, 50, 1, 0],
      ['textSize', 'Text size', 5, 18, 1, 7],
      ['spacing', 'Text spacing', 30, 110, 2, 58],
      ['primary', 'Blue', '#3155ff'],
      ['secondary', 'Red', '#ff6836']
    ] },
    { title: '05 / QUESTION FIELD', fields: [
      ['sensitivity', 'Silhouette sensitivity', 0, 50, 1, 0],
      ['textSize', 'Text size', 6, 20, 1, 8],
      ['spacing', 'Text spacing', 60, 160, 2, 96],
      ['primary', 'Question color', '#d997aa'],
      ['secondary', 'Present color', '#b4be75']
    ] }
  ];
  const settings = controlSets.map(({ fields }) => Object.fromEntries(fields.map(field => [field[0], field.at(-1)])));
  try {
    const saved = JSON.parse(localStorage.getItem('rejected-iteration-settings') || '[]');
    settings.forEach((values, index) => controlSets[index].fields.forEach(field => {
      const [key, , min, max] = field;
      const value = saved[index]?.[key];
      if (typeof min === 'number' && Number.isFinite(value) && value >= min && value <= max) values[key] = value;
      if (typeof min === 'string' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) values[key] = value;
    }));
  } catch (_) { /* Local storage may be disabled in a preview. */ }
  const panels = controlSets.map(({ title, fields }, index) => {
    const panel = document.createElement('section');
    panel.className = 'iteration-settings-panel';
    panel.setAttribute('aria-label', `${title} settings`);
    panel.hidden = index !== 0;
    const heading = document.createElement('div');
    heading.className = 'iteration-settings-heading';
    const label = document.createElement('h3');
    label.textContent = title;
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'RESET';
    reset.setAttribute('aria-label', `Reset ${title} settings`);
    heading.append(label, reset);
    const controls = document.createElement('div');
    controls.className = 'iteration-settings-controls';
    const inputs = {};
    fields.forEach(([key, caption, min, max, step]) => {
      const field = document.createElement('label');
      field.className = 'iteration-settings-field';
      const name = document.createElement('span');
      name.textContent = caption;
      const input = document.createElement('input');
      input.type = typeof min === 'number' ? 'range' : 'color';
      if (input.type === 'range') {
        input.min = min;
        input.max = max;
        input.step = step;
      }
      input.value = settings[index][key];
      const value = document.createElement('output');
      value.textContent = input.type === 'range' ? input.value : '';
      field.append(name, input, value);
      controls.append(field);
      inputs[key] = { input, value };
      input.addEventListener('input', () => {
        settings[index][key] = input.type === 'range' ? Number(input.value) : input.value;
        value.textContent = input.type === 'range' ? input.value : '';
        try { localStorage.setItem('rejected-iteration-settings', JSON.stringify(settings)); } catch (_) {}
        render();
      });
    });
    reset.addEventListener('click', () => {
      fields.forEach(field => {
        const key = field[0];
        settings[index][key] = field.at(-1);
        inputs[key].input.value = settings[index][key];
        inputs[key].value.textContent = inputs[key].input.type === 'range' ? settings[index][key] : '';
      });
      try { localStorage.setItem('rejected-iteration-settings', JSON.stringify(settings)); } catch (_) {}
      render();
    });
    panel.append(heading, controls);
    return panel;
  });
  const settingsContainer = document.createElement('div');
  settingsContainer.className = 'iteration-settings';
  settingsContainer.setAttribute('aria-label', 'Iteration settings');
  settingsContainer.append(...panels);
  gallery.querySelector('.rejected-thumbs').after(settingsContainer);
  let source = recording;
  let stream = null;
  let starting = false;
  let visible = false;
  let mode = 0;
  let animationId = 0;

  function updateControls() {
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === mode)));
    panels.forEach((panel, index) => { panel.hidden = index !== mode; });
    canvas.setAttribute('aria-label', names[mode]);
  }

  function captureFrame() {
    // A file:// recording can taint a canvas permanently. Keep it away from
    // the sampler used by the live MediaStream.
    if (source === recording && location.protocol === 'file:') return null;
    if (source.readyState < 2 || !source.videoWidth || !source.videoHeight) return null;
    const width = sample.width, height = sample.height;
    const aspect = width / height;
    const sourceAspect = source.videoWidth / source.videoHeight;
    const cropWidth = sourceAspect > aspect ? source.videoHeight * aspect : source.videoWidth;
    const cropHeight = sourceAspect > aspect ? source.videoHeight : source.videoWidth / aspect;
    const cropX = (source.videoWidth - cropWidth) / 2;
    const cropY = (source.videoHeight - cropHeight) / 2;
    try {
      sampleContext.setTransform(1, 0, 0, 1, 0, 0);
      sampleContext.clearRect(0, 0, width, height);
      if (source === camera) sampleContext.setTransform(-1, 0, 0, 1, width, 0);
      sampleContext.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
      sampleContext.setTransform(1, 0, 0, 1, 0, 0);
      return sampleContext.getImageData(0, 0, width, height).data;
    } catch (error) {
      status.textContent = 'VIDEO FRAMES CANNOT BE READ IN THIS PREVIEW';
      console.warn('Iteration frame unavailable:', error);
      return null;
    }
  }

  function render() {
    output.fillStyle = '#000';
    output.fillRect(0, 0, canvas.width, canvas.height);
    const pixels = captureFrame();
    if (!pixels) return;
    const tuning = settings[mode];
    const width = sample.width, height = sample.height;
    const luminance = new Float32Array(width * height);
    let borderTotal = 0, borderCount = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x, p = i * 4;
      const value = pixels[p] * .299 + pixels[p + 1] * .587 + pixels[p + 2] * .114;
      luminance[i] = value;
      if (x < 20 || x >= width - 20 || y < 10 || y >= height - 10) {
        borderTotal += value;
        borderCount++;
      }
    }
    const border = borderTotal / borderCount;
    // Keep the same dark-on-light polarity as the original experiments.
    // Smooth the exposure estimate so lighting changes cannot invert a frame.
    const nextThreshold = Math.max(65, Math.min(190, border - 24));
    trackingThreshold = trackingThreshold === null
      ? nextThreshold
      : trackingThreshold * .88 + nextThreshold * .12;
    const strengthAt = (x, y) => {
      const sx = Math.max(0, Math.min(width - 1, x | 0));
      const sy = Math.max(0, Math.min(height - 1, y | 0));
      const i = sy * width + sx;
      if (source === recording) {
        const p = i * 4, red = pixels[p], green = pixels[p + 1], blue = pixels[p + 2];
        return green > 75 && green > red * 1.12 && green > blue * 1.08 ? 1 : 0;
      }
      return Math.max(0, Math.min(1, (trackingThreshold + tuning.sensitivity - luminance[i]) / 55));
    };

    let left = width, top = height, right = 0, bottom = 0, active = 0;
    for (let y = 5; y < height - 5; y += 2) for (let x = 8; x < width - 8; x += 2) {
      if (strengthAt(x, y) < .35) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      active++;
    }
    if (active > 60) {
      const next = { left, top, right, bottom };
      trackedBounds = trackedBounds
        ? Object.fromEntries(Object.keys(next).map(key => [key, trackedBounds[key] * .45 + next[key] * .55]))
        : next;
    } else {
      trackedBounds = null;
    }
    const bounds = trackedBounds;

    output.textBaseline = 'top';
    if (mode < 2) {
      const step = tuning.pixelSize;
      const cellWidth = canvas.width * step / width;
      const cellHeight = canvas.height * step / height;
      output.fillStyle = tuning.primary;
      for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
        const strength = strengthAt(x, y);
        if (strength < .2) continue;
        output.globalAlpha = .45 + strength * .55;
        output.fillRect(x / width * canvas.width, y / height * canvas.height, cellWidth + .5, cellHeight + .5);
      }
      output.globalAlpha = 1;
      const questions = mode === 0
        ? ['LIVING GHOST', 'DO YOU KNOW YOU?', 'ARE YOU LOOKING?', 'CAN YOU SEE ME?', 'DO YOU KNOW YOU?']
        : ['are you here?', 'which version of you?', 'are you here?', 'which version of you?'];
      output.font = `bold ${tuning.textSize}px "JetBrains Mono", monospace`;
      const anchors = [[.05,.08],[.58,.15],[.25,.3],[.55,.43],[.06,.56],[.64,.67],[.2,.8],[.52,.91]];
      for (let i = 0; bounds && i < anchors.length; i++) {
        const x = (bounds.left + (bounds.right - bounds.left) * anchors[i][0]) / width * canvas.width;
        const y = (bounds.top + (bounds.bottom - bounds.top) * anchors[i][1]) / height * canvas.height;
        output.fillStyle = mode === 0
          ? ['#f86ad6', '#f3f3f3', '#fb573e'][i % 3]
          : ['#fb783b', '#f2c7db', '#f1f1f1'][i % 3];
        output.fillText(questions[i % questions.length], x, y);
      }
      if (mode === 0) {
        output.fillStyle = 'rgba(0, 90, 0, .12)';
        for (let y = 0; y < canvas.height; y += 5) output.fillRect(0, y, canvas.width, 1);
      }
    } else if (mode < 4) {
      output.font = `bold ${tuning.textSize}px "JetBrains Mono", monospace`;
      const xStart = bounds ? bounds.left / width * canvas.width : canvas.width;
      const xEnd = bounds ? bounds.right / width * canvas.width : 0;
      const yStart = bounds ? bounds.top / height * canvas.height : canvas.height;
      const yEnd = bounds ? bounds.bottom / height * canvas.height : 0;
      for (let y = yStart; y <= yEnd; y += Math.max(tuning.textSize + 3, tuning.spacing / 5.8)) for (let x = xStart; x <= xEnd; x += tuning.spacing) {
        const strength = strengthAt(x / canvas.width * width, y / canvas.height * height);
        if (strength < .2) continue;
        output.fillStyle = mode === 2 ? tuning.primary : ((Math.round((x - xStart) / tuning.spacing) + Math.round((y - yStart) / Math.max(tuning.textSize + 3, tuning.spacing / 5.8))) % 2 ? tuning.primary : tuning.secondary);
        output.globalAlpha = .4 + strength * .6;
        output.fillText('YOU ARE HERE', x, y);
      }
    } else {
      output.font = `bold ${tuning.textSize}px "JetBrains Mono", monospace`;
      const xStart = bounds ? bounds.left / width * canvas.width : canvas.width;
      const xEnd = bounds ? bounds.right / width * canvas.width : 0;
      const yStart = bounds ? bounds.top / height * canvas.height : canvas.height;
      const yEnd = bounds ? bounds.bottom / height * canvas.height : 0;
      const rowGap = Math.max(tuning.textSize + 6, tuning.spacing * 14 / 96);
      for (let y = yStart; y <= yEnd; y += rowGap) for (let x = xStart; x <= xEnd; x += tuning.spacing) {
        const strength = strengthAt(x / canvas.width * width, y / canvas.height * height);
        if (strength < .2) continue;
        const isQuestion = (Math.round((x - xStart) / tuning.spacing) + Math.round((y - yStart) / rowGap)) % 3 !== 0;
        output.fillStyle = isQuestion ? tuning.primary : tuning.secondary;
        output.globalAlpha = .35 + strength * .65;
        output.fillText(isQuestion ? 'ARE YOU LOOKING?' : 'PRESENT', x, y);
      }
    }
    output.globalAlpha = 1;
  }

  function tick() {
    if (!visible) return;
    render();
    animationId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    cancelAnimationFrame(animationId);
    animationId = 0;
  }

  async function useCamera() {
    if (starting || stream) return;
    starting = true;
    status.textContent = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      camera.srcObject = stream;
      await camera.play();
      source = camera;
      recording.pause();
      resetSampler();
      status.textContent = '';
      updateControls();
      render();
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      stream = null;
      camera.srcObject = null;
      source = recording;
      if (location.protocol !== 'file:' && visible) recording.play().catch(() => {});
      updateControls();
      const fallback = location.protocol === 'file:' ? '' : 'RECORDING PREVIEW · ';
      status.textContent = fallback + (error?.name === 'NotAllowedError'
        ? 'CAMERA PERMISSION DENIED'
        : 'CAMERA UNAVAILABLE');
      console.warn('Iteration camera unavailable:', error);
    } finally {
      starting = false;
    }
  }

  buttons.forEach((button, index) => button.addEventListener('click', () => {
    mode = index;
    updateControls();
    render();
  }));
  window.addEventListener('pagehide', () => {
    stopLoop();
    stream?.getTracks().forEach(track => track.stop());
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      if (source === recording && location.protocol !== 'file:' && status.textContent) recording.play().catch(() => {});
      if (!stream && !starting && !status.textContent) useCamera();
      stopLoop();
      animationId = requestAnimationFrame(tick);
    } else {
      recording.pause();
      stopLoop();
    }
  }, { rootMargin: '200px' }).observe(stage);
  updateControls();
  render();
})();
