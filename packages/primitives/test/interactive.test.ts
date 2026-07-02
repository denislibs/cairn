import { test, expect } from 'vitest';
import type { CairnPointerEvent } from '@cairn/events';
import { createInteractive } from '../src/index';

const ev = {} as CairnPointerEvent;

test('resolved reflects the base style with no active state', () => {
  const { resolved } = createInteractive({ style: { backgroundColor: '#fff', hover: { backgroundColor: '#eee' } } });
  expect(resolved().backgroundColor).toBe('#fff');
});

test('onPointerEnter activates the hover variant; leave reverts', () => {
  const { resolved, handlers } = createInteractive({ style: { backgroundColor: '#fff', hover: { backgroundColor: '#eee' } } });
  handlers.onPointerEnter!(ev);
  expect(resolved().backgroundColor).toBe('#eee');
  handlers.onPointerLeave!(ev);
  expect(resolved().backgroundColor).toBe('#fff');
});

test('pointerdown activates the pressed variant; pointerup reverts', () => {
  const { resolved, handlers } = createInteractive({ style: { backgroundColor: '#fff', pressed: { backgroundColor: '#333' } } });
  handlers.onPointerDown!(ev);
  expect(resolved().backgroundColor).toBe('#333');
  handlers.onPointerUp!(ev);
  expect(resolved().backgroundColor).toBe('#fff');
});

test('leave clears a pending pressed (drag-off cancels press)', () => {
  const { resolved, handlers } = createInteractive({ style: { backgroundColor: '#fff', pressed: { backgroundColor: '#333' } } });
  handlers.onPointerDown!(ev);
  handlers.onPointerLeave!(ev);
  expect(resolved().backgroundColor).toBe('#fff');
});

test('user handlers still fire alongside the internal toggles', () => {
  const log: string[] = [];
  const { handlers } = createInteractive({
    style: {},
    onPointerEnter: () => log.push('user-enter'),
    onPointerDown: () => log.push('user-down'),
    onClick: () => log.push('user-click'),
  });
  handlers.onPointerEnter!(ev);
  handlers.onPointerDown!(ev);
  handlers.onClick!(ev);
  expect(log).toEqual(['user-enter', 'user-down', 'user-click']);
});
