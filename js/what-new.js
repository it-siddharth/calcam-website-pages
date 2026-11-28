const artistTrack = document.querySelector('.artist-track');
const artistSlides = [...artistTrack.querySelectorAll('img')];
const artistTitle = document.querySelector('.artist-footer .label u');
const artistDescription = document.querySelector('.artist-footer .prose');
const artistWorks = [
  { title: 'RAFAEL LOZANO-HEMMER / BODY MOVIES', description: artistDescription.textContent, url: 'https://lozano-hemmer.com/artworks/body_movies.php' },
  { title: 'TEAMLAB / FLOWERS AND PEOPLE', description: 'Flowers respond to the presence of visitors, blooming and fading as people move through the room. I was drawn to how a person can change a projected world simply by being there.', url: 'https://www.teamlab.art/ew/flowersandpeople-azabudai/' },
  { title: 'JEN LEWIN / THE POOL', description: 'The Pool responds to footsteps and touch with spreading fields of colored light. Its shared, changing image helped me think about an installation shaped by everyone who enters it.', url: 'https://www.jenlewinstudio.com/portfolio/the-pool/' },
  { title: 'ROMY ACHITUV & CAMILLE UTTERBACK / TEXT RAIN', description: 'Letters fall onto the projected silhouettes of visitors, who can catch and move them with their bodies. That meeting of live image, text, and gesture helped me think about how words could belong to a moving silhouette.', url: 'https://camilleutterback.com/projects/text-rain/' },
  { title: 'MEMO AKTEN / BODY PAINT', description: 'Body Paint turns a visitor’s movements into flowing fields of color. I was drawn to the way it makes a person’s gestures visible across a projection, then lets the image fade as they move away.', url: 'https://memo.tv/projects/2009/body-paint/' }
];
const artistSource = document.querySelector('.artist-source');
let activeArtist = 0;
let suspendArtistScrollUntil = 0;
const carousels = document.querySelectorAll('.artist-track, .setup-strip');
function setActiveArtist(index) {
  activeArtist = Math.max(0, Math.min(artistSlides.length - 1, index));
  artistSlides.forEach((slide, i) => {
    slide.classList.toggle('is-active', i === activeArtist);
    if (i !== activeArtist) slide.style.filter = '';
  });
  artistTitle.textContent = artistWorks[activeArtist].title;
  artistDescription.textContent = artistWorks[activeArtist].description;
  artistSource.href = artistWorks[activeArtist].url;
  document.querySelector('.rail-controls [data-dir="-1"]').disabled = activeArtist === 0;
  document.querySelector('.rail-controls [data-dir="1"]').disabled = activeArtist === artistSlides.length - 1;
}
function syncActiveArtist() {
  if (performance.now() < suspendArtistScrollUntil) return;
  const trackLeft = artistTrack.getBoundingClientRect().left;
  const distances = artistSlides.map((slide) => Math.abs(slide.getBoundingClientRect().left - trackLeft));
  setActiveArtist(distances.indexOf(Math.min(...distances)));
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
    showWithoutDither(cover);
    video.play().catch(() => {});
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

function showWithoutDither(img) {
  const previous = activeReveals.get(img);
  if (previous) {
    cancelAnimationFrame(previous.frame);
    previous.canvas?.remove();
    activeReveals.delete(img);
  }
  img.style.opacity = '1';
  img.style.filter = previous?.originalFilter ?? '';
}

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
let setupIndex = 0;
let setupFinished = false;
let setupInView = false;
function selectSetup(index) {
  setupFinished = false;
  setupIndex = index;
  const media = setupMedia[index];
  const video = media.querySelector('video');
  showWithoutDither(media.querySelector('.media-cover'));
  setupMedia.forEach((other) => {
    if (other === media) return;
    other.querySelector('video').pause();
    other.classList.remove('is-playing', 'is-sequence-active');
  });
  video.currentTime = 0;
  media.dataset.playedSeconds = '0';
  video.play().catch(() => {});
}

function playCurrentSetup() {
  if (setupFinished || !setupInView) return;
  const media = setupMedia[setupIndex];
  if (!media) return;
  const video = media.querySelector('video');
  if (video.paused && !video.ended) video.play().catch(() => {});
}

setupMedia.forEach((media, index) => {
  const video = media.querySelector('video');
  video.preload = 'metadata';
  video.loop = false;
  video.controls = false;
  video.removeAttribute('controls');

  const transport = document.createElement('div');
  transport.className = 'setup-transport';
  const progress = document.createElement('div');
  progress.className = 'setup-progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', `Installation clip ${index + 1} progress`);
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '10');
  transport.append(progress);
  media.after(transport);
  let clipStart = 0;
  video.addEventListener('loadedmetadata', () => { video.loop = video.duration < 10; });
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) video.loop = video.duration < 10;

  const updateTransport = () => {
    const elapsed = video.paused ? Number(media.dataset.playedSeconds || 0) : Math.min(10, (performance.now() - clipStart) / 1000);
    progress.style.setProperty('--played', `${Math.max(0, Math.min(100, elapsed * 10))}%`);
    progress.setAttribute('aria-valuenow', String(Math.round(elapsed)));
  };
  video.addEventListener('loadedmetadata', updateTransport);
  video.addEventListener('durationchange', updateTransport);
  video.addEventListener('timeupdate', () => {
    updateTransport();
    if (setupIndex === index && (performance.now() - clipStart) >= 9960) advanceSetup(index);
  });
  video.addEventListener('seeked', updateTransport);
  media.tabIndex = 0;
  media.setAttribute('role', 'button');
  media.setAttribute('aria-label', `Play installation clip ${index + 1}`);
  media.addEventListener('click', () => selectSetup(index));
  media.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectSetup(index);
  });

  video.addEventListener('playing', () => {
    clipStart = performance.now() - Number(media.dataset.playedSeconds || 0) * 1000;
    setupIndex = index;
    setupMedia.forEach((other) => {
      if (other === media) return;
      other.querySelector('video').pause();
      other.classList.remove('is-playing', 'is-sequence-active');
    });
    media.classList.add('is-playing', 'is-sequence-active');
    updateTransport();
  });
  video.addEventListener('pause', () => {
    if (clipStart) media.dataset.playedSeconds = String(Math.min(10, (performance.now() - clipStart) / 1000));
    media.classList.remove('is-sequence-active');
    updateTransport();
  });
  function advanceSetup(finishedIndex) {
    if (setupIndex !== finishedIndex) return;
    video.pause();
    video.currentTime = 0;
    media.dataset.playedSeconds = '0';
    media.classList.remove('is-playing', 'is-sequence-active');
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
  }
  video.addEventListener('ended', () => advanceSetup(index));
  updateTransport();
});

