import { test, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { setFrameRequester, Index, bind, type Instance } from '../src/index';

// A leaf whose __tag reactively follows its item accessor.
function leaf(item: () => string): Instance {
  const inst = { layout: new BoxNode({ width: 10, height: 10 }), children: [], paintSelf() {}, __tag: '' } as unknown as {
    layout: BoxNode;
    children: Instance[];
    paintSelf(): void;
    __tag: string;
  };
  bind(item, (v) => (inst.__tag = v));
  return inst as unknown as Instance;
}
const tags = (i: Instance) => i.children.map((c) => (c as unknown as { __tag: string }).__tag);

test('Index updates values in place (same instance) and grows/shrinks', () => {
  setFrameRequester(() => {});
  const [rows, setRows] = createSignal(['a', 'b']);
  let idx!: Instance;
  const dispose = createRoot((d) => {
    idx = Index({ each: () => rows(), children: (item) => leaf(item) });
    return d;
  });
  expect(tags(idx)).toEqual(['a', 'b']);
  const first = idx.children[0];
  setRows(['x', 'b']);
  expect(tags(idx)).toEqual(['x', 'b']);
  expect(idx.children[0]).toBe(first);
  setRows(['x', 'b', 'c']);
  expect(tags(idx)).toEqual(['x', 'b', 'c']);
  setRows(['x']);
  expect(tags(idx)).toEqual(['x']);
  dispose();
  setFrameRequester(null);
});
