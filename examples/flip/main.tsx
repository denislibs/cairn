import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount, For } from '@cairn/runtime';
import { Box, Column, Text } from '@cairn/primitives';
import { StyleSheet } from '@cairn/style';
import { Button } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

interface Item {
  id: number;
  label: string;
  color: string;
}

const [items, setItems] = createSignal<Item[]>([
  { id: 1, label: 'Один',    color: '#4577e6' },
  { id: 2, label: 'Два',     color: '#e0567b' },
  { id: 3, label: 'Три',     color: '#22c55e' },
  { id: 4, label: 'Четыре',  color: '#f59e0b' },
  { id: 5, label: 'Пять',    color: '#8b5cf6' },
]);

const s = StyleSheet.create({
  card: {
    width: 380,
    padding: 28,
    borderRadius: 28,
    backgroundGradient: {
      kind: 'linear',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 500 },
      stops: [
        { offset: 0, color: '#222226' },
        { offset: 1, color: '#18181b' },
      ],
    },
    backgroundColor: '#1b1b1d',
    boxShadow: { color: '#0007', blur: 36, offsetX: 0, offsetY: 14 },
  },
  inner: { gap: 20, align: 'center' },
  title:    { font: 'bold 20px sans-serif', color: '#ffffff' },
  subtitle: { font: '14px sans-serif', color: '#6b7280' },
  itemLabel: { font: 'bold 16px sans-serif', color: '#ffffff' },
});

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center' }}>
      <Box style={s.card}>
        <Column style={s.inner} mainAxisSize="min">

          <Column style={{ gap: 6, align: 'center' }} mainAxisSize="min">
            <Text style={s.title}>FLIP Demo</Text>
            <Text style={s.subtitle}>AN4 — плавное переупорядочивание списка</Text>
          </Column>

          {For({
            each: items,
            key: (item) => item.id,
            gap: 10,
            flip: { duration: 400, easing: 'ease-in-out' },
            children: (item) => (
              <Box
                style={() => ({
                  width: 300,
                  height: 48,
                  backgroundColor: item.color,
                  borderRadius: 10,
                  alignX: 'start',
                  alignY: 'center',
                  padding: 14,
                })}
              >
                <Text style={s.itemLabel}>{item.label}</Text>
              </Box>
            ),
          })}

          <Button
            label="Перемешать"
            variant="primary"
            style={{ width: 300, height: 48, borderRadius: 14 }}
            onClick={() => setItems(prev => [...prev].sort(() => Math.random() - 0.5))}
          />

        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
