# DT4a — Live Style Editing + Panel Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cairn DevTools' Styles tab live — select a node, add/edit/toggle a style property, and see it applied to the running canvas app — and raise the extension panel to the canonical mockup look.

**Architecture:** A dev-only per-instance style-override store in `@cairn/runtime` (driven by one global reactive "version" signal, inert until `activateStyleOverrides()`); primitive `bind` callbacks merge the override over the resolved style so edits affect both paint and layout. The agent resolves node ids to instances and applies `set/toggle/remove-style` panel commands through a string→BaseStyle parser. The panel is rewritten to the mockup markup/CSS with the Styles tab wired live and Signals/Performance populated from existing D3 commit data.

**Tech Stack:** TypeScript, pnpm workspaces, vitest (+jsdom), esbuild (extension), Chrome MV3, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-05-dt4a-live-style-editing-design.md`
**Visual reference:** `docs/superpowers/specs/assets/dt4-devtools-mockup.html`

---

## File Structure

**Core:**
- `packages/runtime/src/dev-style-override.ts` (new) — override store + `readStyleOverride`/`applyStyleOverride`/`set/toggle/remove/clearStyleProp`/`activateStyleOverrides`.
- `packages/runtime/src/index.ts` — export the above.
- `packages/primitives/src/{box,text,flex,grid}.ts` — merge override in the style bind.

**`@cairn/devtools`:**
- `ids.ts` — restore `instanceById` (reverse `WeakRef` map).
- `parse-style.ts` (new) — `parseStyleValue(prop, raw)`.
- `protocol.ts` — `set-style`/`toggle-style`/`remove-style` PanelCommands.
- `agent.ts` — handle the new commands; call `activateStyleOverrides()` on install.
- `index.ts` — export `instanceById`.

**Extension:**
- `src/panel/panel.html`, `panel.css`, `panel.ts` — rewrite to the mockup; Styles live; Signals/Perf on D3 data.
- `README.md` — checklist.

**Tests:** unit per new module + Playwright e2e.

---

## Task 1: Restore `instanceById` resolution

**Files:**
- Modify: `packages/devtools/src/ids.ts`
- Test: `packages/devtools/test/ids.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/devtools/test/ids.test.ts` (extend the existing file; add `instanceById` to the import from `../src/ids`; it already has a `fakeInstance()` helper):
```ts
  it('resolves an instance back by id', () => {
    const a = fakeInstance();
    const id = idOf(a);
    expect(instanceById(id)).toBe(a);
  });
  it('returns undefined for an unknown id', () => {
    expect(instanceById(123456)).toBeUndefined();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/ids.test.ts`
Expected: FAIL (`instanceById` not exported).

- [ ] **Step 3: Implement**

Replace `packages/devtools/src/ids.ts` with:
```ts
import type { Instance } from '@cairn/runtime';

const idMap = new WeakMap<Instance, number>();
const reverse = new Map<number, WeakRef<Instance>>();
let nextId = 1;

export function idOf(inst: Instance): number {
  let id = idMap.get(inst);
  if (id === undefined) {
    id = nextId++;
    idMap.set(inst, id);
    reverse.set(id, new WeakRef(inst));
  }
  return id;
}

export function instanceById(id: number): Instance | undefined {
  return reverse.get(id)?.deref();
}

/** Test-only: resets the reverse map and counter (idMap is a WeakMap, keyed by identity). */
export function resetIds(): void {
  reverse.clear();
  nextId = 1;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- packages/devtools/test/ids.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/ids.ts packages/devtools/test/ids.test.ts
git commit -m "feat(devtools): restore instanceById for command resolution"
```

---

## Task 2: Dev style-override seam

**Files:**
- Create: `packages/runtime/src/dev-style-override.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/dev-style-override.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/runtime/test/dev-style-override.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createRoot, createEffect } from '@cairn/reactivity';
import type { Instance } from '../src/instance';
import {
  activateStyleOverrides, readStyleOverride, applyStyleOverride,
  setStyleProp, toggleStyleProp, removeStyleProp, clearStyleOverride,
} from '../src/dev-style-override';

function inst(): Instance {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 } } as any, children: [], paintSelf() {} };
}

describe('applyStyleOverride', () => {
  it('returns base unchanged when no override', () => {
    const base = { backgroundColor: '#fff' } as any;
    expect(applyStyleOverride(base, undefined)).toBe(base);
  });
  it('applies patch over base and drops disabled keys', () => {
    const base = { backgroundColor: '#fff', opacity: 1 } as any;
    const out = applyStyleOverride(base, { patch: { backgroundColor: '#f00' }, disabled: new Set(['opacity']) });
    expect(out).toEqual({ backgroundColor: '#f00' });
    expect(base).toEqual({ backgroundColor: '#fff', opacity: 1 }); // base untouched
  });
});

