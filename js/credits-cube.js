(() => {
  const host = document.querySelector('.credits-cube');
  if (!host || !window.p5) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = Array.from({ length: 230 }, () => ({
    x: Math.random() * 1.82 - .91,
    z: Math.random() * 1.82 - .91,
    phase: Math.random(),
    speed: .15 + Math.random() * .23,
    size: 1.6 + Math.random() * 2.3
  }));
  const corners = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  new window.p5((p) => {
    let side = 243;
    let elapsed = 0;
    let lastFrame = 0;

    function resize() {
      side = host.clientWidth;
      p.resizeCanvas(side, side);
      if (reducedMotion.matches) p.redraw();
    }

    function project(x, y, z, angle) {
      const yaw = Math.cos(angle);
      const sinYaw = Math.sin(angle);
      const rx = x * yaw - z * sinYaw;
      const rz = x * sinYaw + z * yaw;
      const pitch = -.23;
      const ry = y * Math.cos(pitch) - rz * Math.sin(pitch);
      const depth = y * Math.sin(pitch) + rz * Math.cos(pitch);
      const perspective = 3.8 / (3.8 - depth);
      return { x: rx * perspective, y: ry * perspective, depth, perspective };
    }

    function fit(point, scale) {
      return { ...point, x: side / 2 + point.x * scale, y: side / 2 + point.y * scale };
    }

    p.setup = () => {
      side = host.clientWidth;
      const canvas = p.createCanvas(side, side);
      canvas.parent(host);
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      p.frameRate(30);
      p.noLoop();
      host.classList.add('is-live');
      p.redraw();
    };

    p.draw = () => {
      const now = p.millis();
      if (lastFrame) elapsed += Math.min((now - lastFrame) / 1000, .05);
      lastFrame = now;
      const angle = .76 + (reducedMotion.matches ? 0 : elapsed * .27);
      p.background(0);

      // Fit the full rotating wireframe, including its perspective extremes,
      // before drawing the particles into the same coordinate system.
      const cube = corners.map(([x, y, z]) => project(x, y, z, angle));
      const extentX = Math.max(...cube.map((point) => Math.abs(point.x)));
      const extentY = Math.max(...cube.map((point) => Math.abs(point.y)));
      const scale = Math.min(side * .43 / extentX, side * .43 / extentY);

      const falling = particles.map((particle) => {
        const progress = (particle.phase + elapsed * particle.speed) % 1;
        const y = -.94 + Math.pow(progress, 1.25) * 1.88;
        return { ...particle, point: fit(project(particle.x, y, particle.z, angle), scale) };
      }).sort((a, b) => a.point.depth - b.point.depth);

      p.noStroke();
      p.fill(255, 45, 12);
      falling.forEach(({ point, size }) => {
        const pixel = Math.max(1, size * point.perspective * side / 243);
        p.rect(Math.round(point.x), Math.round(point.y), pixel, pixel);
      });

      const projectedCorners = cube.map((point) => fit(point, scale));
      p.noFill();
      p.stroke(0, 255, 0);
      p.strokeWeight(Math.max(.65, side / 243));
      edges.forEach(([a, b]) => {
        const start = projectedCorners[a];
        const end = projectedCorners[b];
        p.line(start.x, start.y, end.x, end.y);
      });
    };

    p.windowResized = resize;

    const visibility = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !reducedMotion.matches) {
        lastFrame = 0;
        p.loop();
      } else {
        p.noLoop();
      }
    }, { threshold: .05 });
    visibility.observe(host);
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        p.noLoop();
        p.redraw();
      } else if (host.getBoundingClientRect().top < innerHeight && host.getBoundingClientRect().bottom > 0) {
        lastFrame = 0;
        p.loop();
      }
    });
  }, host);
})();
