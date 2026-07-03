import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Text, ScrollView } from '@cairn/primitives';
import { StyleSheet } from '@cairn/style';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const ROW_COUNT = 40;

const s = StyleSheet.create({
  outer: { justify: 'center', align: 'center' },
  card: {
    width: 420,
    height: 500,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#1b1b1d',
    boxShadow: { color: '#0007', blur: 32, offsetX: 0, offsetY: 12 },
  },
  cardInner: { gap: 12 },
  header: { font: 'bold 18px sans-serif', color: '#ffffff' },
  scroll: {
    width: 380,
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
  },
  list: { gap: 8 },
  rowEven: {
    width: 380,
    height: 44,
    backgroundColor: '#2a2a2e',
    borderRadius: 8,
    padding: 12,
    alignY: 'center',
  },
  rowOdd: {
    width: 380,
    height: 44,
    backgroundColor: '#222226',
    borderRadius: 8,
    padding: 12,
    alignY: 'center',
  },
  rowText: { font: '14px sans-serif', color: '#d1d5db' },
});

function App() {
  const rows = Array.from({ length: ROW_COUNT }, (_, i) => i);

  return (
    <Column style={s.outer}>
      <Box style={s.card}>
        <Column style={s.cardInner}>
          <Text style={s.header}>Список строк</Text>
          <ScrollView style={s.scroll}>
            <Column style={s.list}>
              {rows.map((i) => (
                <Box style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                  <Text style={s.rowText}>{`Строка ${i + 1}`}</Text>
                </Box>
              ))}
            </Column>
          </ScrollView>
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
