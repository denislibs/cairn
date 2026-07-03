import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text, Icon, ThemeProvider } from '@cairn/primitives';
import { Button, Toggle } from '@cairn/widgets';
import { Button as MButton, IconButton, Fab, createMaterialTheme } from '@cairn/material';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const HEART = 'M12 21s-7-4.6-9.5-8.5C1 9 3 5 7 5c2 0 3.2 1 5 3 1.8-2 3-3 5-3 4 0 6 4 4.5 7.5C19 16.4 12 21 12 21z';
const PLUS = 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z';

function sectionTitle(t: string) {
  return Text({ style: { font: '600 14px sans-serif', color: '#111827' }, children: t });
}

function App() {
  return Column({
    style: { justify: 'center', align: 'center', gap: 0 },
    children: [
      Box({
        style: {
          width: 640,
          padding: 32,
          borderRadius: 20,
          backgroundColor: '#ffffff',
          boxShadow: { color: '#0003', blur: 32, offsetX: 0, offsetY: 12 },
        },
        children: Column({
          style: { gap: 20, mainAxisSize: 'min' },
          children: [
            Text({ style: { font: 'bold 20px sans-serif', color: '#0f172a' }, children: '@cairn/widgets — headless Button' }),

            sectionTitle('Variants (default theme)'),
            Row({ style: { gap: 10, align: 'center' }, children: [
              Button({ variant: 'solid', label: 'Solid' }),
              Button({ variant: 'soft', label: 'Soft' }),
              Button({ variant: 'outline', label: 'Outline' }),
              Button({ variant: 'ghost', label: 'Ghost' }),
              Button({ variant: 'link', label: 'Link' }),
            ] }),

            sectionTitle('Sizes'),
            Row({ style: { gap: 10, align: 'center' }, children: [
              Button({ size: 'sm', label: 'Small' }),
              Button({ size: 'md', label: 'Medium' }),
              Button({ size: 'lg', label: 'Large' }),
            ] }),

            sectionTitle('Colors & disabled'),
            Row({ style: { gap: 10, align: 'center' }, children: [
              Button({ color: 'primary', label: 'Primary' }),
              Button({ color: 'danger', label: 'Danger' }),
              Button({ color: 'success', label: 'Success' }),
              Button({ label: 'Disabled', disabled: true }),
            ] }),

            sectionTitle('Layer 2 — style override   ·   Layer 3 — render-fn slot   ·   Toggle'),
            Row({ style: { gap: 10, align: 'center' }, children: [
              Button({
                label: 'Override',
                style: { backgroundColor: '#ec4899', hover: { backgroundColor: '#db2777' } },
              }),
              Button({
                children: (s) => Box({
                  style: () => ({
                    borderRadius: 999,
                    padding: { left: 20, right: 20, top: 10, bottom: 10 },
                    backgroundColor: s.hovered() ? '#7c3aed' : '#a855f7',
                    alignX: 'center', alignY: 'center',
                  }),
                  children: Text({ style: { font: '600 14px sans-serif', color: '#fff' }, children: 'Render-fn' }),
                }),
              }),
              Toggle({ defaultPressed: false, label: 'Toggle' }),
            ] }),

            Box({ style: { height: 1, backgroundColor: '#e5e7eb' } }),

            sectionTitle('@cairn/material — reference kit built on the headless Button'),
            ThemeProvider({
              theme: createMaterialTheme(),
              children: () => Row({ style: { gap: 12, align: 'center' }, children: [
                MButton({ variant: 'contained', label: 'Contained' }),
                MButton({ variant: 'outlined', label: 'Outlined' }),
                MButton({ variant: 'text', label: 'Text' }),
                IconButton({ icon: Icon({ path: HEART, size: 22, color: '#e11d48' }) }),
                Fab({ icon: Icon({ path: PLUS, size: 24, color: '#fff' }) }),
              ] }),
            }),
          ],
        }),
      }),
    ],
  });
}

mount(App, host);
