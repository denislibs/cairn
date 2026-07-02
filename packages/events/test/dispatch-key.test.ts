import { test, expect } from 'vitest';
import { dispatchKey } from '../src/index';
import type { HitNode, CairnKeyboardEvent } from '../src/index';

function node(tag: string, log: string[], stopOn?: string): HitNode {
  return {
    layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } },
    children: [],
    handlers: {
      onKeyDown: (e: CairnKeyboardEvent) => {
        log.push(tag);
        if (tag === stopOn) e.stopPropagation();
      },
    },
  };
}

const init = (over: Partial<CairnKeyboardEvent> = {}) => ({
  type: 'keydown' as const,
  key: 'Enter',
  code: 'Enter',
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
  preventDefault: () => {},
  ...over,
});

test('keydown bubbles focused -> root, mapped to onKeyDown', () => {
  const log: string[] = [];
  dispatchKey([node('target', log), node('mid', log), node('root', log)], init());
  expect(log).toEqual(['target', 'mid', 'root']);
});

test('stopPropagation halts bubbling', () => {
  const log: string[] = [];
  dispatchKey([node('target', log, 'target'), node('mid', log)], init());
  expect(log).toEqual(['target']);
});

test('target is path[0]; preventDefault forwards to the raw input', () => {
  let prevented = false;
  let seen: CairnKeyboardEvent | undefined;
  const target: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } },
    children: [],
    handlers: { onKeyDown: (e) => { seen = e; e.preventDefault(); } },
  };
  dispatchKey([target], init({ preventDefault: () => { prevented = true; } }));
  expect(seen?.target).toBe(target);
  expect(prevented).toBe(true);
});

test('keyup maps to onKeyUp', () => {
  const log: string[] = [];
  const n: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } },
    children: [],
    handlers: { onKeyUp: () => log.push('up') },
  };
  dispatchKey([n], init({ type: 'keyup' }));
  expect(log).toEqual(['up']);
});
