import { describe, it, expect, beforeEach } from 'vitest';
import { signalId, resetSignalIds } from '../src/signal-id';
import { SignalRegistry } from '../src/signal-registry';

// A SignalState-shaped fake (value, observers, name?)
function sig(value: unknown, name?: string, observers: any[] | null = null): any {
  return { value, observers, equals: (a: any, b: any) => a === b, name };
}

describe('signalId', () => {
  beforeEach(() => resetSignalIds());
  it('is stable per node and unique across nodes', () => {
    const a = sig(1), b = sig(2);
    expect(signalId(a)).toBe(signalId(a));
    expect(signalId(a)).not.toBe(signalId(b));
  });
});

describe('SignalRegistry', () => {
  beforeEach(() => resetSignalIds());
  it('lists registered live signals with name/value/type/observers', () => {
    const reg = new SignalRegistry();
    const count = sig(3, 'count', [{ isEffect: true }, { isEffect: false }, { isEffect: true }]);
    reg.note(count);
    reg.note(sig('hi'));
    const list = reg.list();
    expect(list.length).toBe(2);
    const c = list.find((s) => s.name === 'count')!;
    expect(c).toBeTruthy();
    expect(c.value).toBe('3');
    expect(c.type).toBe('number');
    expect(c.observers).toBe(2); // only isEffect observers counted
  });
  it('resolve returns the node for its id', () => {
    const reg = new SignalRegistry();
    const n = sig(1, 'x');
    reg.note(n);
    const id = signalId(n);
    expect(reg.resolve(id)).toBe(n);
    expect(reg.resolve(999999)).toBeUndefined();
  });
});
