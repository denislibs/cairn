import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { createTheme } from '@cairn/style';
import { ThemeProvider, Box, Column, Text } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const theme = createTheme({
  colors: { bg: '#0f172a', surface: '#1e293b', text: '#e2e8f0', accent: '#38bdf8' },
});
type AppTheme = typeof theme;

function Card(title: string, body: string) {
  return Box({
    style: (t) => ({
      backgroundColor: (t as AppTheme).colors.surface,
      borderRadius: 12,
      padding: 20,
      width: 260,
    }),
    children: Column({
      style: { gap: 8 },
      children: [
        Text({
          style: (t) => ({ font: 'bold 20px sans-serif', color: (t as AppTheme).colors.accent }),
          children: title,
        }),
        Text({
          style: (t) => ({ font: '15px sans-serif', color: (t as AppTheme).colors.text }),
          children: body,
        }),
      ],
    }),
  });
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      {() => (
        <Box style={(t) => ({ backgroundColor: (t as AppTheme).colors.bg, padding: 24 })}>
          <Column style={{ gap: 16, align: 'start' }}>
            {[Card('Signals', 'Fine-grained reactivity.'), Card('Layout', 'Constraints down, size up.')]}
          </Column>
        </Box>
      )}
    </ThemeProvider>
  );
}

mount(App, host);
