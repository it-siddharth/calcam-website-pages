import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const items = [
  { type: 'video', src: 'assets/videos/vid-1.mp4', alt: 'Calculated Camouflage installation film', width: 16, height: 9 },
  { src: 'assets/DSC_4949_1.jpg', alt: 'Interactive installation with digital projection', width: 1200, height: 802 },
  { src: 'assets/Frame_11.jpg', alt: 'Digital silhouettes with text overlay', width: 957, height: 1200 },
  { src: 'assets/DSC_4952_1.jpg', alt: 'Installation documentation', width: 1400, height: 934 },
  { src: 'assets/IMG_4179_2.jpg', alt: 'Visitor interacting with projection', width: 1200, height: 961 },
  { type: 'video', src: 'assets/videos/vid-2.mp4', alt: 'Calculated Camouflage installation film', width: 16, height: 9 },
  { src: 'assets/IMG_4216_1.jpg', alt: 'Blue projection with text patterns', width: 1200, height: 799 },
  { src: 'assets/IMG_4223_1.jpg', alt: 'Colorful interactive projection installation', width: 1200, height: 799 },
  { src: 'assets/IMG_4227_2.jpg', alt: 'Visitor experiencing digital art', width: 1200, height: 799 },
  { type: 'video', src: 'assets/videos/vid-3.mp4', alt: 'Calculated Camouflage installation film', width: 16, height: 9 },
  { src: 'assets/R0002034.jpg', alt: 'Blue ambient projection portrait', width: 799, height: 1200 },
  { src: 'assets/R0002068_2.jpg', alt: 'Interactive digital experience', width: 803, height: 1200 },
  { src: 'assets/R0002097_1.jpg', alt: 'Calculated Camouflage exhibition moment', width: 1200, height: 1063 },
  { type: 'video', src: 'assets/videos/vid-4.mp4', alt: 'Calculated Camouflage installation film', width: 16, height: 9 },
  { src: 'assets/R0002355_1.jpg', alt: 'Particle projection with visitor silhouette', width: 1200, height: 799 },
  { src: 'assets/R0002358_1.jpg', alt: 'Gallery installation view', width: 1200, height: 799 },
  { src: 'assets/IMG_6459_1.jpg', alt: 'Exhibition moment', width: 674, height: 1200 },
  { type: 'video', src: 'assets/videos/vid-5.mp4', alt: 'Calculated Camouflage installation film', width: 16, height: 9 },
  { src: 'assets/R0002071_1.jpg', alt: 'Visitor experience portrait', width: 800, height: 1200 },
];

const thumbnailSource = (item) => item.type === 'video'
  ? item.src.replace('assets/videos/', 'assets/gallery-thumbs/').replace('.mp4', '.jpg?v=2')
  : item.src;

function Gallery() {
  const [active, setActive] = useState(items.length - 1);
  const thumbnailRefs = useRef([]);
  const touchStart = useRef(null);

  const show = (index) => setActive((index + items.length) % items.length);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % items.length), 3000);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    thumbnailRefs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [active]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight') show(active + 1);
      if (event.key === 'ArrowLeft') show(active - 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  const item = items[active];

  return (
    <div className="gallery-viewer">
      <div className="gallery-stage" aria-live="off"
        onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const distance = event.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(distance) > 40) show(active + (distance < 0 ? 1 : -1));
          touchStart.current = null;
        }}>
        {item.type === 'video' ? (
          <video key={item.src} src={item.src} poster={thumbnailSource(item)} muted loop autoPlay playsInline controls preload="metadata" aria-label={item.alt} />
        ) : (
          <img key={item.src} src={item.src} alt={item.alt} width={item.width} height={item.height} />
        )}
      </div>
      <div className="gallery-controls">
        <button className="gallery-control" type="button" onClick={() => show(active - 1)} aria-label="Previous image">← PREV</button>
        <p className="gallery-caption"><span className="gallery-count">{String(active + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>{item.alt}</p>
        <button className="gallery-control" type="button" onClick={() => show(active + 1)} aria-label="Next image">NEXT →</button>
      </div>
      <div className="gallery-thumbnail-strip" aria-label="Gallery thumbnails">
        {items.map((entry, index) => (
          <button key={entry.src} ref={(node) => { thumbnailRefs.current[index] = node; }} className="gallery-thumbnail" type="button" onClick={() => show(index)} aria-label={`Show ${entry.alt}, ${index + 1} of ${items.length}`} aria-current={index === active ? 'true' : undefined}>
            <img src={thumbnailSource(entry)} alt="" loading={index < 8 ? 'eager' : 'lazy'} />
            {entry.type === 'video' && <span className="thumbnail-play" aria-hidden="true">▶</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('gallery-root')).render(<Gallery />);
