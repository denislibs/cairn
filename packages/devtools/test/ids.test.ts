import { describe, it, expect, beforeEach } from 'vitest';
import type { Instance } from '@cairn/runtime';
import { idOf, instanceById, resetIds } from '../src/ids';

function fakeInstance(): Instance {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 } } as any, children: [], paintSelf() {} };
}

describe('ids', () => {
  beforeEach(() => resetIds());

  it('returns the same id for the same instance', () => {
    const a = fakeInstance();
    expect(idOf(a)).toBe(idOf(a));
  });

  it('returns different ids for different instances', () => {
    expect(idOf(fakeInstance())).not.toBe(idOf(fakeInstance()));
  });

  it('resolves an instance back by id', () => {
    const a = fakeInstance();
    const id = idOf(a);
    expect(instanceById(id)).toBe(a);
  });

  it('returns undefined for an unknown id', () => {
    expect(instanceById(999999)).toBeUndefined();
  });
});
