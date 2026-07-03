import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Text } from '@cairn/primitives';
import { StyleSheet } from '@cairn/style';
import { Button } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [on, setOn] = createSignal(false);

const s = StyleSheet.create({
  card: {
    width: 440,
    padding: 48,
    borderRadius: 28,
    backgroundGradient: {
      kind: 'linear',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 400 },
      stops: [
        { offset: 0, color: '#222226' },
        { offset: 1, color: '#18181b' },
      ],
    },
    backgroundColor: '#1b1b1d',
    boxShadow: { color: '#0007', blur: 36, offsetX: 0, offsetY: 14 },
  },
  inner: { gap: 40, align: 'center' },
  title: { font: 'bold 20px sans-serif', color: '#ffffff' },
  subtitle: { font: '14px sans-serif', color: '#6b7280' },
  label: { font: 'bold 15px sans-serif', color: '#ffffff', letterSpacing: 0.5 },
});

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center' }}>
      <Box style={s.card}>
        <Column style={s.inner} mainAxisSize="min">
          <Column style={{ gap: 6, align: 'center' }} mainAxisSize="min">
            <Text style={s.title}>Transition Demo</Text>
            <Text style={s.subtitle}>AN1 — структурная интерполяция</Text>
          </Column>

          {/* Animated box — reads on() signal; all changes tween via transition */}
          <Box
            style={() => ({
              width: on() ? 240 : 120,
              height: 80,
              borderRadius: on() ? 40 : 12,
              backgroundColor: on() ? '#e0567b' : '#4577e6',
              transform: { scale: on() ? 1.1 : 1, rotate: on() ? 6 : 0 },
              boxShadow: {
                color: '#0007',
                blur: on() ? 40 : 12,
                offsetX: 0,
                offsetY: on() ? 18 : 6,
              },
              alignX: 'center',
              alignY: 'center',
              transition: { duration: 320, easing: 'ease-in-out' },
            })}
          >
            <Text style={s.label}>Тык</Text>
          </Box>

          <Button
            label="Переключить"
            variant="primary"
            style={{ width: 200, height: 48, borderRadius: 14 }}
            onClick={() => setOn(v => !v)}
          />
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
