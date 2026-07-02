import { test, expect } from 'vitest';
import { createRoot, createSignal, onCleanup } from '@cairn/reactivity';
import { BoxNode, FlexNode } from '@cairn/layout';
import { setFrameRequester, For, type Instance } from '../src/index';

function leaf(tag: string): Instance {
  return { layout: new BoxNode({ width: 10, height: 10 }), children: [], paintSelf() {}, ...({ __tag: tag } as object) } as Instance;
}
const tags = (i: Instance) => i.children.map((c) => (c as unknown as { __tag?: string }).__tag);

test('For maps items in order and reconciles by key (reuse + reorder + add + remove)', () => {
  setFrameRequester(() => {});
  const [items, setItems] = createSignal([{ id: 1 }, { id: 2 }]);
  let f!: Instance;
  const dispose = createRoot((d) => {
    f = For({ each: () => items(), key: (t) => t.id, children: (t) => leaf('n' + t.id) });
    return d;
  });
  expect(tags(f)).toEqual(['n1', 'n2']);
  const first = f.children[0];
  setItems([{ id: 2 }, { id: 1 }, { id: 3 }]);
  expect(tags(f)).toEqual(['n2', 'n1', 'n3']);
  expect(f.children[1]).toBe(first);
  expect((f.layout as FlexNode).children).toEqual(f.children.map((c) => c.layout));
  setItems([{ id: 1 }]);
  expect(tags(f)).toEqual(['n1']);
  dispose();
  setFrameRequester(null);
});

test('For disposes removed item scopes', () => {
  setFrameRequester(() => {});
  let disposed = 0;
  const [items, setItems] = createSignal([{ id: 1 }, { id: 2 }]);
  let f!: Instance;
  const dispose = createRoot((d) => {
    f = For({
      each: () => items(),
      key: (t) => t.id,
      children: (t) => {
        onCleanup(() => (disposed += 1));
        return leaf('n' + t.id);
      },
    });
    return d;
  });
  setItems([{ id: 1 }]);
  expect(disposed).toBe(1);
  void f;
  dispose();
  expect(disposed).toBe(2);
  setFrameRequester(null);
});

test('For shows fallback when empty', () => {
  setFrameRequester(() => {});
  const [items, setItems] = createSignal<{ id: number }[]>([]);
  let f!: Instance;
  const dispose = createRoot((d) => {
    f = For({ each: () => items(), key: (t) => t.id, children: (t) => leaf('n' + t.id), fallback: () => leaf('empty') });
    return d;
  });
  expect(tags(f)).toEqual(['empty']);
  setItems([{ id: 1 }]);
  expect(tags(f)).toEqual(['n1']);
  dispose();
  setFrameRequester(null);
});
