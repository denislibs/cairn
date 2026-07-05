import { describe, it, expect } from 'vitest';
import { createRoot, createEffect } from '@cairn/reactivity';
import type { Instance } from '../src/instance';
import { readStyleOverride, setStyleProp } from '../src/dev-style-override';

function inst(): Instance {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 } } as any, children: [], paintSelf() {} };
}

describe('dev-style-override inactive path (never activated)', () => {
  it('readStyleOverride does not subscribe when inactive', () => {
    const a = inst();
    let runs = 0;
    createRoot(() => { createEffect(() => { readStyleOverride(a); runs++; }); });
    expect(runs).toBe(1);
    setStyleProp(a, 'backgroundColor', '#f00'); // bumps version, but no inactive reader is subscribed
    expect(runs).toBe(1); // MUST NOT re-run
    expect(readStyleOverride(a)).toBeUndefined(); // still inactive → undefined
  });
});
