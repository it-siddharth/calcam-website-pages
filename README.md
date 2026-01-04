# Calculated Camouflage - Landing Page

A responsive single-viewport landing page for the "Calculated Camouflage" art installation, featuring an interactive 3D model of the installation.

## Features

- **Responsive Design**: Works seamlessly on desktop (1440px+) and mobile devices
- **Interactive 3D Model**: Built with Three.js, featuring:
  - TV monitor displaying the WORD SILHOUETTE webcam effect
  - Four colored acrylic panels with additive blending (lighten effect)
  - Support stand
- **3D Controls**:
  - Orbit controls (click and drag to rotate)
  - GUI sliders for precise X, Y, Z rotation
  - View presets (Front, Side, Top, Diagonal, Reset)
- **Typography**: Custom fonts matching the Figma design
  - 403 Super Vega (title)
  - Nanum Myeongjo (body text)
  - JetBrains Mono (labels, buttons)
  - Alegreya (arrow icons)

## Project Structure

```
calcam-website-pages/
├── index.html              # Main landing page
├── WORD SILHOUETTE.html    # Webcam text silhouette effect
├── css/
│   └── style.css           # Responsive styles
├── js/
│   └── scene.js            # Three.js 3D scene
├── fonts/
│   └── 403-super-vega-regular.woff
└── README.md
```

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/it-siddharth/calcam-website-pages.git
   ```

2. Serve the files using a local web server (required for ES modules and CORS):
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (npx)
   npx serve
   
   # Using VS Code Live Server extension
   ```

3. Open `http://localhost:8000` in your browser

## 3D Controls

- **Mouse/Touch**: Click and drag to orbit around the installation
- **Scroll/Pinch**: Zoom in/out
- **GUI Panel** (bottom-right):
  - X/Y/Z Rotation sliders
  - View preset buttons
  - Panel opacity control

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires WebGL support and ES Module support.

## Design Reference

- Desktop design: 1440x1024px viewport
- Mobile design: 393px width (iPhone 16)
- Based on Figma designs for "Calculated Camouflage" installation

## License

All rights reserved. This project is part of the Calculated Camouflage art installation.





