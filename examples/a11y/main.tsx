import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { Button } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function App() {
  const [count, setCount] = createSignal(0);

  return Column({
    style: { justify: 'center', align: 'center' },
    children: [
      Box({
        style: {
          width: 460,
          padding: 32,
          borderRadius: 20,
          backgroundColor: '#ffffff',
          boxShadow: { color: '#0003', blur: 32, offsetX: 0, offsetY: 12 },
        },
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 18 },
          children: [
            Text({ style: { font: 'bold 20px sans-serif', color: '#0f172a' }, children: 'Accessibility — native behavior' }),
            Text({ style: { font: '14px sans-serif', color: '#6b7280' }, children: 'Tab to focus · Enter/Space or click to activate · screen reader announces "button"' }),
            Text({ style: { font: '600 28px sans-serif', color: '#2563eb' }, children: () => `Activations: ${count()}` }),
            Row({ mainAxisSize: 'min', style: { gap: 10, align: 'center' }, children: [
              Button({ label: 'Increment', onClick: () => setCount((c) => c + 1) }),
              Button({ variant: 'outline', label: 'Reset', onClick: () => setCount(0) }),
              Button({ label: 'Disabled', disabled: true, onClick: () => setCount((c) => c + 100) }),
            ] }),
          ],
        }),
      }),
    ],
  });
}

mount(App, host);
