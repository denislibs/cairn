import { test, expect } from 'vitest';
import { collectFocusables, createFocusManager } from '../src/index';
import type { HitNode, KeyboardInput } from '../src/index';

// root > [ A(focusable) > a1, B(focusable) ]
function tree() {
  const log: string[] = [];
  const fh = (tag: string) => ({
    onFocus: () => log.push(`focus:${tag}`),
    onBlur: () => log.push(`blur:${tag}`),
    onKeyDown: () => log.push(`key:${tag}`),
  });
  const box = (w = 10, h = 10, ox = 0, oy = 0): HitNode['layout'] => ({ offsetX: ox, offsetY: oy, size: { w, h } });
  const a1: HitNode = { layout: box(), children: [] };
  const A: HitNode = { layout: box(50, 100), children: [a1], focusable: true, handlers: fh('A') };
  const B: HitNode = { layout: box(50, 100, 50), children: [], focusable: true, handlers: fh('B') };
  const root: HitNode = { layout: box(100, 100), children: [A, B] };
  return { root, A, B, a1, log };
}

const key = (over: Partial<KeyboardInput> = {}): KeyboardInput => ({
  type: 'keydown', key: 'Tab', code: 'Tab', shift: false, ctrl: false, alt: false, meta: false,
  preventDefault: () => {}, ...over,
});

test('collectFocusables returns focusables in pre-order with [node..root] paths', () => {
  const { root, A, B } = tree();
  const list = collectFocusables(root);
  expect(list.map((f) => f.node)).toEqual([A, B]);
  expect(list[0].path).toEqual([A, root]);
  expect(list[1].path).toEqual([B, root]);
});

test('focusFromPointer focuses the nearest focusable ancestor', () => {
  const { root, A, a1, log } = tree();
  const fm = createFocusManager(() => root);
  fm.focusFromPointer([a1, A, root]);
  expect(fm.focused()).toBe(A);
  expect(log).toEqual(['focus:A']);
});

test('focusFromPointer with no focusable in path blurs the current focus', () => {
  const { root, A, log } = tree();
  const fm = createFocusManager(() => root);
  fm.focusFromPointer([A, root]);
  log.length = 0;
  fm.focusFromPointer([root]);
  expect(fm.focused()).toBe(null);
  expect(log).toEqual(['blur:A']);
});

test('Tab cycles focusables in order and wraps; Shift+Tab reverses', () => {
  const { root, A, B } = tree();
  const fm = createFocusManager(() => root);
  fm.handleKey(key());
  expect(fm.focused()).toBe(A);
  fm.handleKey(key());
  expect(fm.focused()).toBe(B);
  fm.handleKey(key());
  expect(fm.focused()).toBe(A);
  fm.handleKey(key({ shift: true }));
  expect(fm.focused()).toBe(B);
});

test('Tab calls preventDefault', () => {
  const { root } = tree();
  const fm = createFocusManager(() => root);
  let prevented = false;
  fm.handleKey(key({ preventDefault: () => { prevented = true; } }));
  expect(prevented).toBe(true);
});

test('non-Tab keys bubble to the focused node', () => {
  const { root, A, log } = tree();
  const fm = createFocusManager(() => root);
  fm.focusFromPointer([A, root]);
  log.length = 0;
  fm.handleKey(key({ key: 'Enter', code: 'Enter' }));
  expect(log).toEqual(['key:A']);
});
