const artistTrack = document.querySelector('.artist-track');
const artistSlides = [...artistTrack.querySelectorAll('img')];
const artistTitle = document.querySelector('.artist-footer .label u');
const artistDescription = document.querySelector('.artist-footer .prose');
const artistDescriptions = [
  artistDescription.textContent,
  'A large figure made of overlapping red, green, and blue grids fills the wall as a visitor stands before it.',
  'A luminous panel frames a human silhouette while another visitor looks on.',
  'A projected floor grid bends around a person seated beneath a shaft of light.'
];
let activeArtist = 0;
let suspendArtistScrollUntil = 0;
const carousels = document.querySelectorAll('.artist-track, .setup-strip');
function setActiveArtist(index) {
  activeArtist = Math.max(0, Math.min(artistSlides.length - 1, index));
  artistSlides.forEach((slide, i) => {
    slide.classList.toggle('is-active', i === activeArtist);
    if (i !== activeArtist) slide.style.filter = '';
  });
  artistTitle.textContent = `ARTIST EXHIBIT ${String(activeArtist + 1).padStart(2, '0')}`;
  artistDescription.textContent = artistDescriptions[activeArtist];
  document.querySelector('.rail-controls [data-dir="-1"]').disabled = activeArtist === 0;
  document.querySelector('.rail-controls [data-dir="1"]').disabled = activeArtist === artistSlides.length - 1;
}
function syncActiveArtist() {
  if (performance.now() < suspendArtistScrollUntil) return;
  const left = artistTrack.scrollLeft;
  const remaining = artistTrack.scrollWidth - artistTrack.clientWidth;
  if (remaining <= 2 || left < 2) return setActiveArtist(0);
  if (left >= remaining - 2) return setActiveArtist(artistSlides.length - 1);
  const focus = left + artistTrack.clientWidth * (.25 + .25 * left / remaining);
  const trackLeft = artistTrack.getBoundingClientRect().left;
  const index = artistSlides.findIndex((slide) => {
    const start = slide.getBoundingClientRect().left - trackLeft + left;
    return focus >= start && focus < start + slide.getBoundingClientRect().width;
  });
  if (index >= 0) setActiveArtist(index);
}
function updateCarouselEdges(track) {
  const remaining = track.scrollWidth - track.clientWidth;
  track.dataset.scrollState = remaining < 2 ? 'static'
    : track.scrollLeft < 2 ? 'start'
    : track.scrollLeft >= remaining - 2 ? 'end'
    : 'middle';
}
carousels.forEach((track) => {
  updateCarouselEdges(track);
  track.addEventListener('scroll', () => {
    updateCarouselEdges(track);
    if (track === artistTrack) syncActiveArtist();
  }, { passive: true });
});
window.addEventListener('resize', () => {
  carousels.forEach(updateCarouselEdges);
  syncActiveArtist();
});
document.querySelectorAll('.rail-controls button').forEach((button) => {
  button.addEventListener('click', () => {
    const index = Math.max(0, Math.min(artistSlides.length - 1, activeArtist + Number(button.dataset.dir)));
    const slide = artistSlides[index];
    const left = slide.getBoundingClientRect().left - artistTrack.getBoundingClientRect().left + artistTrack.scrollLeft;
    suspendArtistScrollUntil = performance.now() + 250;
    setActiveArtist(index);
    artistTrack.scrollTo({ left, behavior: 'instant' });
    updateCarouselEdges(artistTrack);
  });
});
setActiveArtist(0);

const rejectedMain = document.querySelector('.rejected-main');
document.querySelectorAll('.rejected-thumbs button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.rejected-thumbs button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    const selected = button.querySelector('img');
    const video = rejectedMain.querySelector('video');
    video.pause();
    rejectedMain.classList.remove('is-playing');
    video.poster = selected.src;
    video.querySelector('source').src = selected.dataset.video;
    video.load();
    const cover = rejectedMain.querySelector('.media-cover');
    cover.src = selected.src;
    revealWithDither(cover, () => video.play().catch(() => {}));
  });
});

