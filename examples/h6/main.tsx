import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Column, Row, Text } from '@cairn/primitives';
import {
  Card, Avatar, Badge, Chip, Progress, Skeleton, List, Table, Divider,
} from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

function section(t: string) {
  return Text({ style: { font: '600 13px sans-serif', color: '#111827' }, children: t });
}

function App() {
  return Column({
    style: { justify: 'center', align: 'center' },
    children: [
      Card({
        elevation: 3,
        padding: 32,
        style: { width: 680, backgroundColor: '#ffffff', borderRadius: 20 },
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 18 },
          children: [
            Text({ style: { font: 'bold 20px sans-serif', color: '#0f172a' }, children: '@cairn/widgets — H6 data display' }),

            section('List (avatars + badges)'),
            List({
              children: () => Column({
                mainAxisSize: 'min',
                style: { gap: 4 },
                children: [
                  List.Item({
                    leading: Avatar({ initials: 'AK', size: 32 }),
                    children: 'Anna Karenina',
                    trailing: Badge({ content: 3, color: 'primary' }),
                    onClick: () => {},
                  }),
                  List.Item({
                    leading: Avatar({ initials: 'LT', size: 32, shape: 'square' }),
                    children: 'Leo Tolstoy',
                    trailing: Badge({ content: 128, max: 99, color: 'danger' }),
                    onClick: () => {},
                  }),
                ],
              }),
            }),

            Divider({}),

            section('Chips'),
            Row({ mainAxisSize: 'min', style: { gap: 8, alignY: 'center' }, children: [
              Chip({ label: 'Default' }),
              Chip({ label: 'Clickable', onClick: () => {} }),
              Chip({ label: 'Deletable', variant: 'solid', onDelete: () => {} }),
              Chip({ label: 'Disabled', disabled: true, onClick: () => {} }),
            ] }),

            section('Progress'),
            Column({ mainAxisSize: 'min', style: { gap: 8 }, children: [
              Progress({ value: 35 }),
              Progress({ value: 70, color: 'success' }),
            ] }),

            section('Skeleton'),
            Row({ mainAxisSize: 'min', style: { gap: 12, alignY: 'center' }, children: [
              Skeleton({ variant: 'circle', height: 40, width: 40 }),
              Column({ mainAxisSize: 'min', style: { gap: 6 }, children: [
                Skeleton({ variant: 'text', width: 180 }),
                Skeleton({ variant: 'text', width: 120 }),
              ] }),
            ] }),

            section('Table'),
            Table({
              columns: [
                { key: 'name', header: 'Name' },
                { key: 'role', header: 'Role' },
                { key: 'score', header: 'Score', align: 'right', width: 80 },
              ],
              rows: [
                { name: 'Anna', role: 'Admin', score: 98 },
                { name: 'Leo', role: 'Editor', score: 76 },
                { name: 'Fyodor', role: 'Viewer', score: 54 },
              ],
            }),
          ],
        }),
      }),
    ],
  });
}

mount(App, host);
