import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const items = [
  { type: 'video', src: 'assets/videos/vid-1.mp4', alt: 'Calculated Camouflage installation film', width: 406, height: 720 },
  { src: 'assets/DSC_4949_1.jpg', alt: 'Interactive installation with digital projection', width: 1200, height: 802 },
  { src: 'assets/Frame_11.jpg', alt: 'Digital silhouettes with text overlay', width: 957, height: 1200 },
  { src: 'assets/DSC_4952_1.jpg', alt: 'Installation documentation', width: 1400, height: 934 },
  { src: 'assets/IMG_4179_2.jpg', alt: 'Visitor interacting with projection', width: 1200, height: 961 },
  { type: 'video', src: 'assets/videos/vid-2.mp4', alt: 'Calculated Camouflage installation film', width: 1280, height: 720 },
  { src: 'assets/IMG_4216_1.jpg', alt: 'Blue projection with text patterns', width: 1200, height: 799 },
  { src: 'assets/IMG_4223_1.jpg', alt: 'Colorful interactive projection installation', width: 1200, height: 799 },
  { src: 'assets/IMG_4227_2.jpg', alt: 'Visitor experiencing digital art', width: 1200, height: 799 },
  { type: 'video', src: 'assets/videos/vid-3.mp4', alt: 'Calculated Camouflage installation film', width: 1280, height: 720 },
  { src: 'assets/R0002034.jpg', alt: 'Blue ambient projection portrait', width: 799, height: 1200 },
  { src: 'assets/R0002068_2.jpg', alt: 'Interactive digital experience', width: 803, height: 1200 },
  { src: 'assets/R0002097_1.jpg', alt: 'Calculated Camouflage exhibition moment', width: 1200, height: 1063 },
  { type: 'video', src: 'assets/videos/vid-4.mp4', alt: 'Calculated Camouflage installation film', width: 406, height: 720 },
  { src: 'assets/R0002355_1.jpg', alt: 'Particle projection with visitor silhouette', width: 1200, height: 799 },
  { src: 'assets/R0002358_1.jpg', alt: 'Gallery installation view', width: 1200, height: 799 },
  { src: 'assets/IMG_6459_1.jpg', alt: 'Exhibition moment', width: 674, height: 1200 },
  { type: 'video', src: 'assets/videos/vid-5.mp4', alt: 'Calculated Camouflage installation film', width: 406, height: 720 },
  { src: 'assets/R0002071_1.jpg', alt: 'Visitor experience portrait', width: 800, height: 1200 },
];

const lanes = [
  { x: -.27, y: .17 },
  { x: .24, y: .22 },
  { x: .30, y: -.20 },
  { x: -.18, y: .30 },
  { x: -.26, y: .03 },
  { x: .28, y: .19 },
];

const mobileLanes = [
  { x: -.18, y: -.16 },
  { x: .19, y: .12 },
  { x: -.12, y: .18 },
  { x: .15, y: -.17 },
  { x: -.20, y: .08 },
  { x: .16, y: -.03 },
];

const posterFor = (item) => item.src.replace('assets/videos/', 'assets/gallery-thumbs/').replace('.mp4', '.jpg');

function Media({ item, spotlight = false }) {
  if (item.type === 'video') {
    return <video key={item.src} src={item.src} poster={posterFor(item)} width={item.width} height={item.height}
      style={spotlight ? { '--ratio': `${item.width} / ${item.height}`, '--spotlight-width': `${(70 * item.width / item.height).toFixed(2)}dvh` } : undefined}
      muted={!spotlight} loop={!spotlight} playsInline controls={spotlight}
      preload={spotlight ? 'metadata' : 'none'} aria-label={item.alt} />;
  }
  return <img src={item.src} alt={item.alt} width={item.width} height={item.height} loading={spotlight ? 'eager' : 'lazy'} />;
}