// Assemble images from the top-left with a clustered, ordered dither front.
// The mask never samples image pixels, so it works with direct file:// previews.
const bayer = [
  0, 48, 12, 60, 32, 16, 44, 28,
  56, 8, 52, 4, 24, 40, 20, 36,
  14, 62, 2, 50, 46, 30, 34, 18,
  54, 6, 58, 10, 22, 38, 26, 42,
  3, 51, 15, 63, 35, 19, 47, 31,
  59, 11, 55, 7, 27, 43, 23, 39,
  17, 61, 1, 49, 45, 29, 33, 21,
  57, 9, 53, 5, 25, 41, 37, 13
];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const activeReveals = new WeakMap();

async function revealWithDither(img, onDone = () => {}) {
  const previous = activeReveals.get(img);
  const originalFilter = previous?.originalFilter ?? img.style.filter;
  if (previous) {
    cancelAnimationFrame(previous.frame);
    previous.canvas?.remove();
  }
  if (reduceMotion.matches) {
    img.style.opacity = '1';
    img.style.filter = originalFilter;
    activeReveals.delete(img);
    onDone();
    return;
  }
  const state = { frame: 0, canvas: null, originalFilter };
  activeReveals.set(img, state);
  img.style.opacity = '0';
  img.style.filter = 'grayscale(1) contrast(1.2)';

  try {
    await img.decode();
    if (activeReveals.get(img) !== state) return;
    const width = img.getBoundingClientRect().width;
    const height = img.getBoundingClientRect().height;
    if (!width || !height) throw new Error('Image has no rendered area');

    const parent = img.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    const w = Math.max(1, Math.ceil(width / 2));
    const h = Math.max(1, Math.ceil(height / 2));
    const canvas = document.createElement('canvas');
    canvas.className = 'dither-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = w;
    canvas.height = h;
    Object.assign(canvas.style, {
      left: `${img.offsetLeft}px`,
      top: `${img.offsetTop}px`,
      width: `${width}px`,
      height: `${height}px`,
      borderRadius: getComputedStyle(img).borderRadius
    });
    parent.append(canvas);
    state.canvas = canvas;

    const context = canvas.getContext('2d');
    const output = context.createImageData(w, h);
    const revealPoints = new Uint8Array(w * h);
    const hash = (x, y) => {
      let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const distance = Math.hypot(x / Math.max(1, w - 1), y / Math.max(1, h - 1)) / Math.SQRT2;
        const cluster = hash(Math.floor(x / 5), Math.floor(y / 5));
        const grain = hash(x, y);
        const ordered = bayer[(y % 8) * 8 + x % 8] / 64;
        const point = .02 + distance * .72 + (cluster - .5) * .2 + ordered * .08 + (grain - .5) * .05;
        revealPoints[y * w + x] = Math.round(Math.min(.97, Math.max(.01, point)) * 255);
      }
    }
    const started = performance.now();
    const duration = 550;

    function paint(now) {
      if (activeReveals.get(img) !== state) return;
      const progress = Math.min(1, (now - started) / duration);
      if (progress >= 1) {
        img.style.filter = state.originalFilter;
        canvas.remove();
        activeReveals.delete(img);
        onDone();
        return;
      }
      const color = Math.min(1, Math.max(0, (progress - .52) / .45));
      if (img.closest('.setup-strip')) {
        img.style.filter = 'grayscale(1)';
      } else if (!img.closest('.artist-track') || img.classList.contains('is-active')) {
        img.style.filter = `grayscale(${1 - color}) contrast(${1.2 - color * .2})`;
      } else {
        img.style.filter = state.originalFilter;
      }
      const limit = Math.round(progress * 255);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          output.data[i + 3] = limit < revealPoints[y * w + x] ? 255 : 0;
        }
      }
      context.putImageData(output, 0, 0);
      state.frame = requestAnimationFrame(paint);
    }
    paint(started);
    img.style.opacity = '1';
  } catch {
    state.canvas?.remove();
    img.style.opacity = '1';
    img.style.filter = state.originalFilter;
    activeReveals.delete(img);
    onDone();
  }
}

const pageImages = document.querySelectorAll('main img:not(.media-cover)');
if (!reduceMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      revealWithDither(entry.target);
    });
  }, { threshold: .08 });
  pageImages.forEach((img) => {
    img.style.opacity = '0';
    observer.observe(img);
  });
} else {
  pageImages.forEach((img) => { img.style.opacity = '1'; });
}

// The installation clips form a single sequence. A clip gains color only while
// it is actually playing, and the next one starts after the previous ends.
const setupStrip = document.querySelector('.setup-strip');
const setupMedia = [...setupStrip.querySelectorAll('.motion-media')];
const setupVisible = new Set();
const setupReady = new WeakSet();
let setupIndex = 0;
let setupFinished = false;
let setupUserChosen = false;

