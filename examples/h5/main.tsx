import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { Tabs, Accordion, Stepper, Breadcrumbs, Pagination } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function section(t: string) {
  return Text({ style: { font: '600 13px sans-serif', color: '#111827' }, children: t });
}
function body(t: string) {
  return Text({ style: { font: '14px sans-serif', color: '#374151' }, children: t });
}

function App() {
  const [page, setPage] = createSignal(3);

  return Column({
    style: { justify: 'center', align: 'center' },
    children: [
      Box({
        style: { width: 620, padding: 32, borderRadius: 20, backgroundColor: '#ffffff', boxShadow: { color: '#0003', blur: 32, offsetX: 0, offsetY: 12 } },
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 20 },
          children: [
            Text({ style: { font: 'bold 20px sans-serif', color: '#0f172a' }, children: '@cairn/widgets — H5 navigation' }),

            Breadcrumbs({ items: [{ label: 'Home', onClick: () => {} }, { label: 'Library', onClick: () => {} }, { label: 'Widgets' }] }),

            section('Tabs'),
            Tabs({
              defaultValue: 'a',
              children: () => Column({ mainAxisSize: 'min', style: { gap: 10 }, children: [
                Tabs.List({ children: () => Row({ mainAxisSize: 'min', style: { gap: 4 }, children: [
                  Tabs.Tab({ value: 'a', children: 'Account' }),
                  Tabs.Tab({ value: 'b', children: 'Password' }),
                  Tabs.Tab({ value: 'c', children: 'Team' }),
                ] }) }),
                Tabs.Panel({ value: 'a', children: body('Account settings panel.') }),
                Tabs.Panel({ value: 'b', children: body('Password settings panel.') }),
                Tabs.Panel({ value: 'c', children: body('Team settings panel.') }),
              ] }),
            }),

            section('Accordion'),
            Accordion({
              type: 'single',
              defaultValue: 'one',
              collapsible: true,
              children: () => Column({ mainAxisSize: 'min', style: { gap: 6 }, children: [
                Accordion.Item({ value: 'one', children: () => Column({ mainAxisSize: 'min', children: [
                  Accordion.Trigger({ children: 'What is Cairn?' }),
                  Accordion.Content({ children: body('A SolidJS-like framework that renders to canvas.') }),
                ] }) }),
                Accordion.Item({ value: 'two', children: () => Column({ mainAxisSize: 'min', children: [
                  Accordion.Trigger({ children: 'Is it accessible?' }),
                  Accordion.Content({ children: body('Yes — a hidden DOM mirror gives native a11y.') }),
                ] }) }),
              ] }),
            }),

            section('Stepper'),
            Stepper({ active: 1, steps: [{ label: 'Cart' }, { label: 'Shipping' }, { label: 'Payment' }] }),

            section('Pagination'),
            Pagination({ page: page(), count: 10, onChange: setPage }),
          ],
        }),
      }),
    ],
  });
}

mount(App, host);
