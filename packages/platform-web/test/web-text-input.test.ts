import { test, expect } from 'vitest';
import { WebTextInputService } from '../src/index';
import type { TextEditingValue } from '@cairn/host';

// Minimal fake <input> + document recording listeners and DOM ops.
function fakeDoc() {
  const listeners: Record<string, (ev: unknown) => void> = {};
  const input = {
    type: '',
    value: '',
    selectionStart: 0 as number | null,
    selectionEnd: 0 as number | null,
    style: {} as Record<string, string>,
    focused: false,
    setAttribute() {},
    setSelectionRange(s: number, e: number) {
      this.selectionStart = s;
      this.selectionEnd = e;
    },
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
    },
    addEventListener(type: string, cb: (ev: unknown) => void) {
      listeners[type] = cb;
    },
    removeEventListener(type: string) {
      delete listeners[type];
    },
  };
  const doc = {
    body: { appendChild() {} },
    createElement() {
      return input;
    },
  };
  return { doc: doc as unknown as Document, input, listeners };
}

test('start seeds the input value + selection and focuses it', () => {
  const { doc, input } = fakeDoc();
  const svc = new WebTextInputService(doc);
  svc.start({ onChange() {} }, { text: 'hi', selectionStart: 1, selectionEnd: 2 });
  expect(input.value).toBe('hi');
  expect(input.selectionStart).toBe(1);
  expect(input.selectionEnd).toBe(2);
  expect(input.focused).toBe(true);
});

test('input events normalize to onChange', () => {
  const { doc, input, listeners } = fakeDoc();
  const svc = new WebTextInputService(doc);
  const seen: TextEditingValue[] = [];
  svc.start({ onChange: (v) => seen.push(v) }, { text: '', selectionStart: 0, selectionEnd: 0 });
  input.value = 'ab';
  input.selectionStart = 2;
  input.selectionEnd = 2;
  listeners.input({});
  expect(seen).toEqual([{ text: 'ab', selectionStart: 2, selectionEnd: 2 }]);
});

test('Enter triggers onSubmit + preventDefault; Escape triggers onCancel', () => {
  const { doc, listeners } = fakeDoc();
  const svc = new WebTextInputService(doc);
  let submitted = false;
  let cancelled = false;
  let prevented = false;
  svc.start({ onChange() {}, onSubmit: () => (submitted = true), onCancel: () => (cancelled = true) }, { text: '', selectionStart: 0, selectionEnd: 0 });
  listeners.keydown({ key: 'Enter', preventDefault: () => (prevented = true) });
  listeners.keydown({ key: 'Escape', preventDefault: () => {} });
  expect(submitted).toBe(true);
  expect(prevented).toBe(true);
  expect(cancelled).toBe(true);
});

test('close blurs the input and stops delivering', () => {
  const { doc, input, listeners } = fakeDoc();
  const svc = new WebTextInputService(doc);
  const seen: unknown[] = [];
  const conn = svc.start({ onChange: (v) => seen.push(v) }, { text: '', selectionStart: 0, selectionEnd: 0 });
  conn.close();
  expect(input.focused).toBe(false);
  expect(listeners.input).toBeUndefined();
});

test('a second start closes the first session', () => {
  const { doc, listeners } = fakeDoc();
  const svc = new WebTextInputService(doc);
  const first: unknown[] = [];
  svc.start({ onChange: (v) => first.push(v) }, { text: '', selectionStart: 0, selectionEnd: 0 });
  svc.start({ onChange() {} }, { text: 'x', selectionStart: 1, selectionEnd: 1 });
  first.length = 0;
  listeners.input({});
  expect(first).toEqual([]);
});
