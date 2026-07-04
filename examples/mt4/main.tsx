import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text, ThemeProvider } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import {
  createMaterialTheme,
  Checkbox, Radio, RadioGroup, Switch, TextField, Select,
} from '@cairn/material';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function sectionTitle(t: string) {
  return Text({ style: { font: '600 13px sans-serif', color: '#5f6368' }, children: t });
}

function App() {
  const [plan, setPlan] = createSignal('pro');

  return ThemeProvider({
    theme: createMaterialTheme(),
    children: () => Column({
      style: { justify: 'center', align: 'center' },
      children: [
        Box({
          style: {
            width: 560, padding: 32, borderRadius: 16, backgroundColor: '#ffffff',
            boxShadow: { color: '#0003', blur: 32, offsetX: 0, offsetY: 12 },
          },
          children: Column({
            mainAxisSize: 'min',
            style: { gap: 22 },
            children: [
              Text({ style: { font: '500 20px sans-serif', color: '#202124' }, children: '@cairn/material — MT4 inputs' }),

              sectionTitle('TextField'),
              Column({ mainAxisSize: 'min', style: { gap: 16 }, children: [
                TextField({ label: 'Full name', defaultValue: 'Ada Lovelace', variant: 'outlined' }),
                TextField({ label: 'Email', placeholder: 'you@example.com', variant: 'filled' }),
                TextField({ label: 'Password', error: true, helperText: 'Too short', defaultValue: 'abc' }),
              ] }),

              sectionTitle('Selection controls'),
              Row({ mainAxisSize: 'min', style: { gap: 24, alignY: 'center' }, children: [
                Checkbox({ defaultChecked: true, label: 'Subscribe' }),
                Checkbox({ label: 'Disabled', disabled: true }),
                Switch({ defaultChecked: true, label: 'Notifications' }),
              ] }),

              sectionTitle('Radio group'),
              RadioGroup({
                defaultValue: 'pro',
                children: () => Row({ mainAxisSize: 'min', style: { gap: 20 }, children: [
                  Radio({ value: 'free', label: 'Free' }),
                  Radio({ value: 'pro', label: 'Pro' }),
                  Radio({ value: 'team', label: 'Team' }),
                ] }),
              }),

              sectionTitle('Select'),
              Select({
                label: 'Plan',
                value: plan(),
                onChange: setPlan,
                options: [
                  { value: 'free', label: 'Free' },
                  { value: 'pro', label: 'Pro' },
                  { value: 'team', label: 'Team' },
                ],
              }),
            ],
          }),
        }),
      ],
    }),
  });
}

mount(App, host);