function selectSetup(index) {
  setupUserChosen = true;
  setupFinished = false;
  setupIndex = index;
  const media = setupMedia[index];
  const video = media.querySelector('video');
  setupMedia.forEach((other) => {
    if (other === media) return;
    other.querySelector('video').pause();
    other.classList.remove('is-playing', 'is-sequence-active');
  });
  media.dataset.activated = 'true';
  setupReady.add(media);
  video.play().catch(() => {});
}

function playCurrentSetup() {
  if (setupFinished || setupUserChosen) return;
  const media = setupMedia[setupIndex];
  if (!media || !setupVisible.has(media) || !setupReady.has(media)) return;
  const video = media.querySelector('video');
  if (video.paused && !video.ended) video.play().catch(() => {});
}

setupMedia.forEach((media, index) => {
  const video = media.querySelector('video');
  video.preload = 'metadata';
  video.loop = false;
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'setup-play';
  playButton.textContent = 'PLAY';
  playButton.setAttribute('aria-label', `Play BTS clip ${index + 1}`);
  playButton.addEventListener('click', () => selectSetup(index));
  media.append(playButton);
  media.addEventListener('click', (event) => {
    if (event.target !== playButton && !media.classList.contains('is-playing')) {
      selectSetup(index);
    }
  });

  video.addEventListener('playing', () => {
    setupIndex = index;
    setupMedia.forEach((other) => {
      if (other === media) return;
      other.querySelector('video').pause();
      other.classList.remove('is-playing', 'is-sequence-active');
    });
    media.classList.add('is-playing', 'is-sequence-active');
  });
  video.addEventListener('pause', () => media.classList.remove('is-sequence-active'));
  video.addEventListener('ended', () => {
    video.pause();
    video.currentTime = 0;
    media.classList.remove('is-playing', 'is-sequence-active');
    if (setupUserChosen) return;
    setupIndex = index + 1;
    if (setupIndex >= setupMedia.length) {
      setupFinished = true;
      return;
    }
    const next = setupMedia[setupIndex];
    const stripRect = setupStrip.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();
    if (nextRect.left < stripRect.left || nextRect.right > stripRect.right) {
      setupStrip.scrollTo({ left: setupStrip.scrollLeft + nextRect.left - stripRect.left, behavior: 'smooth' });
    }
    playCurrentSetup();
  });
});

// Give every non-BTS clip an explicit play target if muted autoplay is blocked.
document.querySelectorAll('.motion-media').forEach((media) => {
  if (media.closest('.setup-strip')) return;
  const video = media.querySelector('video');
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'media-play';
  playButton.textContent = 'PLAY';
  playButton.setAttribute('aria-label', `Play ${video.getAttribute('aria-label') || 'video'}`);
  playButton.addEventListener('click', () => video.play().catch(() => {}));
  media.append(playButton);
  media.addEventListener('click', (event) => {
    if (event.target !== playButton && !media.classList.contains('is-playing')) {
      video.play().catch(() => {});
    }
  });
  video.addEventListener('playing', () => media.classList.add('is-playing'));
});

// Begin footage only after its still has assembled; stop decoding off screen.
const mediaObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    const video = target.querySelector('video');
    if (target.closest('.setup-strip')) {
      if (!isIntersecting) {
        setupVisible.delete(target);
        video.pause();
        return;
      }
      setupVisible.add(target);
      if (!target.dataset.activated) {
        target.dataset.activated = 'true';
        revealWithDither(target.querySelector('.media-cover'), () => {
          setupReady.add(target);
          playCurrentSetup();
        });
      } else {
        playCurrentSetup();
      }
      return;
    }
    if (!isIntersecting) {
      video.pause();
      return;
    }
    if (target.dataset.activated) {
      video.play().catch(() => {});
      return;
    }
    target.dataset.activated = 'true';
    revealWithDither(target.querySelector('.media-cover'), () => {
      if (target.getBoundingClientRect().bottom > 0 && target.getBoundingClientRect().top < innerHeight) {
        video.play().catch(() => {});
      }
    });
  });
}, { threshold: .08 });
document.querySelectorAll('.motion-media').forEach((media) => mediaObserver.observe(media));
