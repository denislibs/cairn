import { test, expect } from 'vitest';
import { createRoot, createSignal, onCleanup } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { setFrameRequester, Show, type Instance } from '../src/index';

function leaf(tag: string): Instance {
  return { layout: new BoxNode({ width: 10, height: 10 }), children: [], paintSelf() {}, ...({ __tag: tag } as object) } as Instance;
}
const tagOf = (i: Instance | undefined) => (i as unknown as { __tag?: string })?.__tag;

test('Show renders children when truthy, fallback when falsy', () => {
  setFrameRequester(() => {});
  const [on, setOn] = createSignal(true);
  let s!: Instance;
  const dispose = createRoot((d) => {
    s = Show({ when: () => on(), children: () => leaf('yes'), fallback: () => leaf('no') });
    return d;
  });
  expect(tagOf(s.children[0])).toBe('yes');
  setOn(false);
  expect(tagOf(s.children[0])).toBe('no');
  setOn(true);
  expect(tagOf(s.children[0])).toBe('yes');
  dispose();
  setFrameRequester(null);
});

test('Show disposes the previous branch scope on toggle', () => {
  setFrameRequester(() => {});
  let disposed = 0;
  const [on, setOn] = createSignal(true);
  let s!: Instance;
  const dispose = createRoot((d) => {
    s = Show({
      when: () => on(),
      children: () => {
        onCleanup(() => (disposed += 1));
        return leaf('yes');
      },
    });
    return d;
  });
  expect(disposed).toBe(0);
  setOn(false);
  expect(disposed).toBe(1);
  void s;
  dispose();
  setFrameRequester(null);
});
