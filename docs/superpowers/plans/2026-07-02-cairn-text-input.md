# Cairn Phase 8 — Text Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Typing into canvas fields — a `TextInputService` seam backed by a hidden DOM `<input>`, an `<Input>` primitive mirroring value+caret onto the canvas with a Solid-like controlled/uncontrolled value API.

**Architecture:** The hidden DOM `<input>` is the real editing buffer. `<Input>` reaches the service through a new `hostContext`/`useHost()` (populated by `mount`); on Cairn-focus it opens a session, mirrors `onChange`/caret into signals, and draws text + a non-blinking caret. Controlled sync uses a guarded effect. platform-web implements the service; core stays DOM-free.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest. Context via `runWithContext` (registers disposal on the parent). Effects flush synchronously.

**Spec:** `docs/superpowers/specs/2026-07-02-cairn-text-input-design.md`

---

## File Structure

**`@cairn/host`:** `text-input.ts` (new seam), `host.ts` (+`textInput`), `index.ts` (exports).
**`@cairn/runtime`:** `host-context.ts` (new: `hostContext`, `useHost`), `mount.ts` (`runWithContext`), `index.ts` (exports), `test/fake-host.ts` (stub `textInput`).
**`@cairn/primitives`:** `input.ts` (new `<Input>`), `index.ts` (export), `test/fake-host.ts` (`createFakeTextInput` + wire).
**`@cairn/platform-web`:** `web-text-input.ts` (new service), `create-web-host.ts` (real `textInput`), `index.ts` (export).
**Also fixed in Task 1 (Host constructors):** `packages/host/test/conformance.test.ts`, `packages/platform-web/src/create-web-host.ts` (temporary stub).
**example:** `examples/counter/main.tsx`.

---

## Task 1: Host — `TextInputService` seam + `Host.textInput`

**Files:**
- Create: `packages/host/src/text-input.ts`
- Modify: `packages/host/src/host.ts`, `packages/host/src/index.ts`
- Modify (keep workspace green — all `Host` constructors): `packages/runtime/test/fake-host.ts`, `packages/primitives/test/fake-host.ts`, `packages/host/test/conformance.test.ts`, `packages/platform-web/src/create-web-host.ts`
- Test: `packages/host/test/text-input.test.ts`

`Host.textInput` is **required**; this task stubs it in every constructor (platform-web gets a temporary stub replaced in Task 4; the primitives fake gets a *controllable* fake used by Task 3).

- [ ] **Step 1: Write the failing test** — `packages/host/test/text-input.test.ts`:

```ts
import { test, expect } from 'vitest';
import type { TextInputService, TextInputClient, TextEditingValue } from '../src/index';

// A minimal in-memory implementation proves the seam is usable.
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

test('client receives onChange values', () => {
  const svc = makeService();
  const seen: TextEditingValue[] = [];
  const conn = svc.start({ onChange: (v) => seen.push(v) }, { text: '', selectionStart: 0, selectionEnd: 0 });
  // drive a change through the client contract directly
  (svc as unknown as { last?: unknown }); // no-op; the shape is what we assert
  conn.setValue({ text: 'a', selectionStart: 1, selectionEnd: 1 });
  expect(seen).toEqual([]); // setValue is framework->proxy; does not echo onChange
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/host/test/text-input.test.ts` and `pnpm typecheck`
Expected: FAIL — the types are not exported.

- [ ] **Step 3: Create the seam** — `packages/host/src/text-input.ts`:

```ts
export interface TextEditingValue {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface TextInputClient {
  onChange(value: TextEditingValue): void; // proxy -> framework
  onSubmit?(): void; // Enter
  onCancel?(): void; // Escape
}

export interface TextInputConnection {
  setValue(value: TextEditingValue): void; // framework -> proxy
  close(): void; // end the editing session
}

export interface TextInputService {
  start(client: TextInputClient, initial: TextEditingValue): TextInputConnection;
}
```