describe('override store reactivity', () => {
  beforeEach(() => activateStyleOverrides());

  it('returns undefined for an instance with no edits', () => {
    expect(readStyleOverride(inst())).toBeUndefined();
  });

  it('setStyleProp is visible to readStyleOverride and re-runs a reader effect', () => {
    const a = inst();
    let runs = 0; let seen: unknown;
    createRoot(() => {
      createEffect(() => { const o = readStyleOverride(a); seen = o?.patch.backgroundColor; runs++; });
    });
    expect(runs).toBe(1);
    setStyleProp(a, 'backgroundColor', '#f00');
    expect(runs).toBe(2);
    expect(seen).toBe('#f00');
  });

  it('toggle disables/enables and remove/clear reset a prop', () => {
    const a = inst();
    setStyleProp(a, 'opacity', 0.5);
    toggleStyleProp(a, 'opacity', false);
    expect(readStyleOverride(a)?.disabled.has('opacity')).toBe(true);
    toggleStyleProp(a, 'opacity', true);
    expect(readStyleOverride(a)?.disabled.has('opacity')).toBe(false);
    removeStyleProp(a, 'opacity');
    expect(readStyleOverride(a)?.patch.opacity).toBeUndefined();
    clearStyleOverride(a);
    expect(readStyleOverride(a)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/runtime/test/dev-style-override.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/runtime/src/dev-style-override.ts`:
```ts
import { createSignal } from '@cairn/reactivity';
import type { Instance } from './instance';
import type { BaseStyle } from '@cairn/style';

export interface StyleOverride {
  patch: Record<string, unknown>;
  disabled: Set<string>;
}

const store = new WeakMap<Instance, StyleOverride>();
let active = false;
// One global reactive "version" — style binds subscribe to it (only when active) so any
// override edit re-runs them. equals:false => every bump notifies.
const [version, setVersion] = createSignal(0, { equals: false });

/** Enable the override system (called by installDevtools before mount). Prod stays inert. */
export function activateStyleOverrides(): void {
  active = true;
}

/** REACTIVE read — call inside a style bind. Returns the instance's override, or undefined.
 *  When inactive it returns immediately without subscribing (zero prod cost). */
export function readStyleOverride(inst: Instance): StyleOverride | undefined {
  if (!active) return undefined;
  version(); // subscribe so edits re-run this bind
  return store.get(inst);
}

/** Merge an override over a resolved style. Returns `base` unchanged when there is nothing to apply. */
export function applyStyleOverride(base: BaseStyle, ovr: StyleOverride | undefined): BaseStyle {
  if (!ovr || (Object.keys(ovr.patch).length === 0 && ovr.disabled.size === 0)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const k of ovr.disabled) delete out[k];
  Object.assign(out, ovr.patch);
  return out as BaseStyle;
}

function edit(inst: Instance): StyleOverride {
  let o = store.get(inst);
  if (!o) { o = { patch: {}, disabled: new Set() }; store.set(inst, o); }
  return o;
}
function bump(): void { setVersion((v) => v + 1); }

export function setStyleProp(inst: Instance, prop: string, value: unknown): void {
  const o = edit(inst); o.patch[prop] = value; o.disabled.delete(prop); bump();
}
export function toggleStyleProp(inst: Instance, prop: string, enabled: boolean): void {
  const o = edit(inst); if (enabled) o.disabled.delete(prop); else o.disabled.add(prop); bump();
}
export function removeStyleProp(inst: Instance, prop: string): void {
  const o = store.get(inst); if (!o) return; delete o.patch[prop]; o.disabled.delete(prop); bump();
}
export function clearStyleOverride(inst: Instance): void {
  if (store.delete(inst)) bump();
}
```

- [ ] **Step 4: Export from runtime index**

In `packages/runtime/src/index.ts`, add:
```ts
export {
  activateStyleOverrides, readStyleOverride, applyStyleOverride,
  setStyleProp, toggleStyleProp, removeStyleProp, clearStyleOverride,
} from './dev-style-override';
export type { StyleOverride } from './dev-style-override';
```

- [ ] **Step 5: Run + verify**

Run: `pnpm test -- packages/runtime/test/dev-style-override.test.ts`
Expected: PASS.
Run: `pnpm test -- packages/runtime`
Expected: existing runtime tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/dev-style-override.ts packages/runtime/src/index.ts packages/runtime/test/dev-style-override.test.ts
git commit -m "feat(runtime): dev style-override seam (reactive, inert until activated)"
```

---

## Task 3: Merge override in primitive style binds

**Files:**
- Modify: `packages/primitives/src/box.ts` (bind at ~184), `text.ts` (~88), `flex.ts` (~39), `grid.ts` (~33)
- Test: `packages/primitives/test/style-override.test.ts`

**Technique (identical in each file):** the style bind callback is `bind(styleSource, (s) => { … body reads s … })`. Rename the parameter to `raw` and insert one line so the body keeps using `s`:
```ts
bind(styleSource, (raw) => {
  const s = applyStyleOverride(raw, readStyleOverride(instance));
  … unchanged body …
});
```
For `flex.ts`/`grid.ts` the param is typed `(s: BaseStyle)` → `(raw: BaseStyle)`. In each file add to the existing `@cairn/runtime` import:
```ts
import { /* …bind, etc… */ applyStyleOverride, readStyleOverride } from '@cairn/runtime';
```

- [ ] **Step 1: Write the failing test**

`packages/primitives/test/style-override.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { activateStyleOverrides, setStyleProp, toggleStyleProp } from '@cairn/runtime';
import { Box } from '../src/box';

describe('primitive style override', () => {
  beforeEach(() => activateStyleOverrides());

  it('override backgroundColor is reflected in the box resolved style', () => {
    createRoot(() => {
      const b = Box({ style: { backgroundColor: '#ffffff' } });
      expect(b.debugStyle?.backgroundColor).toBe('#ffffff');
      setStyleProp(b, 'backgroundColor', '#ff0000');
      expect(b.debugStyle?.backgroundColor).toBe('#ff0000');
    });
  });

  it('override width feeds the layout node', () => {
    createRoot(() => {
      const b = Box({ style: { width: 100 } });
      expect((b.layout as any).width).toBe(100);
      setStyleProp(b, 'width', 250);
      expect((b.layout as any).width).toBe(250);
    });
  });

  it('toggling a prop off removes it from the resolved style', () => {
    createRoot(() => {
      const b = Box({ style: { backgroundColor: '#abcdef' } });
      toggleStyleProp(b, 'backgroundColor', false);
      expect(b.debugStyle?.backgroundColor).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/primitives/test/style-override.test.ts`
Expected: FAIL (override not merged; debugStyle stays original).

- [ ] **Step 3: Patch `box.ts`**

In `packages/primitives/src/box.ts`, extend the `@cairn/runtime` import to include `applyStyleOverride, readStyleOverride`, then change the bind head:
```ts
  bind(styleSource, (raw) => {
    const s = applyStyleOverride(raw, readStyleOverride(instance));
    current = s;
    instance.debugStyle = s;
    // …rest of the existing body unchanged (still reads `s`)…
  });
```

- [ ] **Step 4: Patch `text.ts`, `flex.ts`, `grid.ts` the same way**

Apply the identical rename+insert to the `bind(styleSource, …)` callback in each of `text.ts` (param `s`), `flex.ts` (param `s: BaseStyle` → `raw: BaseStyle`), `grid.ts` (param `s: BaseStyle` → `raw: BaseStyle`). Add the `applyStyleOverride, readStyleOverride` import to each. The instance variable is named `instance` in all four files.

> ScrollView: its bind targets `viewportInst`, but the ScrollView tree-node identity is more involved (wrapper + viewport + bars). Verify whether `serialize` assigns the snapshot id to `viewportInst`. If yes, apply the same merge in `scroll-view.ts` keyed on `viewportInst`. If the snapshot node is a different instance, SKIP scroll-view for D4a and note it (style editing simply won't apply to ScrollView roots) — do not invent a new identity mechanism.

- [ ] **Step 5: Run + verify no regression**

Run: `pnpm test -- packages/primitives/test/style-override.test.ts`
Expected: PASS (3 tests).
Run: `pnpm test -- packages/primitives`
Expected: existing primitives tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/primitives/src/box.ts packages/primitives/src/text.ts packages/primitives/src/flex.ts packages/primitives/src/grid.ts packages/primitives/test/style-override.test.ts
git commit -m "feat(primitives): merge dev style-override into box/text/flex/grid style binds"
```

---

## Task 4: Style value parser

**Files:**
- Create: `packages/devtools/src/parse-style.ts`
- Test: `packages/devtools/test/parse-style.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/parse-style.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseStyleValue } from '../src/parse-style';

describe('parseStyleValue', () => {
  it('passes colors and font strings through', () => {
    expect(parseStyleValue('backgroundColor', '#ff0000')).toEqual({ ok: true, value: '#ff0000' });
    expect(parseStyleValue('color', 'rgb(1,2,3)')).toEqual({ ok: true, value: 'rgb(1,2,3)' });
    expect(parseStyleValue('font', '600 14px sans-serif')).toEqual({ ok: true, value: '600 14px sans-serif' });
  });
  it('parses numeric props', () => {
    expect(parseStyleValue('opacity', '0.5')).toEqual({ ok: true, value: 0.5 });
    expect(parseStyleValue('borderRadius', '6px')).toEqual({ ok: true, value: 6 });
    expect(parseStyleValue('gap', '8')).toEqual({ ok: true, value: 8 });
    expect(parseStyleValue('width', '250px')).toEqual({ ok: true, value: 250 });
  });
  it('parses padding shorthand', () => {
    expect(parseStyleValue('padding', '4')).toEqual({ ok: true, value: 4 });
    expect(parseStyleValue('padding', '2 8')).toEqual({ ok: true, value: { top: 2, right: 8, bottom: 2, left: 8 } });
    expect(parseStyleValue('padding', '1 2 3 4')).toEqual({ ok: true, value: { top: 1, right: 2, bottom: 3, left: 4 } });
  });
  it('rejects non-editable props and garbage numbers', () => {
    expect(parseStyleValue('boxShadow', 'whatever').ok).toBe(false);
    expect(parseStyleValue('transform', 'x').ok).toBe(false);
    expect(parseStyleValue('opacity', 'abc').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/parse-style.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/devtools/src/parse-style.ts`:
```ts
export type ParseResult = { ok: true; value: unknown } | { ok: false };

const STRING_PROPS = new Set(['backgroundColor', 'color', 'border', 'font']);
const NUMBER_PROPS = new Set(['opacity', 'borderRadius', 'gap', 'width', 'height']);

function num(raw: string): number | null {
  const m = raw.trim().match(/^-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isNaN(n) ? null : n;
}

export function parseStyleValue(prop: string, raw: string): ParseResult {
  const t = raw.trim();
  if (STRING_PROPS.has(prop)) return t ? { ok: true, value: t } : { ok: false };
  if (NUMBER_PROPS.has(prop)) { const n = num(t); return n === null ? { ok: false } : { ok: true, value: n }; }
  if (prop === 'padding') {
    const parts = t.split(/\s+/).map(num);
    if (parts.some((p) => p === null)) return { ok: false };
    const [a, b, c, d] = parts as number[];
    if (parts.length === 1) return { ok: true, value: a };
    if (parts.length === 2) return { ok: true, value: { top: a, right: b, bottom: a, left: b } };
    if (parts.length === 4) return { ok: true, value: { top: a, right: b, bottom: c, left: d } };
    return { ok: false };
  }
  return { ok: false }; // non-editable (boxShadow, transform, …)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- packages/devtools/test/parse-style.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/parse-style.ts packages/devtools/test/parse-style.test.ts
git commit -m "feat(devtools): parseStyleValue (string→BaseStyle for editable whitelist)"
```

---

## Task 5: Style-edit commands in the protocol + agent

**Files:**
- Modify: `packages/devtools/src/protocol.ts`
- Modify: `packages/devtools/src/agent.ts`
- Modify: `packages/devtools/src/index.ts`
- Test: `packages/devtools/test/agent.test.ts` (extend)

- [ ] **Step 1: Add the protocol commands**

In `packages/devtools/src/protocol.ts`, extend the `PanelCommand` union:
```ts
  | { type: 'set-style'; id: number; prop: string; value: string }
  | { type: 'toggle-style'; id: number; prop: string; enabled: boolean }
  | { type: 'remove-style'; id: number; prop: string }
```

- [ ] **Step 2: Write the failing test**

Add to `packages/devtools/test/agent.test.ts`:
```ts
  it('set-style command resolves the id and does not throw; get-snapshot still returns the node', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);
    const commit = events.find((e) => e.type === 'commit');
    const rootId = commit && commit.type === 'commit' ? commit.snapshot.id : -1;

    hook.send({ type: 'set-style', id: rootId, prop: 'opacity', value: '0.3' });
    hook.send({ type: 'toggle-style', id: rootId, prop: 'opacity', enabled: false });
    hook.send({ type: 'remove-style', id: rootId, prop: 'opacity' });
    hook.send({ type: 'set-style', id: 999999, prop: 'opacity', value: '0.5' }); // unknown id — no-op
    hook.send({ type: 'get-snapshot' });

    const after = [...events].reverse().find((e) => e.type === 'commit');
    expect(after && after.type === 'commit' && after.snapshot.id).toBe(rootId);
    dispose();
  });
```
> `appRoot()` in this file is a hand-built fake `Instance` without a primitive style bind, so it won't visibly change style — this test only guards that the command path resolves the id and never throws (incl. unknown id). The REAL end-to-end style application (a real Box repaints) is covered by the Playwright test in Task 9 against the demo.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/agent.test.ts`
Expected: FAIL (agent doesn't handle the new commands; TS errors on unknown command types resolve once Step 1's protocol lands).

- [ ] **Step 4: Handle commands in the agent + activate overrides on install**

In `packages/devtools/src/agent.ts`:
- Add imports:
```ts
import { activateStyleOverrides, setStyleProp, toggleStyleProp, removeStyleProp } from '@cairn/runtime';
import { instanceById } from './ids';
import { parseStyleValue } from './parse-style';
```
- In `installDevtools`, before publishing the hook, call once:
```ts
  activateStyleOverrides();
```
- In `handleCommand`'s switch, add cases:
```ts
    case 'set-style': {
      const inst = instanceById(cmd.id);
      if (inst) { const r = parseStyleValue(cmd.prop, cmd.value); if (r.ok) setStyleProp(inst, cmd.prop, r.value); }
      break;
    }
    case 'toggle-style': {
      const inst = instanceById(cmd.id);
      if (inst) toggleStyleProp(inst, cmd.prop, cmd.enabled);
      break;
    }
    case 'remove-style': {
      const inst = instanceById(cmd.id);
      if (inst) removeStyleProp(inst, cmd.prop);
      break;
    }
```

- [ ] **Step 5: Export instanceById**

In `packages/devtools/src/index.ts`, add:
```ts
export { instanceById } from './ids';
```

- [ ] **Step 6: Run + typecheck**

Run: `pnpm test -- packages/devtools`
Expected: all pass.
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/devtools/src/protocol.ts packages/devtools/src/agent.ts packages/devtools/src/index.ts packages/devtools/test/agent.test.ts
git commit -m "feat(devtools): set/toggle/remove-style commands apply to live instances"
```

---

## Task 6: Panel shell — HTML + CSS from the mockup

**Files:**
- Modify: `devtools-extension/src/panel/panel.html`
- Modify: `devtools-extension/src/panel/panel.css`

- [ ] **Step 1: Copy the mockup markup into panel.html**

Open `docs/superpowers/specs/assets/dt4-devtools-mockup.html`. Copy the `<body>` contents (the `.app` div: toolbar, maintabs, the two panels) into `devtools-extension/src/panel/panel.html`, wrapped as:
```html
<!doctype html>
<html><head><meta charset="utf-8" /><link rel="stylesheet" href="panel.css" /></head>
<body>
  … the .app markup from the mockup …
  <script src="panel.js"></script>
</body></html>
```
Do NOT include the mockup's Google Fonts `<link>` tags (CSP + offline). Keep all element ids (`tree`, `stylesPane`, `computedPane`, `sigList`, `dep`, `spark`, `perfStats`, `fps`, `flame`, `flameScale`, `perfRange`, `inspectBtn`, `recBtn`, `reloadBtn`, `sigN`).

- [ ] **Step 2: Copy the mockup CSS into panel.css**

Copy the entire contents of the mockup's `<style>` block into `devtools-extension/src/panel/panel.css`. In `:root` change the font vars to system stacks (no remote Roboto):
```css
    --mono:ui-monospace,Menlo,"Roboto Mono",monospace;
    --sans:system-ui,"Roboto",sans-serif;
```

- [ ] **Step 3: Verify build (panel.js still from old panel.ts until Task 7)**

Run: `cd devtools-extension && pnpm build`
Expected: builds; HTML/CSS copied to `dist/`. (panel.js still compiles from the current panel.ts.) No test — static assets.

- [ ] **Step 4: Commit**

```bash
git add devtools-extension/src/panel/panel.html devtools-extension/src/panel/panel.css
git commit -m "feat(extension): panel shell markup + CSS from canonical mockup"
```

---

## Task 7: Panel logic — tree + live Styles + Computed

**Files:**
- Modify: `devtools-extension/src/panel/panel.ts` (rewrite)

XSS rule: only `textContent`/DOM builders — no `innerHTML` anywhere.

- [ ] **Step 1: Rewrite panel.ts — transport + state + tab switching**

Replace `devtools-extension/src/panel/panel.ts` top with the transport/state core (reuse the existing `chrome.runtime.connect({name:'cairn-panel'})` + `port.postMessage({tabId})` + `port.onMessage` wiring from the current panel.ts):
```ts
import type { AgentEvent, PanelCommand, SnapshotNode, CommitMeta } from '@cairn/devtools';

const $ = (id: string) => document.getElementById(id)!;
const treeEl = $('tree'), stylesPane = $('stylesPane'), computedPane = $('computedPane');
const sigList = $('sigList'), sparkEl = $('spark');

let snapshot: SnapshotNode | null = null;
let selected: number | null = null;
let changedIds = new Set<number>();
const openState = new Map<number, boolean>();   // id -> expanded (default true)
const commitLog: CommitMeta[] = [];

const port = chrome.runtime.connect({ name: 'cairn-panel' });
port.postMessage({ tabId: chrome.devtools.inspectedWindow.tabId });
port.onMessage.addListener((e: AgentEvent) => handleEvent(e));
function send(command: PanelCommand): void { port.postMessage({ command }); }

function handleEvent(e: AgentEvent): void {
  if (e.type === 'hello') { send({ type: 'get-snapshot' }); return; }
  if (e.type === 'commit') {
    snapshot = e.snapshot;
    changedIds = new Set(e.changed.map((c) => c.id));
    commitLog.push(e.meta); if (commitLog.length > 60) commitLog.shift();
    if (selected == null) selected = snapshot.id;
    renderTree(); renderStyles(); renderComputed(); renderSignals(); renderSpark();
  } else if (e.type === 'selection') {
    selected = e.id; renderTree(); renderStyles(); renderComputed();
  }
}

function findNode(n: SnapshotNode | null, id: number): SnapshotNode | null {
  if (!n) return null; if (n.id === id) return n;
  for (const c of n.children) { const f = findNode(c, id); if (f) return f; } return null;
}
function isOpen(id: number): boolean { return openState.get(id) ?? true; }

document.querySelectorAll('.subtab').forEach((t) => ((t as HTMLElement).onclick = () => {
  document.querySelectorAll('.subtab').forEach((x) => x.classList.remove('on'));
  document.querySelectorAll('.tabpane').forEach((x) => x.classList.remove('on'));
  t.classList.add('on');
  document.querySelector(`.tabpane[data-pane="${(t as HTMLElement).dataset.tab}"]`)!.classList.add('on');
}));
document.querySelectorAll('.maintab[data-panel]').forEach((t) => ((t as HTMLElement).onclick = () => {
  document.querySelectorAll('.maintab').forEach((x) => x.classList.remove('on'));
  t.classList.add('on');
  const target = (t as HTMLElement).dataset.panel;
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('on', (p as HTMLElement).dataset.panel === target));
  if (target === 'perf') renderPerf();
}));
($('inspectBtn') as HTMLElement).onclick = (ev) => {
  const b = ev.currentTarget as HTMLElement; b.classList.toggle('on');
  send({ type: b.classList.contains('on') ? 'inspect-start' : 'inspect-stop' });
};
```

- [ ] **Step 2: Tree render (DOM-safe, mockup look)**

Append:
```ts
function renderTree(): void {
  treeEl.replaceChildren();
  if (snapshot) walkTree(snapshot, 0);
}
function walkTree(node: SnapshotNode, depth: number): void {
  const parent = node.children.length > 0;
  const row = document.createElement('div');
  row.className = 'node' + (node.id === selected ? ' sel' : '') + (changedIds.has(node.id) ? ' affected' : '');
  const ind = document.createElement('span'); ind.className = 'ind'; ind.textContent = ' '.repeat(depth * 3);
  const caret = document.createElement('span');
  caret.className = 'caret' + (parent ? '' : ' leaf'); caret.textContent = parent ? (isOpen(node.id) ? '▾' : '▸') : '▸';
  if (parent) caret.onclick = (e) => { e.stopPropagation(); openState.set(node.id, !isOpen(node.id)); renderTree(); };
  const lt = document.createElement('span'); lt.className = 'punct'; lt.textContent = '<';
  const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = node.name;
  const gt = document.createElement('span'); gt.className = 'punct'; gt.textContent = '>';
  const dims = document.createElement('span'); dims.className = 'dims'; dims.textContent = `${Math.round(node.rect.w)}×${Math.round(node.rect.h)}`;
  row.append(ind, caret, lt, tag, gt, dims);
  row.onclick = () => { selected = node.id; send({ type: 'select', id: node.id }); renderTree(); renderStyles(); renderComputed(); };
  row.onmouseenter = () => send({ type: 'highlight', id: node.id });
  row.onmouseleave = () => send({ type: 'highlight', id: null });
  treeEl.appendChild(row);
  if (parent && isOpen(node.id)) for (const c of node.children) walkTree(c, depth + 1);
}
```

- [ ] **Step 3: Live Styles + Computed (DOM-safe)**

Append:
```ts
const EDITABLE = new Set(['backgroundColor','color','border','font','opacity','borderRadius','gap','width','height','padding']);
const isColor = (v: string) => /^#([0-9a-f]{3,8})$/i.test(v.trim()) || /^(rgb|hsl)/i.test(v.trim());
const fmt = (v: unknown): string =>
  typeof v === 'object' && v ? JSON.stringify(v).replace(/[{}"]/g, '').replace(/,/g, ' ').replace(/:/g, ' ') : String(v);

function declRow(prop: string, v: unknown, editable: boolean): HTMLElement {
  const row = document.createElement('div'); row.className = 'decl';
  if (editable) {
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'chk'; chk.checked = true;
    chk.onchange = () => send({ type: 'toggle-style', id: selected!, prop, enabled: chk.checked });
    row.appendChild(chk);
  }
  const p = document.createElement('span'); p.className = 'prop'; p.textContent = prop;
  const colon = document.createElement('span'); colon.className = 'colon'; colon.textContent = ': ';
  row.append(p, colon);
  const vs = fmt(v);
  if (isColor(vs)) { const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = vs; row.appendChild(sw); }
  const val = document.createElement('span'); val.className = 'value' + (/^-?\d/.test(vs) ? ' num' : ''); val.textContent = vs;
  if (editable && EDITABLE.has(prop)) {
    val.contentEditable = 'true';
    val.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); (val as HTMLElement).blur(); } };
    val.onblur = () => send({ type: 'set-style', id: selected!, prop, value: val.textContent || '' });
  }
  const semi = document.createElement('span'); semi.className = 'semi'; semi.textContent = ';';
  row.append(val, semi);
  return row;
}

function styleRule(node: SnapshotNode, editable: boolean): HTMLElement {
  const rule = document.createElement('div'); rule.className = 'rule';
  const sel = document.createElement('span'); sel.className = editable ? 'sel' : 'from';
  sel.textContent = editable ? node.name : `computed for ${node.name}`;
  const open = document.createElement('span'); open.className = 'brace'; open.textContent = ' {';
  rule.append(sel, open);
  for (const [pr, v] of Object.entries(node.style ?? {})) rule.appendChild(declRow(pr, v, editable));
  if (editable) {
    const add = document.createElement('div'); add.className = 'addrow'; add.textContent = '+ add property';
    add.onclick = beginAdd; rule.appendChild(add);
  }
  const close = document.createElement('span'); close.className = 'brace'; close.textContent = '}';
  rule.appendChild(close);
  return rule;
}

function renderStyles(): void {
  stylesPane.replaceChildren();
  const node = selected != null ? findNode(snapshot, selected) : null;
  if (!node) { stylesPane.textContent = 'Select a node'; return; }
  stylesPane.appendChild(styleRule(node, true));
}
function renderComputed(): void {
  computedPane.replaceChildren();
  const node = selected != null ? findNode(snapshot, selected) : null;
  if (!node) { computedPane.textContent = 'Select a node'; return; }
  computedPane.appendChild(styleRule(node, false));
}
function beginAdd(): void {
  const name = prompt('property (e.g. backgroundColor)'); if (!name) return;
  const value = prompt(`value for ${name}`); if (value == null) return;
  send({ type: 'set-style', id: selected!, prop: name.trim(), value });
}
```
> `beginAdd` uses `prompt()` for D4a (DOM-safe, reliable); keep the mockup's `+ add property` row wired to it.

- [ ] **Step 4: Build (add temporary stubs so it compiles)**

Add at the bottom of panel.ts temporary stubs (replaced in Task 8):
```ts
function renderSignals(): void {}
function renderSpark(): void {}
function renderPerf(): void {}
```
Run: `cd devtools-extension && pnpm build`
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add devtools-extension/src/panel/panel.ts
git commit -m "feat(extension): live tree + editable Styles + Computed wired to agent"
```

---

## Task 8: Panel — Signals + Performance from real D3 data

**Files:**
- Modify: `devtools-extension/src/panel/panel.ts` (replace the Task 7 stubs)

- [ ] **Step 1: Signals list + commit spark (real data)**

Replace the `renderSignals`/`renderSpark` stubs:
```ts
function renderSignals(): void {
  const seen = new Map<number, { id: number; name?: string; count: number }>();
  for (const m of commitLog) for (const s of m.signals) {
    const e = seen.get(s.id) ?? { id: s.id, name: s.name, count: 0 };
    e.count++; if (s.name) e.name = s.name; seen.set(s.id, e);
  }
  const arr = [...seen.values()].sort((a, b) => b.count - a.count);
  $('sigN').textContent = `(${arr.length})`;
  sigList.replaceChildren();
  if (arr.length === 0) {
    const e = document.createElement('div'); e.className = 'sig'; e.style.color = 'var(--ink-faint)';
    e.textContent = 'No signal writes captured yet — interact with the app.'; sigList.appendChild(e); return;
  }
  for (const s of arr) {
    const row = document.createElement('div'); row.className = 'sig';
    const dot = document.createElement('span'); dot.className = 'dot';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.name ?? `#${s.id}`;
    const drives = document.createElement('span'); drives.className = 'drives';
    drives.textContent = `${s.count} commit${s.count !== 1 ? 's' : ''}`;
    row.append(dot, nm, drives);
    sigList.appendChild(row);
  }
}

function renderSpark(): void {
  const max = Math.max(1, ...commitLog.map((m) => m.signalWrites + m.effectRuns));
  sparkEl.replaceChildren();
  for (const m of commitLog.slice(-16)) {
    const total = m.signalWrites + m.effectRuns;
    const bar = document.createElement('div'); bar.className = 'bar' + (total === 0 ? ' empty' : '');
    if (total > 0) {
      const e = document.createElement('span'); e.className = 'e'; e.style.height = `${Math.round(m.effectRuns / max * 40)}px`;
      const s = document.createElement('span'); s.className = 's'; s.style.height = `${Math.round(m.signalWrites / max * 40)}px`;
      bar.append(e, s);
    }
    sparkEl.appendChild(bar);
  }
}
```

- [ ] **Step 2: Performance panel (real data, DOM-safe — no innerHTML)**

Replace the `renderPerf` stub:
```ts
function statEl(v: string, sub: string, k: string, cls: string): HTMLElement {
  const s = document.createElement('div'); s.className = 'stat';
  const val = document.createElement('div'); val.className = 'v' + (cls ? ' ' + cls : ''); val.textContent = v;
  if (sub) { const sm = document.createElement('small'); sm.textContent = sub; val.appendChild(sm); }
  const key = document.createElement('div'); key.className = 'k'; key.textContent = k;
  s.append(val, key); return s;
}
function renderPerf(): void {
  const budget = 16.7;
  const frames = commitLog.map((m) => m.durationMs);
  const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
  const worst = frames.length ? Math.max(...frames) : 0;
  const jank = frames.filter((d) => d > budget).length;
  const totalEff = commitLog.reduce((a, m) => a + m.effectRuns, 0);

  const stats = $('perfStats'); stats.replaceChildren();
  stats.append(
    statEl(avg.toFixed(1), 'ms', 'avg commit', avg > budget ? 'warn' : 'good'),
    statEl(worst.toFixed(1), 'ms', 'slowest frame', worst > budget ? 'bad' : 'good'),
    statEl(String(jank), '', 'frames over budget', jank ? 'warn' : 'good'),
    statEl(String(totalEff), '', 'effects run', ''),
  );

  const maxMs = Math.max(budget * 1.4, ...frames, 1);
  const fps = $('fps'); fps.replaceChildren();
  for (const d of frames.slice(-60)) {
    const bar = document.createElement('div');
    bar.className = 'frame' + (d > budget ? ' jank' : d > budget * 0.6 ? ' slow' : '');
    bar.style.height = `${Math.max(4, d / maxMs * 60)}px`; bar.title = `${d.toFixed(1)}ms`;
    fps.appendChild(bar);
  }
  $('perfRange').textContent = `last ${frames.length} commits`;

  const flame = $('flame'); flame.replaceChildren();
  const note = document.createElement('div'); note.className = 'tip';
  note.textContent = 'Per-effect flame chart arrives in a later cycle (needs effect→node attribution).';
  flame.appendChild(note);
  $('flameScale').replaceChildren();
}
```

- [ ] **Step 3: Build**

Run: `cd devtools-extension && pnpm build`
Expected: builds clean; `dist/panel.js` regenerated.

- [ ] **Step 4: Commit**

```bash
git add devtools-extension/src/panel/panel.ts
git commit -m "feat(extension): Signals list + commit spark + Performance stats from D3 data"
```

---

## Task 9: Playwright e2e — style edit changes snapshot + canvas

**Files:**
- Modify: `packages/devtools/test/integration/agent-browser.spec.ts`

- [ ] **Step 1: Add the failing test**

Append to `packages/devtools/test/integration/agent-browser.spec.ts`:
```ts
test('set-style applies to the live instance and repaints the canvas', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async () => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: any[] = []; hook.subscribe((e: any) => events.push(e));
    hook.send({ type: 'get-snapshot' });
    const commit = events.find((e) => e.type === 'commit');
    let btn: any = null; const walk = (n: any) => { if (n.name === 'Button') btn = n; n.children.forEach(walk); };
    walk(commit.snapshot);
    if (!btn) return { ok: false };

    const canvas = document.getElementById('stage') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const sx = Math.round(btn.rect.x + 4), sy = Math.round(btn.rect.y + 4); // near-corner, avoids glyphs
    const read = () => { const d = ctx.getImageData(sx, sy, 1, 1).data; return `${d[0]},${d[1]},${d[2]}`; };

    const before = read();
    hook.send({ type: 'set-style', id: btn.id, prop: 'backgroundColor', value: '#ff0000' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = read();

    const ev2: any[] = []; hook.subscribe((e: any) => ev2.push(e)); hook.send({ type: 'get-snapshot' });
    let btn2: any = null; const c2 = ev2.find((e) => e.type === 'commit');
    if (c2) { const w = (n: any) => { if (n.name === 'Button') btn2 = n; n.children.forEach(w); }; w(c2.snapshot); }
    return { ok: true, before, after, snapColor: btn2?.style?.backgroundColor };
  });
  expect(res.ok).toBe(true);
  expect(res.after).not.toBe(res.before);   // canvas actually repainted
  expect(res.after).toContain('255,0,0');    // red at the sampled pixel
  expect(res.snapColor).toBe('#ff0000');     // snapshot reflects the override
});
```
> The demo canvas uses `getContext('2d')`, so `getImageData` reads real painted pixels. If the sampled pixel is still not red (e.g. corner radius clips it), move the sample toward the button's inner area until stable — the assertion is that the button's fill became red.

- [ ] **Step 2: Run**

Run: `pnpm test:e2e`
Expected: all prior e2e tests + this one pass. Adjust the sample point per the note if flaky.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/test/integration/agent-browser.spec.ts
git commit -m "test(devtools): e2e — set-style repaints canvas + updates snapshot"
```

---

## Task 10: Docs + final verification

**Files:**
- Modify: `devtools-extension/README.md`
- Modify: `docs/superpowers/specs/2026-07-05-dt4a-live-style-editing-design.md`

- [ ] **Step 1: Full sweep**

Run: `pnpm test`
Expected: all green.
Run: `pnpm typecheck`
Expected: clean.
Run: `pnpm test:e2e`
Expected: green.

- [ ] **Step 2: Update the extension README checklist**

In `devtools-extension/README.md` add under the manual checklist:
```markdown
- [ ] Panel matches the dark mockup (toolbar, Elements/Performance tabs, Styles/Computed/Signals).
- [ ] Selecting a node shows its Styles; editing a value (e.g. backgroundColor) repaints the canvas.
- [ ] The checkbox toggles a property off/on on the live canvas.
- [ ] "+ add property" adds a style that appears on the canvas.
- [ ] Signals tab lists signals seen in recent commits; Performance shows frame durations + stats.
```

- [ ] **Step 3: Mark the spec implemented**

Change the spec status line to `**Статус:** реализовано (DT4a)`.

- [ ] **Step 4: Commit**

```bash
git add devtools-extension/README.md docs/superpowers/specs/2026-07-05-dt4a-live-style-editing-design.md
git commit -m "docs(devtools): DT4a checklist + mark spec implemented"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** id resolution (T1), override seam (T2), primitive merge (T3), parser (T4), commands+agent (T5), panel shell (T6), live tree+Styles+Computed (T7), Signals/Perf on D3 data (T8), e2e (T9), docs (T10). ScrollView merge is a conditional sub-step in T3 (verify identity, else defer).
- **Type consistency:** `StyleOverride`, `applyStyleOverride`/`readStyleOverride`/`setStyleProp`/`toggleStyleProp`/`removeStyleProp`/`clearStyleOverride`/`activateStyleOverrides` defined in T2, used identically in T3/T5. `parseStyleValue`→`ParseResult` (T4) consumed in T5. `instanceById` (T1) exported (T5), used in agent (T5). New `PanelCommand` variants (T5) consumed by the panel (T7). `SnapshotNode.style`/`CommitMeta.signals`/`durationMs` are existing D3 fields the panel reads (T7/T8).
- **Prod cost:** override read is a single `if (!active) return` in prod (never subscribes); parser/commands only run under an installed agent; panel is the extension.
- **XSS:** panel uses `textContent`/DOM builders for ALL data — no `innerHTML` anywhere (perfStats built via `statEl`).
- **Adaptation points flagged:** ScrollView identity (T3), pixel sample point stability (T9), reuse of the existing panel port wiring (T7).
```
