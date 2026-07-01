import { test, expect, vi } from 'vitest';
import { createRoot, onCleanup } from '../src/index';

test('createRoot runs its function and returns the result', () => {
  const result = createRoot(() => 42);
  expect(result).toBe(42);
});

test('createRoot passes a dispose function', () => {
  createRoot((dispose) => {
    expect(typeof dispose).toBe('function');
  });
});

test('onCleanup callbacks run when the root is disposed', () => {
  const cleanup = vi.fn();
  createRoot((dispose) => {
    onCleanup(cleanup);
    expect(cleanup).not.toHaveBeenCalled();
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

test('onCleanup outside any owner is a no-op (does not throw)', () => {
  expect(() => onCleanup(() => {})).not.toThrow();
});
