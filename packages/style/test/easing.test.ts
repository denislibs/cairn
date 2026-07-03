import { describe, it, expect } from 'vitest';
import { easings, cubicBezier, resolveEasing, spring } from '../src';
describe('easings', () => {
  it('endpoints are 0 and 1', () => {
    for (const name of ['linear','ease','ease-in','ease-out','ease-in-out'] as const) {
      expect(easings[name](0)).toBeCloseTo(0, 3);
      expect(easings[name](1)).toBeCloseTo(1, 3);
    }
  });
  it('linear is identity', () => {
    expect(easings.linear(0.5)).toBeCloseTo(0.5, 5);
  });
  it('cubicBezier linear params ≈ identity', () => {
    const f = cubicBezier(0, 0, 1, 1);
    expect(f(0.5)).toBeCloseTo(0.5, 2);
  });
  it('resolveEasing accepts name or fn or undefined', () => {
    expect(resolveEasing('linear')(0.5)).toBeCloseTo(0.5, 5);
    expect(resolveEasing((t) => t * t)(0.5)).toBeCloseTo(0.25, 5);
    expect(resolveEasing(undefined)(0.5)).toBeCloseTo(0.5, 5); // default linear
  });
  it('spring returns 0 at 0 and ~1 at 1', () => {
    const s = spring();
    expect(s(0)).toBeCloseTo(0, 2);
    expect(s(1)).toBeCloseTo(1, 1);
  });
});
