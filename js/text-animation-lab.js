import { WebcamTextRenderer } from './webcam-text-renderer.js';

const originalWords = [
  { text: 'YOU ARE', color: '#ff0000', font: 'monospace', size: 18 },
  { text: 'YOU ARE', color: '#ff0000', font: 'monospace', size: 18 },
  { text: 'YOU ARE', color: '#ff0000', font: 'monospace', size: 18 },
  { text: 'YOUR CHOICES', color: '#ffff00', font: 'serif', size: 22 },
  { text: 'PUBLIC SELF', color: '#0000ff', font: 'monospace', size: 10 },
  { text: 'PRESENT', color: '#00ff00', font: 'monospace', size: 10 }
];

const renderer = new WebcamTextRenderer(960, 720);
renderer.settings.enableAnimation = true;
renderer.settings.flipVideo = true;
renderer.settings.animationAmount = 10;

const $ = (id) => document.getElementById(id);
const canvasMount = $('canvasMount');
const startCard = $('startCard');
const startButton = $('startCameraButton');
const cameraSelect = $('cameraSelect');
const cameraStatus = $('cameraStatus');
const wordsList = $('wordsList');
const toast = $('toast');
let animationFrame = 0;
let toastTimer = 0;

canvasMount.appendChild(renderer.getCanvas());
renderer.drawPlaceholder();

function renderLoop() {
  renderer.render();
  animationFrame = requestAnimationFrame(renderLoop);
}

