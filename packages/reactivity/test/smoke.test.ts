import { test, expect } from 'vitest';
import { VERSION } from '../src/index';

test('package is importable', () => {
  expect(VERSION).toBe('0.0.0');
});
