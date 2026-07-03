import { test, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { setFrameRequester, hostContext } from '@cairn/runtime';
import { Input } from '../src/index';
import { createFakeHost } from './fake-host';
import { fakeCtx, LOOSE } from './fake';

function mountInput(host: ReturnType<typeof createFakeHost>['host'], make: () => ReturnType<typeof Input>) {
  let inst!: ReturnType<typeof Input>;
  const dispose = createRoot((d) => {
    runWithContext(hostContext, host, () => {
      inst = make();
    });
    return d;
  });
  return { inst, dispose };
}

test('focusing an Input starts a session seeded with its text', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost();
  const { inst, dispose } = mountInput(fh.host, () => Input({ value: 'hi', style: { width: 100 } }));
  inst.handlers!.onFocus!({ target: inst } as never);
  expect(fh.textInput.lastInitial).toEqual({ text: 'hi', selectionStart: 2, selectionEnd: 2 });
  dispose();
  setFrameRequester(null);
});

test('onChange updates display + caret and calls onInput', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost();
  const seen: string[] = [];
  const { inst, dispose } = mountInput(fh.host, () => Input({ onInput: (t) => seen.push(t), style: { width: 100 } }));
  inst.handlers!.onFocus!({ target: inst } as never);
  fh.textInput.emitChange({ text: 'ab', selectionStart: 2, selectionEnd: 2 });
  expect(seen).toEqual(['ab']);
  inst.layout.layout(LOOSE, fakeCtx);
  fh.renderer.calls.length = 0;
  inst.paintSelf(fh.renderer);
  const caret = fh.renderer.calls.find((c) => c[0] === 'fillRect');
  expect(caret && (caret[1] as { x: number }).x).toBe(14);
  dispose();
  setFrameRequester(null);
});

test('controlled value change pushes setValue to the connection (guarded)', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost();
  const [val, setVal] = createSignal('a');
  const { inst, dispose } = mountInput(fh.host, () => Input({ value: val, style: { width: 100 } }));
  inst.handlers!.onFocus!({ target: inst } as never);
  fh.textInput.setValues.length = 0;
  setVal('cleared');
  expect(fh.textInput.setValues.at(-1)).toEqual({ text: 'cleared', selectionStart: 7, selectionEnd: 7 });
  dispose();
  setFrameRequester(null);
});

test('onSubmit fires with the current text; blur closes the connection', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost();
  const submitted: string[] = [];
  const { inst, dispose } = mountInput(fh.host, () => Input({ onSubmit: (t) => submitted.push(t), style: { width: 100 } }));
  inst.handlers!.onFocus!({ target: inst } as never);
  fh.textInput.emitChange({ text: 'todo', selectionStart: 4, selectionEnd: 4 });
  fh.textInput.emitSubmit();
  expect(submitted).toEqual(['todo']);
  inst.handlers!.onBlur!({ target: inst } as never);
  expect(fh.textInput.closed).toBe(1);
  dispose();
  setFrameRequester(null);
});

test('empty Input paints the placeholder in the muted color', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost();
  const { inst, dispose } = mountInput(fh.host, () => Input({ placeholder: 'name', style: { width: 100 } }));
  inst.layout.layout(LOOSE, fakeCtx);
  inst.paintSelf(fh.renderer);
  const draw = fh.renderer.calls.find((c) => c[0] === 'drawText');
  expect(draw && draw[1]).toBe('name');
  expect(draw && (draw[3] as { color: string }).color).toBe('#9ca3af');
  dispose();
  setFrameRequester(null);
});

test('Input is focusable', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost();
  const { inst, dispose } = mountInput(fh.host, () => Input({ style: { width: 100 } }));
  expect(inst.focusable).toBe(true);
  dispose();
  setFrameRequester(null);
});

// ── NF3b Task 3: textbox semantics + a11y editing path ────────────────────────

test('(a11y) instance.semantics has role textbox with label and value', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost({ a11y: true });
  const { inst, dispose } = mountInput(fh.host, () =>
    Input({ value: 'hello', label: 'Name', placeholder: 'Enter name', style: { width: 100 } }),
  );
  const sem = (inst as any).semantics;
  expect(sem).toBeDefined();
  expect(sem.role).toBe('textbox');
  expect(sem.label).toBe('Name');
  expect(sem.value).toBe('hello');
  expect(sem.placeholder).toBe('Enter name');
  dispose();
  setFrameRequester(null);
});

test('(a11y) semantics.value reflects text() reactively', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost({ a11y: true });
  const [val, setVal] = createSignal('a');
  const { inst, dispose } = mountInput(fh.host, () =>
    Input({ value: val, style: { width: 100 } }),
  );
  setVal('updated');
  const sem = (inst as any).semantics;
  expect(sem.value).toBe('updated');
  dispose();
  setFrameRequester(null);
});

test('(a11y) semantics.onInput updates text() and fires props.onInput', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost({ a11y: true });
  const received: string[] = [];
  const { inst, dispose } = mountInput(fh.host, () =>
    Input({ onInput: (t) => received.push(t), style: { width: 100 } }),
  );
  const sem = (inst as any).semantics;
  sem.onInput('typed value');
  expect(received).toEqual(['typed value']);
  expect(sem.value).toBe('typed value');
  dispose();
  setFrameRequester(null);
});

test('(a11y) semantics.onKeyDown Enter fires onSubmit and returns true', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost({ a11y: true });
  const submitted: string[] = [];
  const { inst, dispose } = mountInput(fh.host, () =>
    Input({ onSubmit: (t) => submitted.push(t), style: { width: 100 } }),
  );
  const sem = (inst as any).semantics;
  sem.onInput('done');
  const result = sem.onKeyDown('Enter', { shift: false, ctrl: false, alt: false, meta: false });
  expect(result).toBe(true);
  expect(submitted).toEqual(['done']);
  dispose();
  setFrameRequester(null);
});

test('(a11y) onKeyDown non-Enter returns false', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost({ a11y: true });
  const { inst, dispose } = mountInput(fh.host, () => Input({ style: { width: 100 } }));
  const sem = (inst as any).semantics;
  expect(sem.onKeyDown('ArrowLeft', { shift: false, ctrl: false, alt: false, meta: false })).toBe(false);
  dispose();
  setFrameRequester(null);
});

test('(a11y) focusing does NOT start the seam session', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost({ a11y: true });
  const { inst, dispose } = mountInput(fh.host, () => Input({ value: 'hi', style: { width: 100 } }));
  inst.handlers!.onFocus!({ target: inst } as never);
  // seam should NOT have been started
  expect(fh.textInput.lastInitial).toBeNull();
  dispose();
  setFrameRequester(null);
});

test('(no a11y) focusing still starts the seam session (existing behavior)', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost(); // no a11y
  const { inst, dispose } = mountInput(fh.host, () => Input({ value: 'hi', style: { width: 100 } }));
  inst.handlers!.onFocus!({ target: inst } as never);
  expect(fh.textInput.lastInitial).toEqual({ text: 'hi', selectionStart: 2, selectionEnd: 2 });
  dispose();
  setFrameRequester(null);
});

test('(a11y) label falls back to placeholder when no explicit label', () => {
  setFrameRequester(() => {});
  const fh = createFakeHost({ a11y: true });
  const { inst, dispose } = mountInput(fh.host, () =>
    Input({ placeholder: 'Search…', style: { width: 100 } }),
  );
  const sem = (inst as any).semantics;
  expect(sem.label).toBe('Search…');
  dispose();
  setFrameRequester(null);
});