// Non-sequence clips begin when they enter view, without an overlaid control.
const exhibitionSetupVideo = document.querySelector('.space-photos video[aria-label="Exhibition setup"]');
if (exhibitionSetupVideo) exhibitionSetupVideo.playbackRate = 2.5;
document.querySelectorAll('.motion-media').forEach((media) => {
  if (media.closest('.setup-strip')) return;
  const video = media.querySelector('video');
  video.controls = false;
  video.removeAttribute('controls');
  video.muted = true;
  video.playsInline = true;
  video.addEventListener('playing', () => media.classList.add('is-playing'));
  video.addEventListener('pause', () => media.classList.remove('is-playing'));
});

// Start the first clip when the strip enters view, then pause off screen.
const setupObserver = new IntersectionObserver((entries) => {
  setupInView = entries[0].isIntersecting;
  if (setupInView) {
    playCurrentSetup();
  } else {
    setupMedia[setupIndex]?.querySelector('video').pause();
  }
}, { threshold: .08 });
setupObserver.observe(setupStrip);

// Begin other footage only after its still has assembled; stop decoding off screen.
const mediaObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    const video = target.querySelector('video');
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
document.querySelectorAll('.motion-media').forEach((media) => {
  if (!media.closest('.setup-strip')) mediaObserver.observe(media);
});