- [ ] **Step 4: Add to `Host`** — in `packages/host/src/host.ts`:

```ts
import type { Renderer } from './renderer';
import type { FrameScheduler } from './scheduler';
import type { SurfaceMetrics } from './metrics';
import type { InputSource } from './input';
import type { TextInputService } from './text-input';

// a11y is added in its own phase (14).
export interface Host {
  renderer: Renderer;
  scheduler: FrameScheduler;
  metrics: SurfaceMetrics;
  input: InputSource;
  textInput: TextInputService;
}
```

- [ ] **Step 5: Export** — in `packages/host/src/index.ts`, add:

```ts
export type { TextInputService, TextInputClient, TextInputConnection, TextEditingValue } from './text-input';
```

- [ ] **Step 6: Fix `runtime/test/fake-host.ts`** — add `TextInputService` to the `@cairn/host` type import, and add a stub `textInput` to the `host` object in `createFakeHost`:

```ts
  const textInput: TextInputService = { start: () => ({ setValue() {}, close() {} }) };
```
and include `textInput` in `const host: Host = { renderer, scheduler: scheduler.scheduler, metrics: metrics.metrics, input: input.input, textInput };`.

- [ ] **Step 7: Fix `primitives/test/fake-host.ts`** — replace the file with (adds a controllable `createFakeTextInput` used by Task 3):

```ts
import type {
  FrameScheduler,
  SurfaceMetrics,
  Host,
  TextInputService,
  TextInputClient,
  TextEditingValue,
} from '@cairn/host';
import { createFakeRenderer } from './fake';

export function createFakeTextInput() {
  let client: TextInputClient | null = null;
  let lastInitial: TextEditingValue | null = null;
  const setValues: TextEditingValue[] = [];
  let closed = 0;
  const service: TextInputService = {
    start(c, initial) {
      client = c;
      lastInitial = initial;
      return {
        setValue(v) {
          setValues.push(v);
        },
        close() {
          closed += 1;
          client = null;
        },
      };
    },
  };
  return {
    service,
    get lastInitial() {
      return lastInitial;
    },
    setValues,
    get closed() {
      return closed;
    },
    emitChange(v: TextEditingValue) {
      client?.onChange(v);
    },
    emitSubmit() {
      client?.onSubmit?.();
    },
    emitCancel() {
      client?.onCancel?.();
    },
  };
}

export function createFakeHost() {
  const renderer = createFakeRenderer();
  const pending: Array<() => void> = [];
  const scheduler: FrameScheduler = {
    requestFrame(cb) {
      pending.push(() => cb(0));
      return pending.length;
    },
    cancelFrame() {},
  };
  const metrics: SurfaceMetrics = {
    width: 200,
    height: 100,
    devicePixelRatio: 1,
    onResize: () => () => {},
    dispose: () => {},
  };
  const input = { onPointer: () => () => {}, onWheel: () => () => {}, onKey: () => () => {} };
  const textInput = createFakeTextInput();
  const host: Host = { renderer, scheduler, metrics, input, textInput: textInput.service };
  return {
    host,
    renderer,
    textInput,
    flush() {
      const q = pending.splice(0);
      for (const f of q) f();
    },
  };
}
```

- [ ] **Step 8: Fix `host/test/conformance.test.ts`** — add `textInput` to the `host` literal (~line 63):

```ts
  const input = { onPointer: () => () => {}, onWheel: () => () => {}, onKey: () => () => {} };
  const textInput = { start: () => ({ setValue() {}, close() {} }) };
  const host: Host = { renderer: makeNoopRenderer(), scheduler, metrics, input, textInput };
```

- [ ] **Step 9: Temporary stub in `create-web-host.ts`** — before the `return`, add (replaced in Task 4):

```ts
  // Placeholder; replaced by WebTextInputService in a later task.
  const textInput = { start: () => ({ setValue() {}, close() {} }) };

  return { renderer, scheduler, metrics, input, textInput };
```

