import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { Text } from '@cairn/primitives';
import { Button } from '../src/button';
import { Chip } from '../src/chip';
import { Badge } from '../src/badge';
import { Accordion } from '../src/accordion';
import { defaultTheme } from '../src/theme';

function withTheme<T>(fn: () => T): T {
  return runWithContext(themeContext, () => defaultTheme as any, fn);
}

describe('widget debugName', () => {
  it('Button instance is named', () => {
    createRoot(() => withTheme(() => {
      expect(Button({ label: 'OK' }).debugName).toBe('Button');
    }));
  });
  it('Chip instance is named', () => {
    createRoot(() => withTheme(() => {
      expect(Chip({ label: 'x' }).debugName).toBe('Chip');
    }));
  });
  it('Badge instance is named', () => {
    createRoot(() => withTheme(() => {
      expect(Badge({ content: 1 }).debugName).toBe('Badge');
    }));
  });
  it('Accordion root instance is named', () => {
    createRoot(() => withTheme(() => {
      expect(Accordion({ children: () => Text({ children: '' }) }).debugName).toBe('Accordion');
    }));
  });
});
