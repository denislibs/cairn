import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { Button, Popover, Tooltip, Menu, MenuItem, Select, Option } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function App() {
  const [picked, setPicked] = createSignal('—');

  return Column({
    style: { justify: 'center', align: 'center' },
    children: [
      Box({
        style: {
          width: 520,
          padding: 32,
          borderRadius: 20,
          backgroundColor: '#ffffff',
          boxShadow: { color: '#0003', blur: 32, offsetX: 0, offsetY: 12 },
        },
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 22 },
          children: [
            Text({ style: { font: 'bold 20px sans-serif', color: '#0f172a' }, children: '@cairn/widgets — overlays & selection' }),

            Row({ mainAxisSize: 'min', style: { gap: 14, align: 'center' }, children: [
              Popover({
                trigger: Button({ label: 'Popover' }),
                children: Column({ mainAxisSize: 'min', style: { gap: 6 }, children: [
                  Text({ style: { font: '600 14px sans-serif', color: '#111827' }, children: 'Popover panel' }),
                  Text({ style: { font: '13px sans-serif', color: '#6b7280' }, children: 'Click outside to close.' }),
                ] }),
              }),
              Tooltip({ trigger: Button({ variant: 'outline', label: 'Hover me' }), label: 'A helpful tooltip' }),
              Menu({
                trigger: Button({ variant: 'soft', label: 'Menu' }),
                children: () => Column({ mainAxisSize: 'min', children: [
                  MenuItem({ label: 'Cut', onSelect: () => setPicked('Cut') }),
                  MenuItem({ label: 'Copy', onSelect: () => setPicked('Copy') }),
                  MenuItem({ label: 'Paste (disabled)', disabled: true }),
                ] }),
              }),
            ] }),

            Row({ mainAxisSize: 'min', style: { gap: 12, align: 'center' }, children: [
              Text({ style: { font: '600 14px sans-serif', color: '#111827' }, children: 'Fruit:' }),
              Select({
                placeholder: 'Choose…',
                defaultValue: 'apple',
                onChange: (v) => setPicked(String(v)),
                children: () => Column({ mainAxisSize: 'min', children: [
                  Option({ value: 'apple', label: 'Apple' }),
                  Option({ value: 'banana', label: 'Banana' }),
                  Option({ value: 'cherry', label: 'Cherry' }),
                ] }),
              }),
            ] }),

            Box({ style: { height: 1, backgroundColor: '#e5e7eb' } }),
            Text({ style: { font: '13px sans-serif', color: '#6b7280' }, children: () => 'Last action: ' + picked() }),
          ],
        }),
      }),
    ],
  });
}

mount(App, host);