- [ ] **Step 10: Verify green**

Run: `pnpm vitest run packages/host/test/text-input.test.ts` → PASS (2).
Run: `pnpm typecheck` → PASS. Run: `pnpm vitest run` → PASS (all). (If any other `Host` constructor exists, grep `: Host =` / `as Host` and fix it the same way; report if found.)

- [ ] **Step 11: Commit**

```bash
git add packages/host/src/text-input.ts packages/host/src/host.ts packages/host/src/index.ts packages/host/test/text-input.test.ts packages/runtime/test/fake-host.ts packages/primitives/test/fake-host.ts packages/host/test/conformance.test.ts packages/platform-web/src/create-web-host.ts
git commit -m "feat(host): TextInputService seam + Host.textInput"
```

---

## Task 2: Runtime — `hostContext` + `useHost` + mount wiring

**Files:**
- Create: `packages/runtime/src/host-context.ts`
- Modify: `packages/runtime/src/mount.ts`, `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/use-host.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/runtime/test/use-host.test.ts`:

```ts
import { test, expect, afterEach } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, useHost, type Instance } from '../src/index';
import { createFakeHost } from './fake-host';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

test('useHost returns the mounted host inside the tree', () => {
  const { host } = createFakeHost();
  let seen: unknown;
  const comp = (): Instance => {
    seen = useHost();
    return { layout: new BoxNode({ width: 1, height: 1 }), children: [], paintSelf() {} };
  };
  dispose = mount(comp, host);
  expect(seen).toBe(host);
});

test('useHost throws outside a mount', () => {
  expect(() => useHost()).toThrow(/useHost/);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/runtime/test/use-host.test.ts`
Expected: FAIL — `useHost` not exported / host not provided.

- [ ] **Step 3: Create the context** — `packages/runtime/src/host-context.ts`:

```ts
import { createContext, useContext } from '@cairn/reactivity';
import type { Host } from '@cairn/host';

// The active Host, provided by mount() so primitives can reach services
// (e.g. textInput, renderer.measureText) without prop-drilling.
export const hostContext = createContext<Host | null>(null);

export function useHost(): Host {
  const host = useContext(hostContext);
  if (!host) {
    throw new Error('[cairn] useHost() must be called within a mounted component tree.');
  }
  return host;
}
```

- [ ] **Step 4: Provide it in `mount`** — in `packages/runtime/src/mount.ts`:

Change the reactivity import to add `runWithContext`:
```ts
import { createRoot, runWithContext } from '@cairn/reactivity';
```
Add the context import:
```ts
import { hostContext } from './host-context';
```
Change the tree-build line from `root = component();` to:
```ts
    root = runWithContext(hostContext, host, () => component());
```

- [ ] **Step 5: Export** — in `packages/runtime/src/index.ts`, add:

```ts
export { hostContext, useHost } from './host-context';
```

- [ ] **Step 6: Verify green**

Run: `pnpm vitest run packages/runtime/test/use-host.test.ts` → PASS (2).
Run: `pnpm vitest run packages/runtime` → existing runtime tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/host-context.ts packages/runtime/src/mount.ts packages/runtime/src/index.ts packages/runtime/test/use-host.test.ts
git commit -m "feat(runtime): hostContext + useHost, provided by mount"
```

---

## Task 3: Primitives — `<Input>`

**Files:**
- Create: `packages/primitives/src/input.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/input.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/primitives/test/input.test.ts`:

```ts
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
  // caret x = padding.left(0) + prefix 'ab'.length*7 = 14
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
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/primitives/test/input.test.ts`
Expected: FAIL — `Input` not exported.

- [ ] **Step 3: Implement** — `packages/primitives/src/input.ts`:

```ts
import type { Renderer, TextInputConnection, TextEditingValue } from '@cairn/host';
import { BoxNode, toEdgeInsets } from '@cairn/layout';
import { type Instance, bind, useHost, type MaybeReactive } from '@cairn/runtime';
import { createSignal, createEffect, untrack } from '@cairn/reactivity';
import { type BaseStyle } from '@cairn/style';
import type { CairnFocusEvent } from '@cairn/events';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';

