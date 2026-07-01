import { test, expect } from 'vitest';
import { Canvas2DRenderer } from '../src/index';
import { createFakeSurface } from './fakes';
import { createPath } from '@cairn/host';

test('resize sizes the backing store by DPR and sets the transform', () => {
  const { surface, ctx, sizes } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.resize(300, 150, 2);
  expect(sizes).toEqual([[600, 300]]); // logical * dpr
  expect(ctx.calls).toContainEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
});

test('clear without a rect clears the whole logical area', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.resize(300, 150, 1);
  r.clear();
  expect(ctx.calls).toContainEqual(['clearRect', 0, 0, 300, 150]);
});

test('clear with a rect clears just that rect', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.resize(300, 150, 1);
  r.clear({ x: 10, y: 20, width: 30, height: 40 });
  expect(ctx.calls).toContainEqual(['clearRect', 10, 20, 30, 40]);
});

test('beginFrame / endFrame save and restore context state', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.beginFrame();
  r.endFrame();
  const names = ctx.calls.map((c) => c[0]);
  expect(names).toEqual(['save', 'restore']);
});

test('translate / scale / clipRect map to ctx calls', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.translate(5, 6);
  r.scale(2, 3);
  r.clipRect({ x: 1, y: 2, width: 3, height: 4 });
  expect(ctx.calls).toContainEqual(['translate', 5, 6]);
  expect(ctx.calls).toContainEqual(['scale', 2, 3]);
  expect(ctx.calls).toContainEqual(['rect', 1, 2, 3, 4]);
  expect(ctx.calls).toContainEqual(['clip']);
});

test('setShadow sets shadow props; null resets them', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.setShadow({ color: '#0008', blur: 4, offsetX: 1, offsetY: 2 });
  expect(ctx.calls).toContainEqual(['set:shadowColor', '#0008']);
  expect(ctx.calls).toContainEqual(['set:shadowBlur', 4]);
  expect(ctx.calls).toContainEqual(['set:shadowOffsetX', 1]);
  expect(ctx.calls).toContainEqual(['set:shadowOffsetY', 2]);

  r.setShadow(null);
  expect(ctx.calls).toContainEqual(['set:shadowColor', 'rgba(0,0,0,0)']);
  expect(ctx.calls).toContainEqual(['set:shadowBlur', 0]);
});

test('fillRect sets a solid fill then fills', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRect({ x: 1, y: 2, width: 3, height: 4 }, { color: '#f00' });
  expect(ctx.calls).toContainEqual(['set:fillStyle', '#f00']);
  expect(ctx.calls).toContainEqual(['fillRect', 1, 2, 3, 4]);
});

test('strokeRect sets stroke color + width then strokes', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.strokeRect({ x: 0, y: 0, width: 10, height: 10 }, { color: '#00f', width: 2 });
  expect(ctx.calls).toContainEqual(['set:strokeStyle', '#00f']);
  expect(ctx.calls).toContainEqual(['set:lineWidth', 2]);
  expect(ctx.calls).toContainEqual(['strokeRect', 0, 0, 10, 10]);
});

test('fillRect with a linear gradient builds the gradient with stops', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRect(
    { x: 0, y: 0, width: 10, height: 10 },
    {
      gradient: {
        kind: 'linear',
        from: { x: 0, y: 0 },
        to: { x: 10, y: 0 },
        stops: [
          { offset: 0, color: '#000' },
          { offset: 1, color: '#fff' },
        ],
      },
    },
  );
  expect(ctx.calls).toContainEqual(['createLinearGradient', 0, 0, 10, 0]);
  expect(ctx.calls).toContainEqual(['addColorStop', 0, '#000']);
  expect(ctx.calls).toContainEqual(['addColorStop', 1, '#fff']);
});

test('fillRect with a radial gradient uses createRadialGradient (inner radius 0)', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRect(
    { x: 0, y: 0, width: 20, height: 20 },
    {
      gradient: {
        kind: 'radial',
        center: { x: 10, y: 10 },
        radius: 10,
        stops: [{ offset: 0.5, color: '#abc' }],
      },
    },
  );
  expect(ctx.calls).toContainEqual(['createRadialGradient', 10, 10, 0, 10, 10, 10]);
  expect(ctx.calls).toContainEqual(['addColorStop', 0.5, '#abc']);
});

test('gradient takes precedence over color when both are set', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRect(
    { x: 0, y: 0, width: 5, height: 5 },
    {
      color: '#f00',
      gradient: { kind: 'linear', from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, stops: [] },
    },
  );
  expect(ctx.calls).toContainEqual(['createLinearGradient', 0, 0, 5, 0]);
  // the solid color must NOT have been applied as the fill style
  expect(ctx.calls).not.toContainEqual(['set:fillStyle', '#f00']);
});

