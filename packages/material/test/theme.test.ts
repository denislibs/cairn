import { describe, it, expect } from 'vitest';
import { createMaterialTheme } from '../src/theme';
describe('createMaterialTheme', () => {
  it('default light palette', () => {
    const t = createMaterialTheme();
    expect(t.palette.mode).toBe('light');
    expect(t.palette.primary.main.startsWith('#')).toBe(true);
    expect(t.palette.primary.contrastText).toBeTruthy();
    expect(t.palette.background.default).toBe('#fafafa');
  });
  it('dark mode swaps background/text', () => {
    const t = createMaterialTheme({ mode: 'dark' });
    expect(t.palette.mode).toBe('dark');
    expect(t.palette.background.default).toBe('#121212');
    expect(t.palette.text.primary).toBe('#fff');
  });
  it('opts.primary overrides main and derives light/dark', () => {
    const t = createMaterialTheme({ primary: '#ff0000' });
    expect(t.palette.primary.main).toBe('#ff0000');
    expect(t.palette.primary.light).not.toBe('#ff0000');
    expect(t.palette.primary.dark).not.toBe('#ff0000');
  });
  it('elevation has 25 entries; [0] empty; [1] non-empty', () => {
    const t = createMaterialTheme();
    expect(t.elevation.length).toBe(25);
    expect(t.elevation[0]).toEqual([]);
    expect(t.elevation[1].length).toBeGreaterThan(0);
    expect(typeof t.elevation[1][0].blur).toBe('number');
  });
  it('typography has all variants with numeric fontSize', () => {
    const t = createMaterialTheme();
    for (const v of ['h1','h2','h3','h4','h5','h6','subtitle1','subtitle2','body1','body2','button','caption','overline'] as const) {
      expect(typeof t.typography[v].fontSize).toBe('number');
    }
    expect(t.typography.button.textTransform).toBe('uppercase');
  });
  it('shape + spacing', () => {
    const t = createMaterialTheme();
    expect(t.shape.borderRadius).toBe(4);
    expect(t.spacing(3)).toBe(24);
  });
  it('exposes a colors map for generic theme consumers', () => {
    const t = createMaterialTheme();
    expect((t as any).colors.primary).toBe(t.palette.primary.main);
  });
});
