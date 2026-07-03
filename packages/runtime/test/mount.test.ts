import { test, expect, afterEach } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, scheduleFrame, type Instance } from '../src/index';
import { createFakeHost } from './fake-host';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.(); // tear down the mount (clears the single-root frame requester)
  dispose = undefined;
});

function makeInstance(): Instance {
  const layout = new BoxNode({ width: 50, height: 30 });
  return {
    layout,
    children: [],
    paintSelf(r) {
      r.fillRect({ x: 0, y: 0, width: layout.size.w, height: layout.size.h }, { color: '#f00' });
    },
  };
}
const beginFrames = (r: { calls: unknown[][] }) => r.calls.filter((c) => c[0] === 'beginFrame').length;

test('mount lays out and paints initially', () => {
  const { host, renderer } = createFakeHost();
  dispose = mount(makeInstance, host);
  const names = renderer.calls.map((c) => c[0]);
  expect(names).toContain('beginFrame');
  expect(names).toContain('clear');
  expect(names).toContain('fillRect');
  expect(names).toContain('endFrame');
});

test('changes coalesce into a single frame', () => {
  const { host, renderer, scheduler } = createFakeHost();
  dispose = mount(makeInstance, host);
  const before = beginFrames(renderer);
  scheduleFrame();
  scheduleFrame();
  expect(scheduler.pending.length).toBe(1); // coalesced
  scheduler.flush();
  expect(beginFrames(renderer)).toBe(before + 1);
});

test('re-renders on surface resize (coalesced via scheduleFrame)', () => {
  const { host, renderer, metrics, scheduler } = createFakeHost();
  dispose = mount(makeInstance, host);
  const before = beginFrames(renderer);
  metrics.resize(400, 300);
  expect(scheduler.pending.length).toBe(1); // scheduled, not a synchronous render
  scheduler.flush();
  expect(beginFrames(renderer)).toBe(before + 1);
});