test('fillRoundRect uses roundRect with normalized radii then fills', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRoundRect({ x: 1, y: 2, width: 10, height: 20 }, 4, { color: '#abc' });
  expect(ctx.calls).toContainEqual(['set:fillStyle', '#abc']);
  expect(ctx.calls).toContainEqual(['beginPath']);
  expect(ctx.calls).toContainEqual(['roundRect', 1, 2, 10, 20, [4, 4, 4, 4]]);
  expect(ctx.calls).toContainEqual(['fill']);
});

test('fillRoundRect accepts per-corner radii', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRoundRect(
    { x: 0, y: 0, width: 8, height: 8 },
    { tl: 1, tr: 2, br: 3, bl: 4 },
    { color: '#000' },
  );
  expect(ctx.calls).toContainEqual(['roundRect', 0, 0, 8, 8, [1, 2, 3, 4]]);
});

test('strokeRoundRect strokes a rounded rect with normalized radii', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.strokeRoundRect({ x: 1, y: 1, width: 12, height: 6 }, 3, { color: '#0a0', width: 2 });
  expect(ctx.calls).toContainEqual(['set:strokeStyle', '#0a0']);
  expect(ctx.calls).toContainEqual(['set:lineWidth', 2]);
  expect(ctx.calls).toContainEqual(['beginPath']);
  expect(ctx.calls).toContainEqual(['roundRect', 1, 1, 12, 6, [3, 3, 3, 3]]);
  expect(ctx.calls).toContainEqual(['stroke']);
});

test('fillPath plays back the path commands then fills', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const path = createPath().moveTo(0, 0).lineTo(10, 0).quadTo(10, 10, 0, 10).close().build();
  r.fillPath(path, { color: '#123' });
  expect(ctx.calls).toContainEqual(['beginPath']);
  expect(ctx.calls).toContainEqual(['moveTo', 0, 0]);
  expect(ctx.calls).toContainEqual(['lineTo', 10, 0]);
  expect(ctx.calls).toContainEqual(['quadraticCurveTo', 10, 10, 0, 10]);
  expect(ctx.calls).toContainEqual(['closePath']);
  expect(ctx.calls).toContainEqual(['fill']);
});

test('strokePath plays back the path then strokes', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const path = createPath().moveTo(0, 0).arc(5, 5, 5, 0, 3.14).build();
  r.strokePath(path, { color: '#456', width: 3 });
  expect(ctx.calls).toContainEqual(['moveTo', 0, 0]);
  expect(ctx.calls).toContainEqual(['arc', 5, 5, 5, 0, 3.14]);
  expect(ctx.calls).toContainEqual(['set:lineWidth', 3]);
  expect(ctx.calls).toContainEqual(['stroke']);
});

test('drawText sets font/color/align/baseline then fills text', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.drawText('hi', { x: 3, y: 4 }, {
    font: '16px sans-serif',
    color: '#222',
    align: 'center',
    baseline: 'middle',
  });
  expect(ctx.calls).toContainEqual(['set:font', '16px sans-serif']);
  expect(ctx.calls).toContainEqual(['set:fillStyle', '#222']);
  expect(ctx.calls).toContainEqual(['set:textAlign', 'center']);
  expect(ctx.calls).toContainEqual(['set:textBaseline', 'middle']);
  expect(ctx.calls).toContainEqual(['fillText', 'hi', 3, 4]);
});

test('measureText sets the font and returns the measured width', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const m = r.measureText('hello', { font: '10px monospace' });
  expect(ctx.calls).toContainEqual(['set:font', '10px monospace']);
  expect(ctx.calls).toContainEqual(['measureText', 'hello']);
  expect(m.width).toBe(35); // fake: 5 chars * 7
});

test('drawImage draws with dest only', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const img = { width: 20, height: 10 };
  r.drawImage(img, { x: 1, y: 2, width: 20, height: 10 });
  expect(ctx.calls).toContainEqual(['drawImage', img, 1, 2, 20, 10]);
});

test('drawImage draws with src and dest rects', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const img = { width: 20, height: 10 };
  r.drawImage(img, { x: 0, y: 0, width: 10, height: 5 }, { x: 2, y: 3, width: 4, height: 6 });
  expect(ctx.calls).toContainEqual(['drawImage', img, 2, 3, 4, 6, 0, 0, 10, 5]);
});
