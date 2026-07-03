import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { createCompoundContext } from '../src/context';

it('use() returns the provided value when within context', () => {
  createRoot(() => {
    const ctx = createCompoundContext<{ v: number }>('TestRoot');
    runWithContext(ctx.context, { v: 1 }, () => {
      expect(ctx.use()).toEqual({ v: 1 });
    });
  });
});

it('use() throws with the name in the message when outside context', () => {
  createRoot(() => {
    const ctx = createCompoundContext<{ v: number }>('MyWidget');
    expect(() => ctx.use()).toThrow('MyWidget');
  });
});

it('use() throws with [cairn] prefix when outside context', () => {
  createRoot(() => {
    const ctx = createCompoundContext<string>('SomeComponent');
    expect(() => ctx.use()).toThrow('[cairn]');
  });
});

it('use() throws mentioning <Root> when outside context', () => {
  createRoot(() => {
    const ctx = createCompoundContext<boolean>('Accordion');
    expect(() => ctx.use()).toThrow('<Root>');
  });
});
