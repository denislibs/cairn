import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { Slider, Combobox, Form, useForm, Input, Button, Field } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function section(title: string) {
  return Text({ style: { font: '600 13px sans-serif', color: '#111827' }, children: title });
}

function SubmitBar() {
  const form = useForm();
  return Row({ mainAxisSize: 'min', style: { gap: 10, align: 'center' }, children: [
    Button({ label: 'Submit', onClick: () => form.submit() }),
    Text({ style: { font: '13px sans-serif', color: '#6b7280' }, children: () => form.getError('email') ? '✗ invalid' : '' }),
  ] });
}

function App() {
  const [vol, setVol] = createSignal(40);
  const [fruit, setFruit] = createSignal('—');

  return Column({
    style: { justify: 'center', align: 'center' },
    children: [
      Box({
        style: { width: 520, padding: 32, borderRadius: 20, backgroundColor: '#ffffff', boxShadow: { color: '#0003', blur: 32, offsetX: 0, offsetY: 12 } },
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 20 },
          children: [
            Text({ style: { font: 'bold 20px sans-serif', color: '#0f172a' }, children: '@cairn/widgets — H3' }),

            section('Slider (role=slider · arrows/Home/End)'),
            Row({ mainAxisSize: 'min', style: { gap: 14, align: 'center' }, children: [
              Slider({ defaultValue: 40, min: 0, max: 100, onChange: setVol, style: { width: 260 } }),
              Text({ style: { font: '600 15px sans-serif', color: '#2563eb' }, children: () => `${vol()}` }),
            ] }),

            section('Combobox (autocomplete · type to filter)'),
            Row({ mainAxisSize: 'min', style: { gap: 12, align: 'center' }, children: [
              Combobox({
                placeholder: 'Search fruit…',
                onChange: (v) => setFruit(String(v)),
                children: () => Column({ mainAxisSize: 'min', children: [
                  Combobox.Option({ value: 'apple', label: 'Apple' }),
                  Combobox.Option({ value: 'apricot', label: 'Apricot' }),
                  Combobox.Option({ value: 'banana', label: 'Banana' }),
                  Combobox.Option({ value: 'cherry', label: 'Cherry' }),
                  Combobox.Option({ value: 'grape', label: 'Grape' }),
                ] }),
              }),
              Text({ style: { font: '13px sans-serif', color: '#6b7280' }, children: () => `picked: ${fruit()}` }),
            ] }),

            Box({ style: { height: 1, backgroundColor: '#e5e7eb' } }),

            section('Form (validate on submit · announces errors)'),
            Form({
              initialValues: { email: '' },
              validate: (v) => (v.email && String(v.email).includes('@') ? undefined : { email: 'Enter a valid email' }),
              onSubmit: (v) => setFruit('submitted: ' + JSON.stringify(v)),
              children: () => Column({ mainAxisSize: 'min', style: { gap: 8 }, children: [
                Field({ children: () => Column({ mainAxisSize: 'min', style: { gap: 4 }, children: [
                  Field.Label({ children: 'Email' }),
                  Field.Control({ children: Input({ name: 'email', placeholder: 'you@example.com' }) }),
                ] }) }),
                SubmitBar(),
              ] }),
            }),
          ],
        }),
      }),
    ],
  });
}

mount(App, host);
