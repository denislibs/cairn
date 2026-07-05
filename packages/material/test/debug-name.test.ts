import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Button } from '../src/button';
import { Chip } from '../src/chip';
import { createMaterialTheme } from '../src/theme';

function fakeHost() {
  return { scheduler: { requestFrame() { return 1; }, cancelFrame() {} }, renderer: {}, metrics: {}, input: {} } as any;
}
function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  return runWithContext(hostContext, fakeHost(), () =>
    runWithContext(themeContext, () => theme as any, fn));
}

describe('material debugName', () => {
  it('Button is named Button (overrides inner widget)', () => {
    createRoot(() => withContext(() => {
      expect(Button({ label: 'OK' }).debugName).toBe('Button');
    }));
  });
  it('Chip is named Chip', () => {
    createRoot(() => withContext(() => {
      expect(Chip({ label: 'x' }).debugName).toBe('Chip');
    }));
  });
});
