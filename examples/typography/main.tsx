import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const BODY =
  'The quick brown fox jumps over the lazy dog. Съешь же ещё этих мягких французских булок да выпей чаю. ' +
  'Этот текст переносится по словам движком Cairn и рисуется прямо на canvas в физическом разрешении экрана — ' +
  'на Retina каждый глиф растеризуется в 2× пикселях, поэтому края остаются чёткими даже при зуме.';

function row(size: number, weight: number, label: string, sample: string) {
  return Row({
    mainAxisSize: 'min',
    style: { gap: 16, alignY: 'center' },
    children: [
      Box({ style: { width: 92 }, children: Text({ style: { font: '12px sans-serif', color: '#9aa1ac' }, children: label }) }),
      Text({ style: { fontSize: size, fontWeight: weight, fontFamily: 'sans-serif', color: '#111827' }, children: sample }),
    ],
  });
}

function App() {
  return Column({
    style: { justify: 'center', align: 'center' },
    children: [
      Box({
        style: {
          width: 860,
          padding: 40,
          borderRadius: 24,
          backgroundColor: '#ffffff',
          boxShadow: { color: '#00000022', blur: 40, offsetX: 0, offsetY: 16 },
        },
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 18 },
          children: [
            Text({ style: { fontSize: 13, fontWeight: 600, letterSpacing: 1.5, color: '#3b82f6' }, children: 'CAIRN · CANVAS TEXT CRISPNESS' }),
            row(48, 700, 'Display', 'Sharp on Retina'),
            row(34, 700, 'Heading', 'Заголовок H1'),
            row(24, 600, 'Title', 'Title / Подзаголовок'),
            row(18, 500, 'Subtitle', 'Medium 18px — Средний'),
            row(16, 400, 'Body', 'Regular 16px — обычный текст'),
            row(13, 400, 'Caption', 'Caption 13px — мелкий текст, тоже чёткий'),
            row(11, 400, 'Micro', 'Micro 11px · самый мелкий'),

            Box({ style: { height: 1, backgroundColor: '#e5e7eb' } }),

            Text({ style: { fontSize: 12, fontWeight: 600, letterSpacing: 1.2, color: '#9aa1ac' }, children: 'MULTILINE WORD-WRAP' }),
            Text({
              style: { fontSize: 16, fontWeight: 400, lineHeight: 26, color: '#374151', width: 780 },
              children: BODY,
            }),

            Box({ style: { height: 1, backgroundColor: '#e5e7eb' } }),
            Text({ style: { fontSize: 13, color: '#6b7280' }, children: () => `devicePixelRatio = ${globalThis.devicePixelRatio ?? 1}  ·  зумни Cmd +/−, текст остаётся резким` }),
          ],
        }),
      }),
    ],
  });
}

mount(App, host);
