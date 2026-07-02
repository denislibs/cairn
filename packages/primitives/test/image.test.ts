import { describe, it, expect } from 'vitest';
import { computeObjectFit } from '../src/image';
const dest = { x: 0, y: 0, width: 100, height: 100 };
const nat = { w: 200, h: 100 }; // 2:1
describe('computeObjectFit', () => {
  it('fill stretches to dest, full src', () => {
    const r = computeObjectFit('fill', dest, nat);
    expect(r.dest).toEqual(dest);
    expect(r.src).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });
  it('contain letterboxes centered', () => {
    const r = computeObjectFit('contain', dest, nat); // 2:1 into 1:1 -> 100x50 centered
    expect(r.dest).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    expect(r.src).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });
  it('cover crops src to fill dest', () => {
    const r = computeObjectFit('cover', dest, nat); // crop width to 100 of src (centered)
    expect(r.dest).toEqual(dest);
    expect(r.src).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });
});
