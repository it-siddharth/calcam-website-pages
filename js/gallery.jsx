import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Lightbox from '@ramka/react/lightbox';

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

function Gallery() {
  return (
    <Lightbox.Root count={items.length}>
      <div className="gallery-grid">
        {items.map((item, index) => (
          <Lightbox.Trigger
            key={item.src}
            index={index}
            className={`gallery-tile ${item.type === 'video' ? 'gallery-tile-video' : ''}`}
            aria-label={`Open frame ${index + 1} of ${items.length}: ${item.alt}`}
            crossfade={item.type === 'video' ? 'both' : undefined}
          >
            {({ imageRef }) => (
              <>
                <span className="tile-media">
                  {item.type === 'video' ? (
                    <video src={item.src} poster={item.src.replace('assets/videos/', 'assets/gallery-thumbs/').replace('.mp4', '.jpg')} muted loop autoPlay playsInline preload="metadata" aria-hidden="true" />
                  ) : (
                    <img ref={imageRef} src={item.src} alt="" width={item.width} height={item.height} loading={index < 4 ? 'eager' : 'lazy'} />
                  )}
                </span>
                <span className="tile-meta"><span>{String(index + 1).padStart(2, '0')}</span><span>{item.type === 'video' ? 'FILM ↗' : 'VIEW ↗'}</span></span>
              </>
            )}
          </Lightbox.Trigger>
        ))}
      </div>

      <Lightbox.Portal>
        <Lightbox.Backdrop className="lightbox-backdrop" />
        <Lightbox.Content className="lightbox-content" aria-label="Gallery viewer">
          <div className="lightbox-topbar">
            <span>CALCULATED CAMOUFLAGE / GALLERY</span>
            <Lightbox.Counter className="lightbox-counter" />
            <Lightbox.Close className="lightbox-control lightbox-close" aria-label="Close gallery viewer">CLOSE ✕</Lightbox.Close>
          </div>

          <Lightbox.Slides className="lightbox-slides" aria-label="Gallery frames" aria-roledescription="carousel" preload={1}>
            {items.map((item, index) => (
              <Lightbox.Slide className="lightbox-slide" key={item.src}>
                <Lightbox.Item index={index} caption={item.alt} aria-roledescription="slide" aria-label={`${index + 1} of ${items.length}`}>
                  <Lightbox.Zoom>
                    <Lightbox.Media width={item.width} height={item.height}>
                      {item.type === 'video' ? (
                        <video src={item.src} muted loop autoPlay controls playsInline preload="metadata" aria-label={item.alt} />
                      ) : (
                        <img src={item.src} alt={item.alt} width={item.width} height={item.height} />
                      )}
                    </Lightbox.Media>
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>

          <div className="lightbox-bottombar">
            <Lightbox.Previous className="lightbox-control" aria-label="Previous frame">← PREV</Lightbox.Previous>
            <Lightbox.Caption className="lightbox-caption" />
            <Lightbox.Next className="lightbox-control" aria-label="Next frame">NEXT →</Lightbox.Next>
          </div>

          <Lightbox.ThumbnailStrip className="lightbox-thumbnail-strip">
            <Lightbox.ThumbnailStripTrack className="lightbox-thumbnail-track" aria-label="Gallery thumbnails">
              {items.map((item, index) => (
                <Lightbox.Thumbnail
                  className="lightbox-thumbnail"
                  key={item.src}
                  index={index}
                  aria-label={`Show frame ${index + 1}: ${item.alt}`}
                >
                  <img
                    src={item.type === 'video' ? item.src.replace('assets/videos/', 'assets/gallery-thumbs/').replace('.mp4', '.jpg') : item.src}
                    alt=""
                    loading="lazy"
                  />
                  {item.type === 'video' && <span className="thumbnail-play" aria-hidden="true">▶</span>}
                </Lightbox.Thumbnail>
              ))}
            </Lightbox.ThumbnailStripTrack>
          </Lightbox.ThumbnailStrip>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}

createRoot(document.getElementById('gallery-root')).render(<Gallery />);
