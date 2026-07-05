import { describe, it, expect, beforeEach } from 'vitest';
import { createRoot, createEffect } from '@cairn/reactivity';
import type { Instance } from '../src/instance';
import {
  activateStyleOverrides, deactivateStyleOverrides, readStyleOverride, applyStyleOverride,
  setStyleProp, toggleStyleProp, removeStyleProp, clearStyleOverride,
} from '../src/dev-style-override';

function inst(): Instance {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 } } as any, children: [], paintSelf() {} };
}

describe('applyStyleOverride', () => {
  it('returns base unchanged when no override', () => {
    const base = { backgroundColor: '#fff' } as any;
    expect(applyStyleOverride(base, undefined)).toBe(base);
  });
  it('applies patch over base and drops disabled keys', () => {
    const base = { backgroundColor: '#fff', opacity: 1 } as any;
    const out = applyStyleOverride(base, { patch: { backgroundColor: '#f00' }, disabled: new Set(['opacity']) });
    expect(out).toEqual({ backgroundColor: '#f00' });
    expect(base).toEqual({ backgroundColor: '#fff', opacity: 1 }); // base untouched
  });
});

describe('override store reactivity', () => {
  beforeEach(() => activateStyleOverrides());

  it('returns undefined for an instance with no edits', () => {
    expect(readStyleOverride(inst())).toBeUndefined();
  });

  it('setStyleProp is visible to readStyleOverride and re-runs a reader effect', () => {
    const a = inst();
    let runs = 0; let seen: unknown;
    createRoot(() => {
      createEffect(() => { const o = readStyleOverride(a); seen = o?.patch.backgroundColor; runs++; });
    });
    expect(runs).toBe(1);
    setStyleProp(a, 'backgroundColor', '#f00');
    expect(runs).toBe(2);
    expect(seen).toBe('#f00');
  });

  it('toggle bumps only on a real change', () => {
    const a = inst();
    let runs = 0;
    createRoot(() => { createEffect(() => { readStyleOverride(a); runs++; }); });
    expect(runs).toBe(1);
    toggleStyleProp(a, 'opacity', true); // not disabled → no-op, no bump
    expect(runs).toBe(1);
    toggleStyleProp(a, 'opacity', false); // real change → bump
    expect(runs).toBe(2);
    toggleStyleProp(a, 'opacity', false); // already disabled → no-op
    expect(runs).toBe(2);
    toggleStyleProp(a, 'opacity', true); // real change → bump
    expect(runs).toBe(3);
  });

  it('toggle disables/enables and remove/clear reset a prop', () => {
    const a = inst();
    setStyleProp(a, 'opacity', 0.5);
    toggleStyleProp(a, 'opacity', false);
    expect(readStyleOverride(a)?.disabled.has('opacity')).toBe(true);
    toggleStyleProp(a, 'opacity', true);
    expect(readStyleOverride(a)?.disabled.has('opacity')).toBe(false);
    removeStyleProp(a, 'opacity');
    expect(readStyleOverride(a)?.patch.opacity).toBeUndefined();
    clearStyleOverride(a);
    expect(readStyleOverride(a)).toBeUndefined();
  });

  it('deactivate restores the inert path', () => {
    const a = inst();
    activateStyleOverrides();
    setStyleProp(a, 'opacity', 0.5);
    expect(readStyleOverride(a)).toBeTruthy();
    deactivateStyleOverrides();
    expect(readStyleOverride(a)).toBeUndefined(); // inert again
    activateStyleOverrides(); // restore for other tests in this file
  });
});
