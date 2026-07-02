import { test, expect, afterEach } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, useHost, type Instance } from '../src/index';
import { createFakeHost } from './fake-host';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

test('useHost returns the mounted host inside the tree', () => {
  const { host } = createFakeHost();
  let seen: unknown;
  const comp = (): Instance => {
    seen = useHost();
    return { layout: new BoxNode({ width: 1, height: 1 }), children: [], paintSelf() {} };
  };
  dispose = mount(comp, host);
  expect(seen).toBe(host);
});

test('useHost throws outside a mount', () => {
  expect(() => useHost()).toThrow(/useHost/);
});
