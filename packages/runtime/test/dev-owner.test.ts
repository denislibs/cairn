import { describe, it, expect, afterEach } from 'vitest';
import type { Instance } from '../src/instance';
import { runWithDevOwner, getDevOwner, activateDevOwner, deactivateDevOwner } from '../src/dev-owner';

afterEach(() => deactivateDevOwner());

function inst(): Instance {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 } } as any, children: [], paintSelf() {} };
}

describe('dev-owner', () => {
  it('is inert until activated (no owner, still runs fn)', () => {
    const a = inst();
    let ran = false;
    const r = runWithDevOwner(a, 'style', () => { ran = true; return getDevOwner(); });
    expect(ran).toBe(true);
    expect(r).toBeNull();          // inactive → no owner tracked
    expect(getDevOwner()).toBeNull();
  });

  it('exposes the owner during fn when active, restores after', () => {
    activateDevOwner();
    const a = inst();
    let during: any = null;
    runWithDevOwner(a, 'style', () => { during = getDevOwner(); });
    expect(during).toEqual({ inst: a, label: 'style' });
    expect(getDevOwner()).toBeNull(); // restored (prev was null)
  });

  it('nests and restores the previous owner', () => {
    activateDevOwner();
    const a = inst(), b = inst();
    let inner: any = null, afterInner: any = null;
    runWithDevOwner(a, 'a', () => {
      runWithDevOwner(b, 'b', () => { inner = getDevOwner(); });
      afterInner = getDevOwner();
    });
    expect(inner).toEqual({ inst: b, label: 'b' });
    expect(afterInner).toEqual({ inst: a, label: 'a' });
  });
});
