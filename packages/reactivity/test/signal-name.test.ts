import { describe, it, expect, afterEach } from 'vitest';
import { createSignal } from '../src/index';
import { setReactiveDevHooks } from '../src/core';

afterEach(() => setReactiveDevHooks(null));

describe('signal name', () => {
  it('passes the name through to onSignalCreate', () => {
    const names: (string | undefined)[] = [];
    setReactiveDevHooks({ onSignalCreate: (n) => names.push((n as { name?: string }).name) });
    createSignal(0, { name: 'count' });
    createSignal(1);
    expect(names).toEqual(['count', undefined]);
  });
});
