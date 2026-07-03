import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Stack, Text } from '@cairn/primitives';
import { StyleSheet } from '@cairn/style';
import { createRipple } from '@cairn/material';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const s = StyleSheet.create({
  root: { justify: 'center', align: 'center' },
  card: {
    width: 360,
    padding: 28,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    boxShadow: { color: '#0002', blur: 24, offsetX: 0, offsetY: 8 },
  },
  cardInner: { gap: 16, align: 'center', mainAxisSize: 'min' },
  title: { font: 'bold 18px sans-serif', color: '#1a1a2e' },
  subtitle: { font: '13px sans-serif', color: '#6b7280' },
  surface: {
    width: 280,
    height: 120,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    overflow: 'hidden',
    alignX: 'center',
    alignY: 'center',
  },
  label: { font: '16px sans-serif', color: '#1976d2' },
});

function App() {
  const ripple = createRipple({ color: '#1976d2', radius: 12 });

  return (
    <Column style={s.root}>
      <Box style={s.card}>
        <Column style={s.cardInner}>
          <Text style={s.title}>Ripple</Text>
          <Text style={s.subtitle}>Нажми на поверхность</Text>

          <Box
            style={s.surface}
            onPointerDown={(e) => ripple.trigger(e.localX ?? 0, e.localY ?? 0)}
          >
            {Stack({
              children: [
                Text({ style: s.label, children: 'Нажми меня' }),
                ripple.instance,
              ],
            })}
          </Box>
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