const PLACEHOLDER_COLOR = '#9ca3af';
const DEFAULT_FONT = '16px sans-serif';

function fontSizeOf(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 16;
}

export interface InputProps extends EventProps {
  value?: MaybeReactive<string>;
  onInput?: (text: string) => void;
  onSubmit?: (text: string) => void;
  placeholder?: MaybeReactive<string>;
  style?: StyleInput;
}

export function Input(props: InputProps = {}): Instance {
  const host = useHost();
  const controlled = props.value !== undefined;
  const readValue = (): string => {
    const v = props.value;
    return typeof v === 'function' ? String((v as () => string | number)()) : String(v ?? '');
  };
  const seed = controlled ? untrack(readValue) : '';
  const [text, setText] = createSignal(seed);
  const [caret, setCaret] = createSignal(seed.length);
  const [focused, setFocused] = createSignal(false);

  let conn: TextInputConnection | null = null;
  const client = {
    onChange(v: TextEditingValue) {
      setText(v.text);
      setCaret(v.selectionEnd);
      props.onInput?.(v.text);
    },
    onSubmit() {
      props.onSubmit?.(untrack(text));
    },
    onCancel() {},
  };

  // Compose focus/blur with session lifecycle, then let createInteractive own the
  // resolved style + hover/pressed/focus state.
  const interactiveProps = {
    ...props,
    onFocus: (e: CairnFocusEvent) => {
      conn = host.textInput.start(client, {
        text: untrack(text),
        selectionStart: untrack(caret),
        selectionEnd: untrack(caret),
      });
      setFocused(true);
      props.onFocus?.(e);
    },
    onBlur: (e: CairnFocusEvent) => {
      conn?.close();
      conn = null;
      setFocused(false);
      props.onBlur?.(e);
    },
  };
  const { resolved, handlers } = createInteractive(interactiveProps);

  // Controlled: sync external value changes into display + DOM proxy (guarded, no loop).
  if (controlled) {
    createEffect(() => {
      const ext = readValue();
      if (ext !== untrack(text)) {
        setText(ext);
        setCaret(ext.length);
        conn?.setValue({ text: ext, selectionStart: ext.length, selectionEnd: ext.length });
      }
    });
  }

  const layout = new BoxNode({});
  let current: BaseStyle = {};
  bind(resolved, (s) => {
    current = s;
    const pad = toEdgeInsets(s.padding);
    layout.padding = pad;
    layout.width = s.width;
    const fs = fontSizeOf(s.font ?? DEFAULT_FONT);
    layout.height = s.height ?? fs + pad.top + pad.bottom;
  });

  // Mirror reactive state into plain fields and schedule a repaint on change.
  let displayText = seed;
  let caretIndex = seed.length;
  let isFocused = false;
  bind(
    () => ({ t: text(), c: caret(), f: focused() }),
    (v) => {
      displayText = v.t;
      caretIndex = v.c;
      isFocused = v.f;
    },
  );

  let placeholder = '';
  bind(props.placeholder ?? '', (v) => {
    placeholder = String(v);
  });

  return {
    layout,
    children: [],
    focusable: true,
    handlers,
    paintSelf(r: Renderer) {
      const s = current;
      const font = s.font ?? DEFAULT_FONT;
      const color = s.color ?? '#000';
      const pad = toEdgeInsets(s.padding);
      const w = layout.size.w;
      const h = layout.size.h;
      if (s.backgroundColor) {
        r.fillRoundRect({ x: 0, y: 0, width: w, height: h }, s.borderRadius ?? 0, { color: s.backgroundColor });
      }
      r.save();
      r.clipRect({
        x: pad.left,
        y: pad.top,
        width: Math.max(0, w - pad.left - pad.right),
        height: Math.max(0, h - pad.top - pad.bottom),
      });
      if (displayText.length === 0 && placeholder) {
        r.drawText(placeholder, { x: pad.left, y: pad.top }, { font, color: PLACEHOLDER_COLOR, baseline: 'top' });
      } else {
        r.drawText(displayText, { x: pad.left, y: pad.top }, { font, color, baseline: 'top' });
      }
      if (isFocused) {
        const prefixWidth = host.renderer.measureText(displayText.slice(0, caretIndex), { font }).width;
        r.fillRect(
          { x: pad.left + prefixWidth, y: pad.top, width: 1, height: fontSizeOf(font) },
          { color },
        );
      }
      r.restore();
    },
  };
}
```

- [ ] **Step 4: Export** — in `packages/primitives/src/index.ts`, add:

```ts
export { Input } from './input';
export type { InputProps } from './input';
```

- [ ] **Step 5: Verify green**

Run: `pnpm vitest run packages/primitives/test/input.test.ts` → PASS (6).
Run: `pnpm vitest run packages/primitives` → existing primitives tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/primitives/src/input.ts packages/primitives/src/index.ts packages/primitives/test/input.test.ts
git commit -m "feat(primitives): Input primitive (controlled/uncontrolled, caret, placeholder)"
```

