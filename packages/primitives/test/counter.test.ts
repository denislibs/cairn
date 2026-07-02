import { test, expect, afterEach } from 'vitest';
import { createSignal } from '@cairn/reactivity';
import { mount, setFrameRequester } from '@cairn/runtime';
import { Box, Column, Text } from '../src/index';
import { createFakeHost } from './fake-host';

afterEach(() => {
  setFrameRequester(null); // reset the single-root scheduler between tests
});

const drawnTexts = (r: { calls: unknown[][] }) =>
  r.calls.filter((c) => c[0] === 'drawText').map((c) => c[1]);

test('reactive counter repaints with the new value after a signal change', () => {
  const { host, renderer, flush } = createFakeHost();
  const [count, setCount] = createSignal(0);

  const App = () =>
    Column({
      style: { justify: 'center', align: 'center' },
      children: Box({
        style: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16 },
        children: Text({
          style: { font: '48px sans-serif', color: '#fff' },
          children: () => String(count()),
        }),
      }),
    });

  const dispose = mount(App, host);

  // initial frame drew "0"
  expect(drawnTexts(renderer)).toContain('0');

  // change the signal, flush the coalesced frame
  setCount(1);
  flush();
  expect(drawnTexts(renderer)).toContain('1');

  dispose();
});
