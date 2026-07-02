import { test, expect } from 'vitest';
import type { TextInputService, TextInputClient, TextEditingValue } from '../src/index';

function makeService(): TextInputService {
  return {
    start(client: TextInputClient, initial: TextEditingValue) {
      let value = initial;
      return {
        setValue(v) { value = v; },
        close() { value = { text: '', selectionStart: 0, selectionEnd: 0 }; void value; },
      };
    },
  };
}

test('TextInputService.start returns a connection', () => {
  const svc = makeService();
  const conn = svc.start({ onChange() {} }, { text: 'hi', selectionStart: 2, selectionEnd: 2 });
  expect(typeof conn.setValue).toBe('function');
  expect(typeof conn.close).toBe('function');
});

test('client onChange contract is usable; setValue does not echo onChange', () => {
  const svc = makeService();
  const seen: TextEditingValue[] = [];
  const conn = svc.start({ onChange: (v) => seen.push(v) }, { text: '', selectionStart: 0, selectionEnd: 0 });
  conn.setValue({ text: 'a', selectionStart: 1, selectionEnd: 1 });
  expect(seen).toEqual([]);
});
