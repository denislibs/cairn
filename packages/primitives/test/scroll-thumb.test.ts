import { describe, it, expect } from 'vitest';
import { scrollThumb } from '../src/scroll-view';

describe('scrollThumb', () => {
  it('hidden when content fits', () => {
    const t = scrollThumb(100, 80, 0);
    expect(t.visible).toBe(false);
  });

  it('size proportional, clamped to min', () => {
    const t = scrollThumb(100, 400, 0); // 100*100/400 = 25
    expect(t.visible).toBe(true);
    expect(t.size).toBe(25);
    expect(t.offset).toBe(0);
  });

  it('offset tracks scroll fraction', () => {
    const t = scrollThumb(100, 200, 100); // maxScroll 100, size=50, track=50 → offset = 1*50 = 50
    expect(t.size).toBe(50);
    expect(t.offset).toBe(50);
  });

  it('min size clamp', () => {
    const t = scrollThumb(100, 100000, 0); // tiny → clamp to 24
    expect(t.size).toBe(24);
  });
});