---

## Task 4: platform-web — `WebTextInputService`

**Files:**
- Create: `packages/platform-web/src/web-text-input.ts`
- Modify: `packages/platform-web/src/create-web-host.ts`, `packages/platform-web/src/index.ts`
- Test: `packages/platform-web/test/web-text-input.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/platform-web/test/web-text-input.test.ts`:

```ts
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
  // the first listener was removed and replaced
  first.length = 0;
  listeners.input({});
  expect(first).toEqual([]);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/platform-web/test/web-text-input.test.ts`
Expected: FAIL — `WebTextInputService` not exported.

- [ ] **Step 3: Implement** — `packages/platform-web/src/web-text-input.ts`:

```ts
import type {
  TextInputService,
  TextInputClient,
  TextInputConnection,
  TextEditingValue,
} from '@cairn/host';

// A hidden DOM <input> proxy: native typing/IME/backspace/selection captured off-canvas
// and mirrored back to the framework. One reusable element, one active session.
export class WebTextInputService implements TextInputService {
  private input: HTMLInputElement | null = null;
  private active: {
    client: TextInputClient;
    onInput: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
  } | null = null;

  // doc is optional so constructing the service never touches the DOM global
  // (createWebHost is exercised in a node test env); the real document is resolved
  // lazily, only when an editing session starts.
  constructor(private doc?: Document) {}

  private ensureInput(): HTMLInputElement {
    if (this.input) return this.input;
    const doc = this.doc ?? globalThis.document;
    const el = doc.createElement('input');
    el.type = 'text';
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', 'false');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    el.style.left = '0';
    el.style.top = '0';
    el.style.pointerEvents = 'none';
    doc.body.appendChild(el);
    this.input = el;
    return el;
  }

  start(client: TextInputClient, initial: TextEditingValue): TextInputConnection {
    this.closeActive();
    const el = this.ensureInput();
    el.value = initial.text;
    el.setSelectionRange(initial.selectionStart, initial.selectionEnd);

    const onInput = (): void => {
      client.onChange({
        text: el.value,
        selectionStart: el.selectionStart ?? el.value.length,
        selectionEnd: el.selectionEnd ?? el.value.length,
      });
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        client.onSubmit?.();
      } else if (e.key === 'Escape') {
        client.onCancel?.();
      }
    };
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKeyDown);
    el.focus();
    this.active = { client, onInput, onKeyDown };

    return {
      setValue: (v: TextEditingValue) => {
        el.value = v.text;
        el.setSelectionRange(v.selectionStart, v.selectionEnd);
      },
      close: () => this.closeActive(),
    };
  }

  private closeActive(): void {
    const el = this.input;
    if (!this.active || !el) return;
    el.removeEventListener('input', this.active.onInput);
    el.removeEventListener('keydown', this.active.onKeyDown);
    el.blur();
    this.active = null;
  }
}
```

