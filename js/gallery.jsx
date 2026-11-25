import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const items = [
  { src: 'assets/DSC_4949_1.jpg', alt: 'Interactive installation with digital projection', width: 1200, height: 802 },
  { type: 'video', src: 'assets/videos/vid-1.mp4', alt: 'Calculated Camouflage installation film', width: 406, height: 720 },
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

const posterFor = (item) => item.src.replace('assets/videos/', 'assets/gallery-thumbs/').replace('.mp4', '.jpg');

function Media({ item, spotlight = false }) {
  if (item.type === 'video') {
    if (!spotlight) return <img src={posterFor(item)} alt={item.alt} width={item.width} height={item.height} loading="lazy" />;
    return <video key={item.src} src={item.src} poster={posterFor(item)} width={item.width} height={item.height}
      style={{ '--ratio': `${item.width} / ${item.height}`, '--spotlight-width': `${(70 * item.width / item.height).toFixed(2)}dvh` }}
      playsInline controls preload="metadata" aria-label={item.alt} />;
  }
  return <img src={item.src} alt={item.alt} width={item.width} height={item.height} loading={spotlight ? 'eager' : 'lazy'} />;
}

function Gallery() {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(null);
  const activeRef = useRef(0);
  const stageRef = useRef(null);
  const scrollFrame = useRef(null);
  const cardRefs = useRef([]);
  const closeRef = useRef(null);
  const thumbnailStripRef = useRef(null);
  const thumbnailRefs = useRef([]);
  const scrollToIndex = (index, behavior = 'smooth') => {
    const stage = stageRef.current;
    const card = cardRefs.current[index];
    if (!stage || !card) return;
    stage.scrollTo({
      left: card.offsetLeft + card.offsetWidth / 2 - stage.clientWidth / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : behavior,
    });
  };
  const moveBy = (direction) => scrollToIndex(Math.max(0, Math.min(items.length - 1, activeRef.current + direction)));
  const close = () => {
    const index = selected;
    setSelected(null);
    scrollToIndex(index);
    requestAnimationFrame(() => cardRefs.current[index]?.focus());
  };

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateLayout = () => {
      const mobile = window.innerWidth <= 768;
      const maxWidth = Math.min(window.innerWidth * (mobile ? .88 : .62), mobile ? Infinity : 750);
      const maxHeight = Math.min(window.innerHeight * (mobile ? .5 : .51), stage.clientHeight - 8);
      const size = (item) => {
        const scale = Math.min(maxWidth / item.width, maxHeight / item.height);
        return { width: item.width * scale, height: item.height * scale };
      };
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const { width, height } = size(items[index]);
        card.style.width = `${width}px`;
        card.style.height = `${height}px`;
      });
      stage.style.setProperty('--start-space', `${Math.max(0, (stage.clientWidth - cardRefs.current[0].offsetWidth) / 2)}px`);
      stage.style.setProperty('--end-space', `${Math.max(0, (stage.clientWidth - cardRefs.current.at(-1).offsetWidth) / 2)}px`);
      const current = cardRefs.current[activeRef.current];
      stage.scrollTo({ left: current.offsetLeft + current.offsetWidth / 2 - stage.clientWidth / 2, behavior: 'instant' });
    };
    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(stage);
    window.addEventListener('resize', updateLayout);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateLayout); };
  }, []);

  useEffect(() => {
    const strip = thumbnailStripRef.current;
    const thumbnail = thumbnailRefs.current[active];
    if (!strip || !thumbnail) return;
    strip.scrollTo({
      left: thumbnail.offsetLeft - (strip.clientWidth - thumbnail.clientWidth) / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [active]);

  useEffect(() => {
    if (selected !== null) return;
    const onKey = (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); moveBy(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveBy(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

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

  const onWheel = (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.currentTarget.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1);
  };

  const onScroll = (event) => {
    if (scrollFrame.current) return;
    const stage = event.currentTarget;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const center = stage.scrollLeft + stage.clientWidth / 2;
      let nearest = 0;
      let distance = Infinity;
      cardRefs.current.forEach((card, index) => {
        const difference = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        if (difference < distance) { distance = difference; nearest = index; }
      });
      if (nearest !== activeRef.current) {
        activeRef.current = nearest;
        setActive(nearest);
      }
    });
  };

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  return <div className="spatial-gallery">
    <div className="spatial-stage" ref={stageRef} role="region" aria-roledescription="carousel" aria-label="Installation photographs and films"
      onWheel={onWheel} onScroll={onScroll}>
      {items.map((item, index) => {
        return <button className="spatial-card" key={item.src} data-position={index === active ? 'current' : 'other'} type="button"
          ref={(node) => { cardRefs.current[index] = node; }}
          tabIndex={index === active ? 0 : -1}
          onClick={() => {
            if (index === activeRef.current) setSelected(index);
            else scrollToIndex(index);
          }} aria-label={`${index === active ? 'Open' : 'Show'} ${item.alt}, ${index + 1} of ${items.length}`}>
          <Media item={item} />
          {item.type === 'video' && <span className="spatial-play" aria-hidden="true">▶</span>}
        </button>;
      })}
    </div>
    <div className="carousel-thumbnails" ref={thumbnailStripRef} aria-label="Choose a gallery item">
      {items.map((item, index) =>
        <button className={`carousel-thumbnail${index === active ? ' is-active' : ''}`} key={item.src} type="button"
          ref={(node) => { thumbnailRefs.current[index] = node; }}
          onClick={() => scrollToIndex(index)} aria-label={`Show ${item.alt}, ${index + 1} of ${items.length}`}
          aria-pressed={index === active}>
          <img src={item.type === 'video' ? posterFor(item) : item.src} alt="" loading="lazy" />
          {item.type === 'video' && <span aria-hidden="true">▶</span>}
        </button>
      )}
    </div>
    <div className="carousel-controls" aria-label="Gallery navigation">
      <button type="button" onClick={() => moveBy(-1)} disabled={active === 0} aria-label="Previous image">←</button>
      <span className="carousel-count" aria-live="polite">{String(active + 1).padStart(2, '0')} <span>/</span> {String(items.length).padStart(2, '0')}</span>
      <button type="button" onClick={() => moveBy(1)} disabled={active === items.length - 1} aria-label="Next image">→</button>
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