function setStatus(state, label) {
  cameraStatus.dataset.state = state;
  cameraStatus.querySelector('span').textContent = label;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

async function refreshCameras() {
  const cameras = await renderer.enumerateCameras();
  cameraSelect.innerHTML = '';
  if (!cameras.length) {
    cameraSelect.add(new Option('Default camera', ''));
  } else {
    cameras.forEach((camera, index) => cameraSelect.add(new Option(camera.label || `Camera ${index + 1}`, camera.deviceId)));
  }
  cameraSelect.value = renderer.currentCameraId || '';
  cameraSelect.disabled = false;
}

async function startCamera() {
  startButton.disabled = true;
  startButton.textContent = 'STARTING…';
  setStatus('idle', 'CONNECTING');
  const success = await renderer.init();
  if (success) {
    await refreshCameras();
    startCard.classList.add('hidden');
    $('snapshotButton').disabled = false;
    $('svgButton').disabled = false;
    setStatus('live', 'CAMERA LIVE');
    cancelAnimationFrame(animationFrame);
    renderLoop();
  } else {
    setStatus('error', 'CAMERA BLOCKED');
    startButton.disabled = false;
    startButton.textContent = 'TRY AGAIN';
    showToast('Allow camera access, then try again.');
  }
}

function rebuildGrid() {
  renderer.updateGridDimensions();
  renderer.initializeGrid();
}

function updateRangeFill(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const progress = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--range-progress', `${progress}%`);
}

function bindRange(id, setting, format = (value) => value, rebuild = false) {
  const input = $(id);
  const output = $(`${id}Output`);
  const update = () => {
    renderer.settings[setting] = Number(input.value);
    output.value = format(input.value);
    output.textContent = format(input.value);
    updateRangeFill(input);
    if (rebuild) rebuildGrid();
  };
  input.addEventListener('input', update);
  update();
}

function renderWords() {
  wordsList.replaceChildren();
  renderer.words.forEach((word, index) => {
    const row = document.createElement('div');
    row.className = 'word-row';
    const text = document.createElement('input');
    text.type = 'text'; text.value = word.text; text.maxLength = 32;
    text.setAttribute('aria-label', `Phrase ${index + 1}`);
    text.addEventListener('change', () => {
      word.text = text.value.trim() || 'WORD';
      text.value = word.text;
      rebuildGrid();
    });
    const color = document.createElement('input');
    color.type = 'color'; color.value = word.color;
    color.setAttribute('aria-label', `${word.text} color`);
    color.addEventListener('input', () => { word.color = color.value; });
    const size = document.createElement('input');
    size.type = 'number'; size.min = '6'; size.max = '36'; size.value = word.size;
    size.setAttribute('aria-label', `${word.text} font size`);
    size.addEventListener('change', () => {
      word.size = Math.max(6, Math.min(36, Number(size.value) || 10));
      size.value = word.size;
      rebuildGrid();
    });
    const remove = document.createElement('button');
    remove.className = 'word-remove'; remove.type = 'button'; remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${word.text}`);
    remove.addEventListener('click', () => {
      if (renderer.words.length === 1) return showToast('Keep at least one phrase in the mix.');
      renderer.words.splice(index, 1);
      rebuildGrid();
      renderWords();
    });
    row.append(text, color, size, remove);
    wordsList.append(row);
  });
}

startButton.addEventListener('click', startCamera);
cameraSelect.addEventListener('change', async () => {
  setStatus('idle', 'SWITCHING');
  const success = await renderer.switchCamera(cameraSelect.value || null);
  setStatus(success ? 'live' : 'error', success ? 'CAMERA LIVE' : 'CAMERA ERROR');
});

$('enableAnimation').addEventListener('change', (event) => {
  renderer.settings.enableAnimation = event.target.checked;
  rebuildGrid();
});
$('animationType').addEventListener('change', (event) => {
  renderer.settings.animationType = event.target.value;
  rebuildGrid();
});
$('flipVideo').addEventListener('change', (event) => { renderer.settings.flipVideo = event.target.checked; });
$('invertColors').addEventListener('change', (event) => { renderer.settings.invertColors = event.target.checked; });
$('showContour').addEventListener('change', (event) => { renderer.settings.showContour = event.target.checked; });
$('enableGlitch').addEventListener('change', (event) => { renderer.settings.enableGlitch = event.target.checked; });
$('glitchType').addEventListener('change', (event) => { renderer.settings.glitchType = event.target.value; });

bindRange('animationSpeed', 'animationSpeed');
bindRange('animationAmount', 'animationAmount', (value) => value, true);
bindRange('threshold', 'threshold');
bindRange('textDensity', 'textDensity', (value) => `${Number(value).toFixed(2)}×`, true);
bindRange('cellWidthMultiplier', 'cellWidthMultiplier', (value) => Number(value).toFixed(2), true);
bindRange('glitchIntensity', 'glitchIntensity', (value) => `${value}%`);
bindRange('glitchSpeed', 'glitchSpeed');

$('shuffleButton').addEventListener('click', () => { renderer.initializeGrid(); showToast('Word layout shuffled.'); });
$('viewportSelect').addEventListener('change', (event) => {
  const [width, height] = event.target.value.split('x').map(Number);
  const preview = $('previewFrame');
  preview.style.setProperty('--preview-ratio', String(width / height));
  renderer.resize(width, height);
  showToast(`Viewport changed to ${width} × ${height}.`);
});
$('snapshotButton').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `text-silhouette-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.png`;
  link.href = renderer.getCanvas().toDataURL('image/png');
  link.click();
  showToast('Frame saved.');
});
$('svgButton').addEventListener('click', () => {
  const blob = new Blob([renderer.toSVG()], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `text-silhouette-${renderer.canvas.width}x${renderer.canvas.height}.svg`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast('Editable SVG text frame saved.');
});
$('fullscreenButton').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else $('previewFrame').requestFullscreen().catch(() => showToast('Fullscreen is unavailable here.'));
});
$('addWordButton').addEventListener('click', () => {
  const input = $('newWord');
  const phrase = input.value.trim();
  if (!phrase) return;
  renderer.words.push({ text: phrase.toUpperCase(), color: $('newWordColor').value, font: 'monospace', size: 14 });
  input.value = '';
  rebuildGrid();
  renderWords();
});
$('newWord').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('addWordButton').click(); });
$('resetButton').addEventListener('click', () => {
  renderer.words = originalWords.map((word) => ({ ...word }));
  rebuildGrid();
  renderWords();
  showToast('Original TV words restored.');
});
document.querySelectorAll('.section-heading').forEach((heading) => {
  heading.addEventListener('click', () => {
    const section = heading.closest('.control-section');
    const open = section.classList.toggle('open');
    heading.setAttribute('aria-expanded', String(open));
    heading.querySelector('b').textContent = open ? '−' : '+';
  });
});

window.addEventListener('beforeunload', () => renderer.dispose());
renderWords();
rebuildGrid();
