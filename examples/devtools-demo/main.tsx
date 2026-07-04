import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { installDevtools } from '@cairn/devtools';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

// Install devtools BEFORE mount so the very first commit is captured.
installDevtools({ canvas });

function App() {
  const [count, setCount] = createSignal(0);
  return Column({
    mainAxisSize: 'min',
    style: { gap: 16, padding: 24 },
    children: [
      Text({ style: { font: '600 20px sans-serif', color: '#202124' }, children: 'DevTools demo' }),
      Row({
        mainAxisSize: 'min',
        style: { gap: 12, alignY: 'center' },
        children: [
          Box({
            style: { padding: { left: 16, right: 16, top: 8, bottom: 8 }, backgroundColor: '#1a73e8', borderRadius: 6, cursor: 'pointer' },
            focusable: true,
            onClick: () => setCount((c) => c + 1),
            children: Text({ style: { color: '#fff', font: '500 14px sans-serif' }, children: 'Increment' }),
          }),
          Text({ style: { font: '16px sans-serif', color: '#202124' }, children: () => `count: ${count()}` }),
        ],
      }),
    ],
  });
}

mount(App, host);