function Gallery() {
  const [selected, setSelected] = useState(null);
  const cardRefs = useRef([]);
  const closeRef = useRef(null);
  const stageRef = useRef(null);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const selectedRef = useRef(null);
  const animateRef = useRef(() => {});

  const open = (index) => {
    selectedRef.current = index;
    setSelected(index);
  };
  const close = () => {
    const index = selected;
    selectedRef.current = null;
    setSelected(null);
    requestAnimationFrame(() => cardRefs.current[index]?.focus());
  };

  const moveBy = (direction) => {
    targetRef.current = Math.max(0, Math.min(items.length - 1, Math.round(targetRef.current) + direction));
    animateRef.current();
  };

  useEffect(() => {
    const stage = stageRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!stage || reduced.matches) return;
    let raf = 0;
    let lastFrame = 0;
    let touchY = null;

    const draw = (progress) => {
      const small = window.innerWidth <= 768;
      const front = small ? 80 : 95;
      const step = small ? 590 : 760;
      const perspective = small ? 700 : 900;
      const stageWidth = stage.clientWidth;
      const stageHeight = stage.clientHeight;
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const z = front + (progress - index) * step;
        const far = small ? -700 : -900;
        const depth = Math.max(0, Math.min(1, (z - far) / (front - far)));
        const brightness = .18 + .82 * depth ** 1.6;
        const exitEnd = perspective * .935;
        const visible = z > far && z < exitEnd;
        const lane = small ? mobileLanes[index % mobileLanes.length] : lanes[index % lanes.length];
        // Keep each frame on one screen lane while it travels straight through
        // depth. It grows past the viewer and leaves without a sideways exit.
        const projection = (perspective - z) / perspective;
        const frontScale = perspective / (perspective - front);
        const maxX = Math.max(0, (stageWidth - card.offsetWidth * frontScale) / 2 - 24);
        const screenX = Math.max(-maxX, Math.min(maxX, lane.x * stageWidth));
        const x = screenX * projection;
        const y = lane.y * stageHeight * projection;
        card.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px)`;
        card.style.filter = `brightness(${brightness.toFixed(3)})`;
        card.style.visibility = visible ? 'visible' : 'hidden';
        card.style.pointerEvents = visible && z < front + step * .5 ? 'auto' : 'none';
        card.style.zIndex = String(Math.round(z + 1500));
        card.tabIndex = visible ? 0 : -1;
        const video = card.querySelector('video');
        if (video) {
          if (visible && z > -500 && z < front + 260 && selectedRef.current === null) {
            if (video.paused) video.play().catch(() => {});
          } else if (!video.paused) video.pause();
        }
      });
    };

    const animate = (timestamp) => {
      raf = 0;
      const elapsed = lastFrame ? Math.min(64, timestamp - lastFrame) : 16;
      lastFrame = timestamp;
      const delta = targetRef.current - currentRef.current;
      currentRef.current += delta * (1 - Math.exp(-elapsed / 190));
      if (Math.abs(targetRef.current - currentRef.current) < 0.001) currentRef.current = targetRef.current;
      draw(currentRef.current);
      if (currentRef.current !== targetRef.current) raf = requestAnimationFrame(animate);
      else lastFrame = 0;
    };
    animateRef.current = () => { if (!raf) raf = requestAnimationFrame(animate); };
    draw(currentRef.current);

    const onWheel = (event) => {
      if (selectedRef.current !== null) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
      targetRef.current = Math.max(0, Math.min(items.length - 1, targetRef.current + delta / 900));
      animateRef.current();
    };
    const onKey = (event) => {
      if (selectedRef.current !== null) return;
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === 'ArrowRight') { event.preventDefault(); moveBy(1); }
      if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'ArrowLeft') { event.preventDefault(); moveBy(-1); }
    };
    const onTouchStart = (event) => { if (event.touches.length === 1) touchY = event.touches[0].clientY; };
    const onTouchMove = (event) => {
      if (touchY === null || event.touches.length !== 1 || selectedRef.current !== null) return;
      const y = event.touches[0].clientY;
      const delta = touchY - y;
      if (Math.abs(delta) > 2) {
        event.preventDefault();
        targetRef.current = Math.max(0, Math.min(items.length - 1, targetRef.current + delta / 620));
        animateRef.current();
      }
      touchY = y;
    };
    const onTouchEnd = () => { touchY = null; };
    const onResize = () => draw(currentRef.current);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  useEffect(() => {
    if (selected === null) return;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') setSelected((index) => (index + 1) % items.length);
      if (event.key === 'ArrowLeft') setSelected((index) => (index - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  useEffect(() => {
    stageRef.current?.querySelectorAll('video').forEach((video) => {
      if (selected !== null) video.pause();
    });
    if (selected === null) animateRef.current();
  }, [selected]);

  return <div className="spatial-gallery">
    <div className="spatial-stage" ref={stageRef} aria-label="Scroll through installation photographs and films in depth">
      {items.map((item, index) => {
        const style = {
          '--ratio': `${item.width} / ${item.height}`,
          '--base-w': `${Math.min(420, 340 * item.width / item.height)}px`,
        };
        return <button className="spatial-card" key={item.src} style={style} type="button"
          ref={(node) => { cardRefs.current[index] = node; }}
          onClick={() => open(index)} aria-label={`View ${item.alt}, ${index + 1} of ${items.length}`}>
          <Media item={item} />
          {item.type === 'video' && <span className="spatial-play" aria-hidden="true">▶</span>}
        </button>;
      })}
    </div>
    {selected !== null && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={items[selected].alt}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <button className="lightbox-close" type="button" onClick={close} ref={closeRef} aria-label="Close media">CLOSE ×</button>
      <div className="lightbox-media"><Media item={items[selected]} spotlight /></div>
      <div className="lightbox-footer">
        <button type="button" onClick={() => setSelected((selected - 1 + items.length) % items.length)} aria-label="Previous media">PREV</button>
        <p><span>{String(selected + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>{items[selected].alt}</p>
        <button type="button" onClick={() => setSelected((selected + 1) % items.length)} aria-label="Next media">NEXT</button>
      </div>
    </div>}
  </div>;
}

createRoot(document.getElementById('gallery-root')).render(<Gallery />);
