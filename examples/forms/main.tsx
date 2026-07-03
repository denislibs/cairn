import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { Input, Checkbox, Switch, RadioGroup, Radio, Field, Button } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function label(t: string) {
  return Text({ style: { font: '600 13px sans-serif', color: '#111827' }, children: t });
}

function App() {
  const [invalid, setInvalid] = createSignal(true);

  return Column({
    style: { justify: 'center', align: 'center' },
    children: [
      Box({
        style: {
          width: 420,
          padding: 32,
          borderRadius: 20,
          backgroundColor: '#ffffff',
          boxShadow: { color: '#0003', blur: 32, offsetX: 0, offsetY: 12 },
        },
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 18 },
          children: [
            Text({ style: { font: 'bold 20px sans-serif', color: '#0f172a' }, children: '@cairn/widgets — form core' }),

            // Labelled input inside a Field
            Field({
              children: () => Column({ mainAxisSize: 'min', style: { gap: 6 }, children: [
                Field.Label({ children: 'Name' }),
                Field.Control({ children: Input({ placeholder: 'Jane Doe' }) }),
                Field.Helper({ children: 'Your full legal name' }),
              ] }),
            }),

            // Invalid field: error shows while invalid()
            Field({
              invalid,
              children: () => Column({ mainAxisSize: 'min', style: { gap: 6 }, children: [
                Field.Label({ children: 'Email' }),
                Field.Control({ children: Input({ placeholder: 'you@example.com' }) }),
                Field.Error({ children: 'Email is required' }),
              ] }),
            }),

            // Checkbox + Switch + a render-fn (fully custom) checkbox
            Row({ mainAxisSize: 'min', style: { gap: 20, align: 'center' }, children: [
              Checkbox({ label: 'Accept terms', defaultChecked: true }),
              Switch({ label: 'Notifications', defaultChecked: true }),
            ] }),

            // Radio group
            label('Plan'),
            RadioGroup({
              defaultValue: 'pro',
              children: () => Column({ mainAxisSize: 'min', style: { gap: 8 }, children: [
                Radio({ value: 'free', label: 'Free' }),
                Radio({ value: 'pro', label: 'Pro' }),
                Radio({ value: 'team', label: 'Team' }),
              ] }),
            }),

            Box({ style: { height: 1, backgroundColor: '#e5e7eb' } }),

            // Submit / toggle-validity to show the error appear/disappear
            Row({ mainAxisSize: 'min', style: { gap: 10, align: 'center' }, children: [
              Button({ label: 'Submit' }),
              Button({ variant: 'outline', label: invalid() ? 'Fix email' : 'Break email', onClick: () => setInvalid((v) => !v) }),
            ] }),
          ],
        }),
      }),
    ],
  });
}

mount(App, host);
