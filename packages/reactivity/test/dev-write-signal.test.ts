import { describe, it, expect } from 'vitest';
import { createRoot, createEffect } from '../src/index';
import { devWriteSignal, readSource, type SignalState } from '../src/core';

describe('devWriteSignal', () => {
  it('writes a signal node and triggers observers', () => {
    const node: SignalState<number> = { value: 1, observers: null, equals: (a, b) => a === b };
    let seen = -1; let runs = 0;
    createRoot(() => {
      createEffect(() => { seen = readSource(node); runs++; });
    });
    expect(runs).toBe(1);
    expect(seen).toBe(1);
    devWriteSignal(node, 42);
    expect(seen).toBe(42);
    expect(runs).toBe(2);
  });
});
