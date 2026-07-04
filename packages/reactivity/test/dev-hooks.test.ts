import { describe, it, expect, afterEach } from 'vitest';
import { createSignal, createEffect, createRoot } from '../src/index';
import { setReactiveDevHooks } from '../src/core';

afterEach(() => setReactiveDevHooks(null));

describe('reactive dev hooks', () => {
  it('fires onSignalCreate when a signal is created', () => {
    let created = 0;
    setReactiveDevHooks({ onSignalCreate: () => { created++; } });
    createSignal(0);
    expect(created).toBe(1);
  });

  it('fires onSignalWrite with prev and next on a real change', () => {
    const writes: Array<[unknown, unknown]> = [];
    setReactiveDevHooks({ onSignalWrite: (_n, prev, next) => { writes.push([prev, next]); } });
    const [, set] = createSignal(1);
    set(2);
    set(2); // no-op (equal) — must not fire
    expect(writes).toEqual([[1, 2]]);
  });

  it('fires onComputationRun when an effect runs', () => {
    let runs = 0;
    setReactiveDevHooks({ onComputationRun: (n) => { if ((n as { isEffect?: boolean }).isEffect) runs++; } });
    createRoot(() => {
      const [get, set] = createSignal(0);
      createEffect(() => { get(); });
      set(1);
    });
    expect(runs).toBeGreaterThanOrEqual(2); // initial run + after set
  });

  it('does nothing after hooks are cleared', () => {
    let created = 0;
    setReactiveDevHooks({ onSignalCreate: () => { created++; } });
    setReactiveDevHooks(null);
    createSignal(0);
    expect(created).toBe(0);
  });
});
