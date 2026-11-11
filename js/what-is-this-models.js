/* Focused embeds of the existing installation scene. */
(() => {
  'use strict';

  const views = {
    'isometric-room': { query: 'room', title: 'Interactive 3D view of the installation room' },
    'left-wall-projection': { query: 'left-wall', title: 'Live left wall webcam projection' },
    'right-wall-projection': { query: 'right-wall', title: 'Live right wall webcam projection' },
    'centre-tv': { query: 'centre-tv', title: 'Live centre TV and acrylic panels' }
  };
  const slots = Array.from(document.querySelectorAll('[data-model-slot]'));
  if (!slots.length) return;

  function showStatus(slot, message, failed = false) {
    let status = slot.querySelector('.model-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'model-status';
      slot.append(status);
    }
    status.replaceChildren();
    status.textContent = message;
    if (failed) {
      const link = document.createElement('a');
      link.href = 'installation.html';
      link.textContent = 'OPEN THE ROOM ↗';
      status.append(link);
    }
  }

  function mount(slot) {
    clearTimeout(slot.unloadTimer);
    if (slot.querySelector('iframe')) return;
    const view = views[slot.dataset.modelSlot];
    if (!view) return;
    const frame = document.createElement('iframe');
    frame.className = 'model-embed';
    frame.title = view.title;
    frame.allow = 'camera';
    frame.src = `installation-embed.html?embed=${view.query}&v=2`;
    slot.replaceChildren(frame);
    showStatus(slot, 'LOADING 3D VIEW…');
    slot.readyTimer = setTimeout(() => {
      if (!slot.dataset.modelReady) showStatus(slot, 'THE 3D VIEW COULD NOT LOAD. ', true);
    }, 15000);
    frame.addEventListener('error', () => {
      clearTimeout(slot.readyTimer);
      showStatus(slot, 'THE 3D VIEW COULD NOT LOAD. ', true);
    });
    if (view.query === 'room') {
      const hint = document.createElement('p');
      hint.className = 'model-hint';
      hint.textContent = 'DRAG TO ROTATE · SCROLL TO ZOOM';
      slot.append(hint);
    }
  }

  window.addEventListener('message', event => {
    if (event.data?.type !== 'calcam-embed') return;
    const slot = slots.find(item => item.querySelector('iframe')?.contentWindow === event.source);
    if (!slot) return;
    clearTimeout(slot.readyTimer);
    if (event.data.status === 'ready') {
      slot.dataset.modelReady = 'true';
      slot.querySelector('.model-status')?.remove();
    } else if (event.data.status === 'error') {
      showStatus(slot, 'THE 3D VIEW COULD NOT LOAD. ', true);
    }
  });

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const slot = entry.target;
      if (entry.isIntersecting && !slot.closest('.detail')?.dataset.transitioning) {
        mount(slot);
      } else {
        clearTimeout(slot.unloadTimer);
        slot.unloadTimer = setTimeout(() => {
          slot.querySelector('iframe')?.remove();
          slot.querySelector('.model-status')?.remove();
          slot.querySelector('.model-hint')?.remove();
          delete slot.dataset.modelReady;
          clearTimeout(slot.readyTimer);
        }, 4000);
      }
    }
  }, { rootMargin: '160px 0px' });
  slots.forEach(slot => observer.observe(slot));
  document.addEventListener('what-detail-opened', event => {
    event.target.querySelectorAll('[data-model-slot]').forEach(slot => {
      observer.unobserve(slot);
      observer.observe(slot);
    });
  });
})();
