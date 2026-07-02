import { test, expect, afterEach } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, type Instance } from '../src/index';
import type { CairnPointerEvent } from '@cairn/events';
import { createFakeHost } from './fake-host';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function makeButton(log: string[]): () => Instance {
  return () => {
    const layout = new BoxNode({ width: 50, height: 30 });
    return {
      layout,
      children: [],
      paintSelf() {},
      handlers: {
        onPointerDown: (e: CairnPointerEvent) => log.push(`down@${e.x},${e.y}`),
        onClick: () => log.push('click'),
      },
    };
  };
}

test('mount wires host.input to pointer dispatch', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeButton(log), host);
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['down@10,5']);
});

test('down + up over the same instance synthesizes a click', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeButton(log), host);
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  input.emitPointer({ type: 'pointerup', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['down@10,5', 'click']);
});

test('dispose unsubscribes from input', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeButton(log), host);
  dispose();
  dispose = undefined;
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  expect(log).toEqual([]);
});
