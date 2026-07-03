import { describe, it, expect } from 'vitest';
import { onNextLayout, flushAfterLayout } from '../src/scheduler';

describe('after-layout hook', () => {
  it('runs queued callbacks once on flush, then clears', () => {
    let n = 0;
    onNextLayout(() => n++);
    flushAfterLayout();
    expect(n).toBe(1);
    flushAfterLayout(); // queue empty now
    expect(n).toBe(1);
  });
  it('runs multiple callbacks', () => {
    const order: string[] = [];
    onNextLayout(() => order.push('a'));
    onNextLayout(() => order.push('b'));
    flushAfterLayout();
    expect(order).toEqual(['a', 'b']);
  });
});
