// Flat preview of the four panels in the home page installation.
// Multiply removes light channels that each sheet blocks; the faint screen pass
// and outlines keep the acrylic visible against a black frame.
window.applyAcrylicView = function applyAcrylicView(ctx, width, height) {
  const panels = [
    { x: -.10, y: -.13, width: .67, height: .60, color: '#FDFF00' }, // yellow, top left
    { x: .43, y: -.20, width: .67, height: .60, color: '#11FF00' }, // green, top right
    { x: -.06, y: .35, width: .67, height: .60, color: '#FF0505' }, // red, bottom left
    { x: .47, y: .29, width: .67, height: .60, color: '#2600FF' }  // blue, bottom right
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
