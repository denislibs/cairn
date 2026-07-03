import { describe, it, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { themeContext, type Theme } from '@cairn/style';
import { createInteractive } from '../src/interactive';

it('resolved style reacts to a signal-backed theme', () => {
  createRoot(() => {
    const [mode, setMode] = createSignal('light');
    const getter = () => ({ colors: { fg: mode() === 'dark' ? '#fff' : '#000' } } as Theme);
    // provide the theme accessor via context, then create an interactive whose style reads the theme
    runWithContext(themeContext, getter, () => {
      const { resolved } = createInteractive({ style: (t: Theme) => ({ color: (t.colors as any).fg }) });
      expect(resolved().color).toBe('#000');
      setMode('dark');
      expect(resolved().color).toBe('#fff');
    });
  });
});
