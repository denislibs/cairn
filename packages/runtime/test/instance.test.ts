import { test, expect } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { paint, type Instance } from '../src/index';
import { createFakeRenderer } from './fake-host';

function node(offsetX: number, offsetY: number, marker: string, children: Instance[] = []): Instance {
  const layout = new BoxNode({ width: 10, height: 10 });
  layout.offsetX = offsetX;
  layout.offsetY = offsetY;
  return {
    layout,
    children,
    paintSelf(r) {
      r.fillRect({ x: 0, y: 0, width: 10, height: 10 }, { color: marker });
    },
  };
}

test('paint walks the tree: save/translate/paintSelf/recurse/restore', () => {
  const child = node(3, 4, 'child');
  const root = node(0, 0, 'root', [child]);
  const r = createFakeRenderer();
  paint(root, r);
  expect(r.calls).toEqual([
    ['save'],
    ['translate', 0, 0],
    ['fillRect', { x: 0, y: 0, width: 10, height: 10 }, { color: 'root' }],
    ['save'],
    ['translate', 3, 4],
    ['fillRect', { x: 0, y: 0, width: 10, height: 10 }, { color: 'child' }],
    ['restore'],
    ['restore'],
  ]);
});
