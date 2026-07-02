import { test, expect, afterEach } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, type Instance } from '../src/index';
import type { CairnKeyboardEvent, CairnFocusEvent } from '@cairn/events';
import { createFakeHost } from './fake-host';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function makeFocusable(log: string[]): () => Instance {
  return () => {
    const layout = new BoxNode({ width: 50, height: 30 });
    return {
      layout,
      children: [],
      focusable: true,
      paintSelf() {},
      handlers: {
        onFocus: (_e: CairnFocusEvent) => log.push('focus'),
        onKeyDown: (e: CairnKeyboardEvent) => log.push(`key:${e.key}`),
      },
    };
  };
}

test('pointerdown over a focusable instance focuses it', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeFocusable(log), host);
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  expect(log).toContain('focus');
});

test('keydown routes to the focused instance', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeFocusable(log), host);
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  input.emitKey({ type: 'keydown', key: 'Enter', code: 'Enter', shift: false, ctrl: false, alt: false, meta: false, preventDefault: () => {} });
  expect(log).toContain('key:Enter');
});
