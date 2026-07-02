import { test, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { setFrameRequester, Switch, Match, type Instance } from '../src/index';

function leaf(tag: string): Instance {
  return { layout: new BoxNode({ width: 10, height: 10 }), children: [], paintSelf() {}, ...({ __tag: tag } as object) } as Instance;
}
const tag = (i: Instance) => (i.children[0] as unknown as { __tag?: string })?.__tag;

test('Switch renders the first matching Match; fallback when none', () => {
  setFrameRequester(() => {});
  const [a, setA] = createSignal(false);
  const [b, setB] = createSignal(false);
  let sw!: Instance;
  const dispose = createRoot((d) => {
    sw = Switch({
      fallback: () => leaf('none'),
      children: [
        Match({ when: () => a(), children: () => leaf('A') }),
        Match({ when: () => b(), children: () => leaf('B') }),
      ],
    });
    return d;
  });
  expect(tag(sw)).toBe('none');
  setB(true);
  expect(tag(sw)).toBe('B');
  setA(true);
  expect(tag(sw)).toBe('A');
  dispose();
  setFrameRequester(null);
});
