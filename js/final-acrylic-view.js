(() => {
  const preview = document.querySelector('.final-art-preview');
  if (!preview) return;

  const image = preview.querySelector('img');
  const canvas = preview.querySelector('canvas');
  const switchButton = preview.parentElement.querySelector('.t-toggle');
  const stateLabel = preview.parentElement.querySelector('.acrylic-view-state');
  const ctx = canvas.getContext('2d');

  function renderAcrylic() {
    if (!preview.classList.contains('is-acrylic') || !image.naturalWidth) return;

    const width = image.clientWidth;
    const height = image.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // Match the image's object-fit: cover crop before filtering it.
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * 1.15;
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    window.applyAcrylicView(ctx, width, height);
  }

  switchButton.addEventListener('click', () => {
    const enabled = switchButton.dataset.on !== 'true';
    switchButton.classList.add('is-init');
    switchButton.dataset.on = String(enabled);
    switchButton.setAttribute('aria-checked', String(enabled));
    stateLabel.textContent = enabled ? 'ACRYLIC VIEW' : 'NON ACRYLIC VIEW';
    preview.classList.toggle('is-acrylic', enabled);
    if (enabled) renderAcrylic();
  });

  image.addEventListener('load', renderAcrylic);
  if ('ResizeObserver' in window) new ResizeObserver(renderAcrylic).observe(image);
  else window.addEventListener('resize', renderAcrylic);
})();
