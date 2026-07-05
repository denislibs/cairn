import { describe, it, expect } from 'vitest';
import { canvasRectToPage, pagePointToCanvas } from '../src/highlight';

function fakeCanvas(box: { left: number; top: number; width: number; height: number }): HTMLCanvasElement {
  return { getBoundingClientRect: () => box } as unknown as HTMLCanvasElement;
}

describe('coordinate math', () => {
  it('maps a canvas-space rect to page px (1:1 css size)', () => {
    const canvas = fakeCanvas({ left: 10, top: 20, width: 200, height: 100 });
    const page = canvasRectToPage(canvas, { x: 5, y: 5, w: 50, h: 25 }, { w: 200, h: 100 });
    expect(page).toEqual({ x: 15, y: 25, w: 50, h: 25 });
  });
  it('scales when the canvas is css-resized', () => {
    const canvas = fakeCanvas({ left: 0, top: 0, width: 400, height: 200 });
    const page = canvasRectToPage(canvas, { x: 10, y: 10, w: 20, h: 20 }, { w: 200, h: 100 });
    expect(page).toEqual({ x: 20, y: 20, w: 40, h: 40 });
  });
  it('inverts page point back to canvas space', () => {
    const canvas = fakeCanvas({ left: 0, top: 0, width: 400, height: 200 });
    const p = pagePointToCanvas(canvas, 20, 20, { w: 200, h: 100 });
    expect(p).toEqual({ x: 10, y: 10 });
  });
});
