import { createWebHost } from '@cairn/platform-web';
import { createPath } from '@cairn/host';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);
const r = host.renderer;

function draw() {
  r.beginFrame();
  r.clear();

  r.setShadow({ color: '#0006', blur: 12, offsetX: 0, offsetY: 4 });
  r.fillRoundRect({ x: 40, y: 40, width: 220, height: 120 }, 16, {
    gradient: {
      kind: 'linear',
      from: { x: 40, y: 40 },
      to: { x: 260, y: 160 },
      stops: [
        { offset: 0, color: '#6ee7b7' },
        { offset: 1, color: '#3b82f6' },
      ],
    },
  });
  r.setShadow(null);

  r.drawText('Cairn', { x: 60, y: 110 }, {
    font: 'bold 40px sans-serif',
    color: '#0f172a',
    baseline: 'middle',
  });

  const tri = createPath().moveTo(320, 60).lineTo(420, 160).lineTo(320, 160).close().build();
  r.fillPath(tri, { color: '#f59e0b' });

  r.endFrame();
}

draw();
host.metrics.onResize(draw);
