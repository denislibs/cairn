import { describe, it, expect } from 'vitest';
import { paint, type Instance } from '../src/instance';
import { BoxNode } from '@cairn/layout';

function leaf(z: number, tag: string, log: string[]): Instance {
  const layout = new BoxNode({}); layout.size = { w: 1, h: 1 }; layout.zIndex = z;
  return { layout, children: [], paintSelf() { log.push(tag); } };
}

it('paints children in ascending zIndex, stable for ties', () => {
  const log: string[] = [];
  const parent: Instance = {
    layout: Object.assign(new BoxNode({}), { size: { w: 10, h: 10 } }),
    children: [leaf(2, 'a', log), leaf(1, 'b', log), leaf(1, 'c', log)],
    paintSelf() {},
  };
  const r: any = new Proxy({}, { get: () => () => {} });
  paint(parent, r);
  expect(log).toEqual(['b', 'c', 'a']);
});
