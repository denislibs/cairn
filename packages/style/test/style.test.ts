import { test, expect } from 'vitest';
import { StyleSheet, STATE_ORDER, type Style } from '../src/index';

test('StyleSheet.create returns the same object (typed registry)', () => {
  const input = {
    card: { backgroundColor: '#fff', borderRadius: 8, hover: { backgroundColor: '#eee' } },
  };
  const styles = StyleSheet.create(input);
  expect(styles).toBe(input); // identity — no clone
  expect(styles.card.backgroundColor).toBe('#fff');
  expect(styles.card.hover?.backgroundColor).toBe('#eee');
});

test('STATE_ORDER lists states with disabled last (highest precedence)', () => {
  expect(STATE_ORDER).toEqual(['hover', 'focus', 'active', 'pressed', 'disabled']);
});

test('a Style can carry nested state variants', () => {
  const s: Style = { width: 10, hover: { width: 20 }, disabled: { color: '#999' } };
  expect(s.width).toBe(10);
  expect(s.hover?.width).toBe(20);
});
