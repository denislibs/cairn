import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Text, Image, Spinner } from '@cairn/primitives';
import { StyleSheet } from '@cairn/style';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

// A valid 1×1 blue-pixel PNG data URL — works offline, no network needed.
// objectFit:'cover' stretches it to fill the 200×140 box.
const BLUE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const s = StyleSheet.create({
  root: { justify: 'center', align: 'center' },
  card: {
    width: 320,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#1b1b1d',
    boxShadow: { color: '#0007', blur: 32, offsetX: 0, offsetY: 12 },
  },
  inner: { align: 'center', gap: 20, mainAxisSize: 'min' },
  heading: { font: 'bold 22px sans-serif', color: '#ffffff' },
  label: { font: '13px sans-serif', color: '#9ca3af' },
  imageBox: { width: 200, height: 140, borderRadius: 12, overflow: 'hidden' },
  divider: { width: 264, height: 1, backgroundColor: '#2a2a2e' },
  spinnerRow: { align: 'center', gap: 10, mainAxisSize: 'min' },
});

function App() {
  return (
    <Column style={s.root}>
      <Box style={s.card}>
        <Column style={s.inner}>
          <Text style={s.heading}>Image</Text>

          {/* Async URL image with rounded corners via wrapping Box (overflow:hidden) */}
          <Box style={s.imageBox}>
            <Image
              src={BLUE_PNG}
              width={200}
              height={140}
              objectFit="cover"
            />
          </Box>

          <Text style={s.label}>async src · objectFit cover · spinner while loading</Text>

          <Box style={s.divider} />

          {/* Standalone Spinner demo */}
          <Column style={s.spinnerRow}>
            <Spinner size={32} />
            <Text style={s.label}>Spinner</Text>
          </Column>
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
