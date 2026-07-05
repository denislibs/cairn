import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Column, Row, Text, ThemeProvider } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { installDevtools } from '@cairn/devtools';
import { Button, createMaterialTheme } from '@cairn/material';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

// Install devtools BEFORE mount so the very first commit is captured.
installDevtools({ canvas });

function App() {
  const [count, setCount] = createSignal(0, { name: 'count' });
  return Column({
    mainAxisSize: 'min',
    style: { gap: 16, padding: 24 },
    children: [
      Text({ style: { font: '600 20px sans-serif', color: '#202124' }, children: 'DevTools demo' }),
      Row({
        mainAxisSize: 'min',
        style: { gap: 12, alignY: 'center' },
        children: [
          Button({
            label: 'Increment',
            onClick: () => setCount((c) => c + 1),
          }),
          Text({ style: { font: '16px sans-serif', color: '#202124' }, children: () => `count: ${count()}` }),
        ],
      }),
    ],
  });
}

function Root() {
  return ThemeProvider({
    theme: createMaterialTheme(),
    children: () => App(),
  });
}

mount(Root, host);