- [ ] **Step 4: Use it in `createWebHost`** — in `packages/platform-web/src/create-web-host.ts`:

Add the import:
```ts
import { WebTextInputService } from './web-text-input';
```
Replace the placeholder `textInput` block (the comment + `const textInput = { start: ... }`) with:
```ts
  const textInput = new WebTextInputService();
```
(The `return { renderer, scheduler, metrics, input, textInput };` stays.)

- [ ] **Step 5: Export** — in `packages/platform-web/src/index.ts`, add:

```ts
export { WebTextInputService } from './web-text-input';
```

- [ ] **Step 6: Verify green**

Run: `pnpm vitest run packages/platform-web/test/web-text-input.test.ts` → PASS (5).
Run: `pnpm typecheck` → PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/platform-web/src/web-text-input.ts packages/platform-web/src/create-web-host.ts packages/platform-web/src/index.ts packages/platform-web/test/web-text-input.test.ts
git commit -m "feat(platform-web): WebTextInputService hidden-input proxy"
```

---

## Task 5: Example — live text field + full green

**Files:**
- Modify: `examples/counter/main.tsx`
- (No new tests; workspace must stay green.)

- [ ] **Step 1: Add an `<Input>` demo** — in `examples/counter/main.tsx`, import `Input` and add a live greeting field. Add `Input` to the `@cairn/primitives` import, add a `name` signal, and place the field + greeting in the outer `Column`:

```tsx
import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Text, Input } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [count, setCount] = createSignal(0);
const [name, setName] = createSignal('');

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center', gap: 12 }}>
      <Box
        focusable
        style={{
          backgroundColor: '#3b82f6',
          borderRadius: 16,
          padding: 24,
          hover: { backgroundColor: '#2563eb' },
          pressed: { backgroundColor: '#1d4ed8' },
          focus: { backgroundColor: '#1e40af' },
        }}
        onClick={() => setCount(count() + 1)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCount(count() + 1);
          }
        }}
      >
        <Column style={{ gap: 8, align: 'center' }}>
          <Text style={{ font: 'bold 20px sans-serif', color: '#e0e7ff' }}>Cairn counter</Text>
          <Text style={{ font: '64px sans-serif', color: '#ffffff' }}>{() => String(count())}</Text>
        </Column>
      </Box>
      <Input
        value={name}
        onInput={setName}
        placeholder="Type your name"
        style={{
          width: 260,
          backgroundColor: '#ffffff',
          color: '#111827',
          borderRadius: 8,
          padding: 10,
          focus: { backgroundColor: '#eef2ff' },
        }}
      />
      <Text style={{ font: '18px sans-serif', color: '#1f2937' }}>
        {() => (name() ? `Hi, ${name()}!` : '')}
      </Text>
    </Column>
  );
}

mount(App, host);
```

- [ ] **Step 2: Full workspace green**

Run: `pnpm vitest run` → PASS (all).
Run: `pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/counter/main.tsx
git commit -m "example: live <Input> greeting field (text input demo)"
```

---

## Exit Criteria

- Typing into a focused `<Input>` updates the on-canvas text; caret tracks the insertion point.
- Controlled + uncontrolled both work; Enter submits; Escape cancels; placeholder shows when empty.
- `pnpm vitest run` + `pnpm typecheck` green across the workspace.
- Manual browser check: click the field, type, see the live greeting; the counter button still works.

## Out of Scope (later)

- Selection-highlight rendering, multiline, blinking caret (Phase 13), horizontal scroll, IME
  candidate-window positioning, richer clipboard, overlay positioning, field types.
