// Flat preview of the four panels in the home page installation.
// Multiply removes light channels that each sheet blocks; the faint screen pass
// and outlines keep the acrylic visible against a black frame.
window.applyAcrylicView = function applyAcrylicView(ctx, width, height) {
  const panels = [
    { x: .02, y: .02, width: .51, height: .51, color: '#FDFF00' },
    { x: .47, y: .02, width: .51, height: .51, color: '#11FF00' },
    { x: .02, y: .47, width: .51, height: .51, color: '#FF0505' },
    { x: .47, y: .47, width: .51, height: .51, color: '#2600FF' }
  ];

  ctx.save();
  for (const panel of panels) {
    const x = panel.x * width;
    const y = panel.y * height;
    const w = panel.width * width;
    const h = panel.height * height;

    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = .9;
    ctx.fillStyle = panel.color;
    ctx.fillRect(x, y, w, h);

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = .035;
    ctx.fillRect(x, y, w, h);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .42;
    ctx.strokeStyle = panel.color;
    ctx.lineWidth = Math.max(1, width / 800);
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
};
