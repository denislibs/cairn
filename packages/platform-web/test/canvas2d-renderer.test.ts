import { test, expect } from 'vitest';
import { Canvas2DRenderer } from '../src/index';
import { createFakeSurface } from './fakes';

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
