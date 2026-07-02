import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { StyleSheet } from '@cairn/style';
import { Button, Slider, Divider } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [count, setCount] = createSignal(0);
const [step, setStep] = createSignal(1);

// Named, typed styles (like React Native's StyleSheet). Optional — inline Style
// objects work too; this just organizes the static styles in one place.
const s = StyleSheet.create({
  card: {
    width: 440,
    height: 420,
    padding: 28,
    borderRadius: 28,
    // Shadow and gradient to demo Phase-10b capabilities
    boxShadow: { color: '#0006', blur: 32, offsetX: 0, offsetY: 12 },
    backgroundGradient: {
      kind: 'linear',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 1 },
      stops: [
        { offset: 0, color: '#222226' },
        { offset: 1, color: '#18181b' },
      ],
    },
    backgroundColor: '#1b1b1d', // fallback for renderers without gradient support
  },
  inner: { justify: 'center', align: 'center', gap: 16 },
  number: { font: 'bold 84px sans-serif', color: '#ffffff' },
  subtitle: { font: '15px sans-serif', color: '#6b7280' },
  stepRow: { gap: 14, align: 'center' },
  stepLabel: { font: '15px sans-serif', color: '#9ca3af' },
  stepValue: { font: 'bold 16px sans-serif', color: '#ffffff' },
});

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center' }}>
      <Box style={s.card}>
        <Column style={s.inner}>
          <Text style={s.number}>{() => String(count())}</Text>
          <Text style={s.subtitle}>начни считать</Text>

          <Row style={{ gap: 12, width: 384 }}>
            <Button
              label="−"
              variant="secondary"
              style={{ width: 120, height: 68, borderRadius: 16 }}
              onClick={() => setCount(Math.max(0, count() - step()))}
            />
            <Button
              label="+"
              variant="primary"
              flex={1}
              style={{ height: 68, borderRadius: 16 }}
              onClick={() => setCount(count() + step())}
            />
          </Row>

          <Row style={s.stepRow}>
            <Text style={s.stepLabel}>Шаг</Text>
            <Slider value={step} min={1} max={10} width={252} onChange={setStep} />
            <Text style={s.stepValue}>{() => String(step())}</Text>
          </Row>

          <Divider color="#2a2a2e" length={384} />

          <Button
            label="↻  Сбросить"
            variant="ghost"
            style={{ width: 384, height: 56, borderRadius: 16, border: { width: 1, color: '#2a2a2e' } }}
            onClick={() => setCount(0)}
          />
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
