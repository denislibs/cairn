import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Text, Input } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [count, setCount] = createSignal(0);
const [name, setName] = createSignal('');

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center', gap: 12 }}>
      <Box
        focusable
        style={{
          backgroundColor: '#3b82f6',
          borderRadius: 16,
          padding: 24,
          height: 132,
          hover: { backgroundColor: '#2563eb' },
          pressed: { backgroundColor: '#1d4ed8' },
          focus: { backgroundColor: '#1e40af' },
        }}
        onClick={() => setCount(count() + 1)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCount(count() + 1);
          }
        }}
      >
        <Column style={{ gap: 8, align: 'center' }}>
          <Text style={{ font: 'bold 20px sans-serif', color: '#e0e7ff' }}>Cairn counter</Text>
          <Text style={{ font: '64px sans-serif', color: '#ffffff' }}>{() => String(count())}</Text>
        </Column>
      </Box>
      <Input
        value={name}
        onInput={setName}
        placeholder="Type your name"
        style={{
          width: 260,
          backgroundColor: '#ffffff',
          color: '#111827',
          borderRadius: 8,
          padding: 10,
          focus: { backgroundColor: '#eef2ff' },
        }}
      />
      <Text style={{ font: '18px sans-serif', color: '#1f2937' }}>
        {() => (name() ? `Hi, ${name()}!` : '')}
      </Text>
    </Column>
  );
}

mount(App, host);
