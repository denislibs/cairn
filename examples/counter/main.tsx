import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Text } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [count, setCount] = createSignal(0);

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center', gap: 12 }}>
      <Box style={{ backgroundColor: '#3b82f6', borderRadius: 16, padding: 24 }}>
        <Column style={{ gap: 8, align: 'center' }}>
          <Text style={{ font: 'bold 20px sans-serif', color: '#e0e7ff' }}>Cairn counter</Text>
          <Text style={{ font: '64px sans-serif', color: '#ffffff' }}>{() => String(count())}</Text>
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);

// Temporary interaction until the events phase (Phase 7): click to increment.
canvas.addEventListener('click', () => setCount(count() + 1));
