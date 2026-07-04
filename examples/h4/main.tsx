import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { ToastProvider, useToast, Dialog, Drawer, Button } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function Inner() {
  const { toast } = useToast();
  return Column({
    mainAxisSize: 'min',
    style: { gap: 18 },
    children: [
      Text({ style: { font: 'bold 20px sans-serif', color: '#0f172a' }, children: '@cairn/widgets — H4' }),
      Text({ style: { font: '13px sans-serif', color: '#6b7280' }, children: 'Dialog (modal, focus-trap, Esc) · Drawer · Toast' }),
      Row({ mainAxisSize: 'min', style: { gap: 12, align: 'center' }, children: [
        Dialog({
          children: () => Column({ mainAxisSize: 'min', children: [
            Dialog.Trigger({ children: 'Open dialog' }),
            Dialog.Content({ children: () => Column({ mainAxisSize: 'min', style: { gap: 10 }, children: [
              Dialog.Title({ children: 'Confirm action' }),
              Dialog.Description({ children: 'This action cannot be undone.' }),
              Row({ mainAxisSize: 'min', style: { gap: 8, align: 'center' }, children: [
                Dialog.Close({ children: 'Cancel' }),
                Button({ label: 'Confirm' }),
              ] }),
            ] }) }),
          ] }),
        }),
        Drawer({
          side: 'right',
          children: () => Column({ mainAxisSize: 'min', children: [
            Drawer.Trigger({ children: 'Open drawer' }),
            Drawer.Content({ children: () => Column({ mainAxisSize: 'min', style: { gap: 10 }, children: [
              Drawer.Title({ children: 'Settings' }),
              Text({ style: { font: '13px sans-serif', color: '#6b7280' }, children: 'A side sheet.' }),
              Drawer.Close({ children: 'Close' }),
            ] }) }),
          ] }),
        }),
        Button({ variant: 'soft', label: 'Show toast', onClick: () => toast({ title: 'Saved', description: 'Your changes were saved.' }) }),
      ] }),
    ],
  });
}

function App() {
  return ToastProvider({
    children: () => Column({
      style: { justify: 'center', align: 'center' },
      children: [
        Box({
          style: { width: 560, padding: 32, borderRadius: 20, backgroundColor: '#ffffff', boxShadow: { color: '#0003', blur: 32, offsetX: 0, offsetY: 12 } },
          children: Inner(),
        }),
      ],
    }),
  });
}

mount(App, host);
