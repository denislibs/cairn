import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text, ThemeProvider } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import {
  createMaterialTheme,
  AppBar, Paper, Card, List, Tabs, Chip, Badge,
  LinearProgress, CircularProgress, Dialog, Button,
  SnackbarProvider, useSnackbar,
} from '@cairn/material';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function label(t: string) {
  return Text({ style: { font: '600 12px sans-serif', color: '#5f6368' }, children: t });
}

function SnackbarDemo() {
  const snackbar = useSnackbar();
  return Button({
    variant: 'outlined',
    label: 'Show snackbar',
    onClick: () => snackbar.toast({ title: 'Message sent', actionLabel: 'Undo', onAction: () => {} } as any),
  });
}

function App() {
  const [tab, setTab] = createSignal('overview');

  return Column({
    mainAxisSize: 'min',
    children: [
      AppBar({
        color: 'primary',
        children: [AppBar.Title({ children: 'Cairn Material' })],
      }),

      Column({
        mainAxisSize: 'min',
        style: { align: 'center' },
        children: [
          Box({
            style: { width: 720, padding: 24 },
            children: Column({
              mainAxisSize: 'min',
              style: { gap: 22 },
              children: [
                label('Cards (elevation + outlined) with a List'),
                Row({ mainAxisSize: 'min', style: { gap: 16 }, children: [
                  Card({
                    elevation: 2,
                    style: { width: 320 },
                    children: List({ children: () => Column({ mainAxisSize: 'min', children: [
                      List.Item({ leading: dot('#3b82f6'), children: 'Inbox', trailing: Badge({ badgeContent: 4, color: 'primary' }) }),
                      List.Item({ leading: dot('#22c55e'), children: 'Sent', onClick: () => {} }),
                      List.Item({ leading: dot('#ef4444'), children: 'Spam', selected: true, onClick: () => {} }),
                    ] }) }),
                  }),
                  Card({
                    variant: 'outlined',
                    style: { width: 320 },
                    children: Card.Content({ children: Column({ mainAxisSize: 'min', style: { gap: 8 }, children: [
                      Text({ style: { font: '500 16px sans-serif', color: '#202124' }, children: 'Outlined card' }),
                      Text({ style: { font: '14px sans-serif', color: '#5f6368' }, children: 'A bordered surface variant.' }),
                    ] }) }),
                  }),
                ] }),

                label('Tabs'),
                Tabs({
                  value: tab(),
                  onChange: setTab,
                  children: () => Column({ mainAxisSize: 'min', style: { gap: 12 }, children: [
                    Tabs.List({ children: () => Row({ mainAxisSize: 'min', children: [
                      Tabs.Tab({ value: 'overview', children: 'Overview' }),
                      Tabs.Tab({ value: 'activity', children: 'Activity' }),
                      Tabs.Tab({ value: 'settings', children: 'Settings' }),
                    ] }) }),
                    Tabs.Panel({ value: 'overview', children: () => bodyText('Overview panel content.') }),
                    Tabs.Panel({ value: 'activity', children: () => bodyText('Activity panel content.') }),
                    Tabs.Panel({ value: 'settings', children: () => bodyText('Settings panel content.') }),
                  ] }),
                }),

                label('Chips'),
                Row({ mainAxisSize: 'min', style: { gap: 8, alignY: 'center' }, children: [
                  Chip({ label: 'Filled' }),
                  Chip({ label: 'Primary', color: 'primary', onClick: () => {} }),
                  Chip({ label: 'Outlined', variant: 'outlined' }),
                  Chip({ label: 'Deletable', color: 'primary', onDelete: () => {} }),
                ] }),

                label('Progress'),
                Row({ mainAxisSize: 'min', style: { gap: 24, alignY: 'center' }, children: [
                  Box({ style: { width: 240 }, children: LinearProgress({ value: 60 }) }),
                  CircularProgress({ value: 70, variant: 'determinate' }),
                  CircularProgress({ variant: 'indeterminate' }),
                ] }),

                label('Feedback'),
                Row({ mainAxisSize: 'min', style: { gap: 12, alignY: 'center' }, children: [
                  Dialog({
                    children: () => Column({ mainAxisSize: 'min', children: [
                      Dialog.Trigger({ children: 'Open dialog' }),
                      Dialog.Content({ children: () => Column({ mainAxisSize: 'min', style: { gap: 12 }, children: [
                        Dialog.Title({ children: 'Delete item?' }),
                        Dialog.Description({ children: 'This action cannot be undone.' }),
                        Dialog.Actions({ children: [
                          Dialog.Close({ children: 'Cancel' }),
                          Button({ label: 'Delete', color: 'error' }),
                        ] }),
                      ] }) }),
                    ] }),
                  }),
                  SnackbarDemo(),
                ] }),
              ],
            }),
          }),
        ],
      }),
    ],
  });
}

function dot(color: string) {
  return Box({ style: { width: 10, height: 10, borderRadius: 5, backgroundColor: color } });
}
function bodyText(t: string) {
  return Text({ style: { font: '14px sans-serif', color: '#374151' }, children: t });
}

function Root() {
  return ThemeProvider({
    theme: createMaterialTheme(),
    children: () => SnackbarProvider({ children: () => App() }),
  });
}

mount(Root, host);
