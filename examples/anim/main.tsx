import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Text, Presence } from '@cairn/primitives';
import { StyleSheet } from '@cairn/style';
import { Button } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [on, setOn] = createSignal(false);
const [spring, setSpring] = createSignal(false);
const [shown, setShown] = createSignal(true);

const s = StyleSheet.create({
  card: {
    width: 480,
    padding: 48,
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
  inner: { gap: 40, align: 'center' },
  section: { gap: 16, align: 'center' },
  divider: {
    width: 380,
    height: 1,
    backgroundColor: '#3a3a3f',
  },
  title: { font: 'bold 20px sans-serif', color: '#ffffff' },
  subtitle: { font: '14px sans-serif', color: '#6b7280' },
  label: { font: 'bold 15px sans-serif', color: '#ffffff', letterSpacing: 0.5 },
});

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center' }}>
      <Box style={s.card}>
        <Column style={s.inner} mainAxisSize="min">

          {/* AN1 — time-based transition demo */}
          <Column style={s.section} mainAxisSize="min">
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

          {/* Divider */}
          <Box style={s.divider} />

          {/* AN2 — real spring physics demo */}
          <Column style={s.section} mainAxisSize="min">
            <Column style={{ gap: 6, align: 'center' }} mainAxisSize="min">
              <Text style={s.title}>Spring Demo</Text>
              <Text style={s.subtitle}>AN2 — реальная физика пружины (overshoot)</Text>
            </Column>

            {/* Spring box — translateX overshoots and settles */}
            <Box
              style={() => ({
                width: 120,
                height: 80,
                borderRadius: 18,
                backgroundColor: spring() ? '#34c77b' : '#a259f7',
                transform: { translateX: spring() ? 120 : -120 },
                alignX: 'center',
                alignY: 'center',
                transition: {
                  spring: { stiffness: 220, damping: 12 },
                },
              })}
            >
              <Text style={s.label}>Бум</Text>
            </Box>

            <Button
              label="Пружина"
              variant="secondary"
              style={{ width: 200, height: 48, borderRadius: 14 }}
              onClick={() => setSpring(v => !v)}
            />
          </Column>

          {/* Divider */}
          <Box style={s.divider} />

          {/* AN3 — enter/exit presence demo */}
          <Column style={s.section} mainAxisSize="min">
            <Column style={{ gap: 6, align: 'center' }} mainAxisSize="min">
              <Text style={s.title}>Presence Demo</Text>
              <Text style={s.subtitle}>AN3 — появление / удаление (enter/exit)</Text>
            </Column>

            {Presence({
              when: shown,
              from: { opacity: 0, transform: { translateY: 24, scale: 0.9 } },
              duration: 300,
              easing: 'ease-out',
              children: () => (
                <Box
                  style={{
                    width: 200,
                    height: 90,
                    backgroundColor: '#7c3aed',
                    borderRadius: 18,
                    alignX: 'center',
                    alignY: 'center',
                  }}
                >
                  <Text style={s.label}>Привет</Text>
                </Box>
              ),
            })}

            <Button
              label="Показать / Скрыть"
              variant="primary"
              style={{ width: 200, height: 48, borderRadius: 14 }}
              onClick={() => setShown(v => !v)}
            />
          </Column>

        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
