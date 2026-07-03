import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { defaultTheme, useWidgetTheme } from '../src/theme';

it('no provider: useWidgetTheme() returns defaultTheme', () => {
  createRoot(() => {
    const result = useWidgetTheme();
    expect(result).toEqual(defaultTheme);
  });
});

it('partial theme merges colors, leaving others at default', () => {
  createRoot(() => {
    runWithContext(themeContext, () => ({ colors: { primary: '#f00' } }), () => {
      const result = useWidgetTheme();
      expect(result.colors.primary).toBe('#f00');
      expect(result.colors.surface).toBe(defaultTheme.colors.surface);
      expect(result.radii).toEqual(defaultTheme.radii);
    });
  });
});

it('partial theme: only overriding one spacing token leaves others at default', () => {
  createRoot(() => {
    runWithContext(themeContext, () => ({ spacing: { xl: 99 } }), () => {
      const result = useWidgetTheme();
      expect(result.spacing.xl).toBe(99);
      expect(result.spacing.sm).toBe(defaultTheme.spacing.sm);
    });
  });
});

it('partial theme: nested control section merges height only', () => {
  createRoot(() => {
    runWithContext(themeContext, () => ({ control: { height: { md: 50 } } }), () => {
      const result = useWidgetTheme();
      expect(result.control.height.md).toBe(50);
      expect(result.control.height.sm).toBe(defaultTheme.control.height.sm);
      expect(result.control.padX).toEqual(defaultTheme.control.padX);
    });
  });
});

it('extra user theme keys are copied over', () => {
  createRoot(() => {
    runWithContext(themeContext, () => ({ myCustomKey: 'custom-value' }), () => {
      const result = useWidgetTheme() as any;
      expect(result.myCustomKey).toBe('custom-value');
    });
  });
});
