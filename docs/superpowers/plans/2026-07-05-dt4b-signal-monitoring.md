# DT4b — Signal Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the DevTools Signals tab show a live registry of all signals (name, value, observer count) and let the user edit a scalar signal's value from the panel, applying it to the running app and highlighting the nodes that changed.

**Architecture:** A `devWriteSignal` in `@cairn/reactivity` exposes the internal writer. A `SignalRegistry` in `@cairn/devtools` records every signal via `onSignalCreate` (keyed by a shared `signalId`). The agent takes over ownership of the single `setReactiveDevHooks` slot with one composite hook that feeds both the existing `WhyFrameTracker` counters and the registry. New `set-signal`/`get-signals` commands + a `signals` event carry the registry to the panel; editing round-trips through `devWriteSignal` → effects → commit → existing `changed`-node highlight.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, esbuild (extension), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-05-dt4b-signal-monitoring-design.md`

---

## File Structure

**Core:**
- `packages/reactivity/src/core.ts` + `index.ts` — `devWriteSignal(node, value)`.

**`@cairn/devtools`:**
- `signal-id.ts` (new) — shared `signalId(node)` + `resetSignalIds()`.
- `signal-value.ts` (new) — `serializeSignalValue`, `coerceSignalValue`.
- `signal-registry.ts` (new) — `SignalRegistry` (`note`/`list`/`resolve`).
- `why-frame.ts` — drop self-owned `setReactiveDevHooks`; expose `noteWrite`/`noteEffectRun`; use shared `signalId`.
- `protocol.ts` — `SignalInfo`, `signals` event, `set-signal`/`get-signals` commands.
- `agent.ts` — composite reactive hook (why-frame + registry); `set-signal`/`get-signals`; push `signals` on commit/subscribe.

**Extension:** `src/panel/panel.ts` — Signals tab on the registry with scalar editing; `README.md` checklist.

**Tests:** unit per new module + Playwright e2e.

---

## Task 1: `devWriteSignal` in reactivity

**Files:**
- Modify: `packages/reactivity/src/core.ts`, `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/dev-write-signal.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/dev-write-signal.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRoot, createSignal, createEffect } from '../src/index';
import { devWriteSignal } from '../src/core';
import { readSource } from '../src/core';

describe('devWriteSignal', () => {
  it('writes a signal node and triggers observers', () => {
    createRoot(() => {
      const [get] = createSignal(1);
      // grab the underlying node by reading through the accessor's closure is not possible;
      // instead build a node-facing test: createSignal exposes value via get(); devWriteSignal
      // operates on the SignalState. We reconstruct a node via a fresh signal and its effect.
      let seen = 0; let runs = 0;
      const [g, s] = createSignal(0);
      // capture the node: setter writes through writeSignal; to get the node for devWriteSignal,
      // use the fact that createSignal's node is what get()/set() close over — expose via a probe:
      createEffect(() => { seen = g(); runs++; });
      expect(runs).toBe(1);
      s(5); // normal setter path
      expect(seen).toBe(5);
      void get;
    });
  });
});
```
> Note: `devWriteSignal` takes a `SignalState` node, but `createSignal` returns accessor/setter, not the node. To test `devWriteSignal` directly, construct a `SignalState` literal (that's what the devtools registry stores — the node captured in `onSignalCreate`). Replace the test body with the node-facing form:
```ts
import { describe, it, expect } from 'vitest';
import { createRoot, createEffect } from '../src/index';
import { devWriteSignal, readSource, type SignalState } from '../src/core';

describe('devWriteSignal', () => {
  it('writes a signal node and triggers observers', () => {
    const node: SignalState<number> = { value: 1, observers: null, equals: (a, b) => a === b };
    let seen = -1; let runs = 0;
    createRoot(() => {
      createEffect(() => { seen = readSource(node); runs++; });
    });
    expect(runs).toBe(1);
    expect(seen).toBe(1);
    devWriteSignal(node, 42);
    expect(seen).toBe(42);
    expect(runs).toBe(2);
  });
});
```
Use this second form as the actual test.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/reactivity/test/dev-write-signal.test.ts`
Expected: FAIL (`devWriteSignal` not exported).

- [ ] **Step 3: Implement**

In `packages/reactivity/src/core.ts`, after `writeSignal` (around line 90), add:
```ts
/** Dev-only: write a raw SignalState (used by @cairn/devtools to set a signal's value). */
export function devWriteSignal(node: SignalState<unknown>, value: unknown): void {
  writeSignal(node, value);
}
```

- [ ] **Step 4: Export from index**

In `packages/reactivity/src/index.ts`, add:
```ts
export { devWriteSignal } from './core';
export type { SignalState } from './core';
```

- [ ] **Step 5: Run + verify**

Run: `pnpm test -- packages/reactivity/test/dev-write-signal.test.ts`
Expected: PASS.
Run: `pnpm test -- packages/reactivity`
Expected: existing reactivity tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/reactivity/src/core.ts packages/reactivity/src/index.ts packages/reactivity/test/dev-write-signal.test.ts
git commit -m "feat(reactivity): devWriteSignal to set a raw signal node (for devtools)"
```

---

## Task 2: Signal value serialize + coerce

**Files:**
- Create: `packages/devtools/src/signal-value.ts`
- Test: `packages/devtools/test/signal-value.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/signal-value.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { serializeSignalValue, coerceSignalValue } from '../src/signal-value';

describe('serializeSignalValue', () => {
  it('tags scalars by type', () => {
    expect(serializeSignalValue(5)).toEqual({ value: '5', type: 'number' });
    expect(serializeSignalValue('hi')).toEqual({ value: 'hi', type: 'string' });
    expect(serializeSignalValue(true)).toEqual({ value: 'true', type: 'boolean' });
  });
  it('serializes objects/functions as other', () => {
    expect(serializeSignalValue({ a: 1 })).toEqual({ value: '{"a":1}', type: 'other' });
    const fn = serializeSignalValue(() => {});
    expect(fn.type).toBe('other');
    expect(typeof fn.value).toBe('string');
  });
});

describe('coerceSignalValue', () => {
  it('coerces by the current value type', () => {
    expect(coerceSignalValue(0, '42')).toEqual({ ok: true, value: 42 });
    expect(coerceSignalValue('x', 'hello')).toEqual({ ok: true, value: 'hello' });
    expect(coerceSignalValue(true, 'false')).toEqual({ ok: true, value: false });
    expect(coerceSignalValue('x', '"quoted"')).toEqual({ ok: true, value: 'quoted' });
  });
  it('rejects bad numbers and non-scalars', () => {
    expect(coerceSignalValue(0, 'abc').ok).toBe(false);
    expect(coerceSignalValue({ a: 1 }, '{}').ok).toBe(false);
    expect(coerceSignalValue(undefined, 'x').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/signal-value.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/devtools/src/signal-value.ts`:
```ts
export type SignalValueType = 'number' | 'string' | 'boolean' | 'other';

export function serializeSignalValue(v: unknown): { value: string; type: SignalValueType } {
  const t = typeof v;
  if (t === 'number') return { value: String(v), type: 'number' };
  if (t === 'boolean') return { value: String(v), type: 'boolean' };
  if (t === 'string') return { value: v as string, type: 'string' };
  if (t === 'function') return { value: '[fn]', type: 'other' };
  try { return { value: JSON.stringify(v) ?? String(v), type: 'other' }; }
  catch { return { value: String(v), type: 'other' }; }
}

export type CoerceResult = { ok: true; value: unknown } | { ok: false };

export function coerceSignalValue(current: unknown, raw: string): CoerceResult {
  const t = typeof current;
  if (t === 'number') { const n = parseFloat(raw); return Number.isNaN(n) ? { ok: false } : { ok: true, value: n }; }
  if (t === 'boolean') return { ok: true, value: /^true$/i.test(raw.trim()) };
  if (t === 'string') return { ok: true, value: raw.replace(/^"([\s\S]*)"$/, '$1') };
  return { ok: false }; // objects / undefined / functions — not editable
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- packages/devtools/test/signal-value.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/signal-value.ts packages/devtools/test/signal-value.test.ts
git commit -m "feat(devtools): signal value serialize + scalar coerce"
```

---

## Task 3: Shared signalId + SignalRegistry

**Files:**
- Create: `packages/devtools/src/signal-id.ts`
- Create: `packages/devtools/src/signal-registry.ts`
- Test: `packages/devtools/test/signal-registry.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/signal-registry.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { signalId, resetSignalIds } from '../src/signal-id';
import { SignalRegistry } from '../src/signal-registry';

// A SignalState-shaped fake (value, observers, name?)
function sig(value: unknown, name?: string, observers: any[] | null = null): any {
  return { value, observers, equals: (a: any, b: any) => a === b, name };
}

describe('signalId', () => {
  beforeEach(() => resetSignalIds());
  it('is stable per node and unique across nodes', () => {
    const a = sig(1), b = sig(2);
    expect(signalId(a)).toBe(signalId(a));
    expect(signalId(a)).not.toBe(signalId(b));
  });
});

describe('SignalRegistry', () => {
  beforeEach(() => resetSignalIds());
  it('lists registered live signals with name/value/type/observers', () => {
    const reg = new SignalRegistry();
    const count = sig(3, 'count', [{ isEffect: true }, { isEffect: false }, { isEffect: true }]);
    reg.note(count);
    reg.note(sig('hi'));
    const list = reg.list();
    expect(list.length).toBe(2);
    const c = list.find((s) => s.name === 'count')!;
    expect(c).toBeTruthy();
    expect(c.value).toBe('3');
    expect(c.type).toBe('number');
    expect(c.observers).toBe(2); // only isEffect observers counted
  });
  it('resolve returns the node for its id', () => {
    const reg = new SignalRegistry();
    const n = sig(1, 'x');
    reg.note(n);
    const id = signalId(n);
    expect(reg.resolve(id)).toBe(n);
    expect(reg.resolve(999999)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/signal-registry.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `signal-id.ts`**

`packages/devtools/src/signal-id.ts`:
```ts
// Shared signal identity — used by both the WhyFrameTracker changed-set and the SignalRegistry
// so a signal has ONE id everywhere.
const ids = new WeakMap<object, number>();
let next = 1;

export function signalId(node: object): number {
  let id = ids.get(node);
  if (id === undefined) { id = next++; ids.set(node, id); }
  return id;
}

/** Test-only: reset the counter (WeakMap keyed by identity persists per object). */
export function resetSignalIds(): void { next = 1; }
```

- [ ] **Step 4: Implement `signal-registry.ts`**

`packages/devtools/src/signal-registry.ts`:
```ts
import type { SignalInfo } from './protocol';
import { signalId } from './signal-id';
import { serializeSignalValue } from './signal-value';

interface SignalNode { value: unknown; observers: { isEffect?: boolean }[] | null; name?: string }

export class SignalRegistry {
  private map = new Map<number, WeakRef<SignalNode>>();

  note(node: SignalNode): void {
    this.map.set(signalId(node), new WeakRef(node));
  }

  resolve(id: number): SignalNode | undefined {
    const node = this.map.get(id)?.deref();
    if (!node) this.map.delete(id);
    return node;
  }

  list(): SignalInfo[] {
    const out: SignalInfo[] = [];
    for (const [id, ref] of this.map) {
      const node = ref.deref();
      if (!node) { this.map.delete(id); continue; }
      const { value, type } = serializeSignalValue(node.value);
      const observers = (node.observers ?? []).filter((c) => c.isEffect).length;
      out.push({ id, name: node.name, value, type, observers });
    }
    return out;
  }
}
```

- [ ] **Step 5: Add the `SignalInfo` type to protocol.ts (needed for the import to compile)**

In `packages/devtools/src/protocol.ts`, add (near `SignalRef`):
```ts
export interface SignalInfo { id: number; name?: string; value: string; type: 'number' | 'string' | 'boolean' | 'other'; observers: number }
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm test -- packages/devtools/test/signal-registry.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/devtools/src/signal-id.ts packages/devtools/src/signal-registry.ts packages/devtools/src/protocol.ts packages/devtools/test/signal-registry.test.ts
git commit -m "feat(devtools): shared signalId + SignalRegistry (list/resolve live signals)"
```

---

## Task 4: Refactor WhyFrameTracker + agent composite reactive hook

**Files:**
- Modify: `packages/devtools/src/why-frame.ts`
- Modify: `packages/devtools/src/agent.ts`
- Modify: `packages/devtools/test/why-frame.test.ts`
- Test: `packages/devtools/test/agent.test.ts` (extend — registry populated after mount)

- [ ] **Step 1: Rewrite `why-frame.ts` to stop owning the hook slot**

Replace `packages/devtools/src/why-frame.ts` with:
```ts
import type { SignalRef } from './protocol';
import { signalId } from './signal-id';

interface SignalNode { name?: string }

/** Accumulates per-frame reactive activity. The agent owns setReactiveDevHooks and calls
 *  noteWrite/noteEffectRun; take() drains the frame. */
export class WhyFrameTracker {
  private signalWrites = 0;
  private effectRuns = 0;
  private changed = new Map<number, SignalRef>();

  noteWrite(node: object): void {
    this.signalWrites++;
    const id = signalId(node);
    if (!this.changed.has(id)) this.changed.set(id, { id, name: (node as SignalNode).name });
  }

  noteEffectRun(node: object): void {
    if ((node as { isEffect?: boolean }).isEffect) this.effectRuns++;
  }

  take(): { signalWrites: number; effectRuns: number; signals: SignalRef[] } {
    const result = {
      signalWrites: this.signalWrites,
      effectRuns: this.effectRuns,
      signals: [...this.changed.values()],
    };
    this.signalWrites = 0;
    this.effectRuns = 0;
    this.changed.clear();
    return result;
  }
}
```

- [ ] **Step 2: Rewrite `why-frame.test.ts` to drive the tracker directly**

Replace `packages/devtools/test/why-frame.test.ts` with a unit test of the tracker methods (no `setReactiveDevHooks`):
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { WhyFrameTracker } from '../src/why-frame';
import { resetSignalIds, signalId } from '../src/signal-id';

function node(name?: string, isEffect = false): any { return { name, isEffect }; }

describe('WhyFrameTracker', () => {
  beforeEach(() => resetSignalIds());

  it('counts writes/effect-runs and dedups changed signals by id', () => {
    const t = new WhyFrameTracker();
    const a = node('a'); const b = node();
    t.noteWrite(a); t.noteWrite(a); t.noteWrite(b); // a twice -> one entry
    t.noteEffectRun(node(undefined, true));
    t.noteEffectRun(node(undefined, false)); // not an effect
    const r = t.take();
    expect(r.signalWrites).toBe(3);
    expect(r.effectRuns).toBe(1);
    expect(r.signals.length).toBe(2);
    expect(r.signals.find((s) => s.name === 'a')?.id).toBe(signalId(a));
  });

  it('take() resets state', () => {
    const t = new WhyFrameTracker();
    t.noteWrite(node('x'));
    t.take();
    expect(t.take()).toEqual({ signalWrites: 0, effectRuns: 0, signals: [] });
  });
});
```

- [ ] **Step 3: Wire the composite reactive hook in the agent**

In `packages/devtools/src/agent.ts`:
- Add imports:
```ts
import { setReactiveDevHooks } from '@cairn/reactivity';
import { SignalRegistry } from './signal-registry';
import { signalId } from './signal-id';
```
- Add `registry: SignalRegistry` to the `AgentState` interface and initialize it in `installDevtools` (`registry: new SignalRegistry()`).
- Replace `why.start();` (which no longer exists) with the composite hook install (place it where `why.start()` was):
```ts
  setReactiveDevHooks({
    onSignalCreate: (n) => { signalId(n as object); s.registry.note(n as any); },
    onSignalWrite: (n) => why.noteWrite(n as object),
    onComputationRun: (n) => why.noteEffectRun(n as object),
  });
```
- In `uninstallDevtools`, replace `state.why.stop();` with `setReactiveDevHooks(null);`.

- [ ] **Step 4: Extend the agent test — registry sees signals after mount**

Add to `packages/devtools/test/agent.test.ts` (the `appRoot()` fake has no signals, so create one in a root to exercise the create hook):
```ts
  it('composite hook registers created signals and still counts why-frame activity', () => {
    installDevtools();
    // create a signal AFTER install so onSignalCreate fires
    // (import createSignal/createRoot at top of the test file if not present)
    let list: any[] = [];
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    createRoot(() => {
      const [, setC] = createSignal(0, { name: 'probe' });
      setC(1);
    });
    // registry is internal; assert via get-signals once Task 5 lands. For now assert install didn't throw
    // and reactive counters still flow by mounting an app.
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);
    expect(events.some((e) => e.type === 'commit')).toBe(true);
    void list;
    dispose();
  });
```
> Ensure the test file imports `createRoot, createSignal` from `@cairn/reactivity` (extend the existing import). This is a smoke guard; the real registry assertion is the `get-signals` test in Task 5.

- [ ] **Step 5: Run + verify no regression**

Run: `pnpm test -- packages/devtools packages/reactivity`
Expected: all pass (why-frame refactor keeps counters; commit meta still carries signals — the composite hook feeds `why` the same way).
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/why-frame.ts packages/devtools/src/agent.ts packages/devtools/test/why-frame.test.ts packages/devtools/test/agent.test.ts
git commit -m "refactor(devtools): agent owns composite reactive hook; registry fed by onSignalCreate"
```

---

## Task 5: Protocol `signals`/`set-signal`/`get-signals` + agent handling

**Files:**
- Modify: `packages/devtools/src/protocol.ts`
- Modify: `packages/devtools/src/agent.ts`
- Test: `packages/devtools/test/agent.test.ts` (extend)

- [ ] **Step 1: Add protocol event + commands**

In `packages/devtools/src/protocol.ts`:
- Add to `AgentEvent`:
```ts
  | { type: 'signals'; list: SignalInfo[] }
```
- Add to `PanelCommand`:
```ts
  | { type: 'set-signal'; id: number; value: string }
  | { type: 'get-signals' }
```

- [ ] **Step 2: Write the failing test**

Add to `packages/devtools/test/agent.test.ts`:
```ts
  it('get-signals emits the registry list; set-signal updates a scalar', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));

    let getC!: () => number;
    createRoot(() => {
      const [c, setC] = createSignal(0, { name: 'count' });
      getC = c;
      void setC;
    });

    hook.send({ type: 'get-signals' });
    const sig = [...events].reverse().find((e) => e.type === 'signals');
    expect(sig && sig.type === 'signals').toBe(true);
    const entry = sig && sig.type === 'signals' ? sig.list.find((x) => x.name === 'count') : undefined;
    expect(entry).toBeTruthy();
    expect(entry!.value).toBe('0');

    hook.send({ type: 'set-signal', id: entry!.id, value: '7' });
    expect(getC()).toBe(7); // the real signal was written
  });
```
> Ensure `createRoot, createSignal` are imported from `@cairn/reactivity` in the test file.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/agent.test.ts`
Expected: FAIL (agent doesn't handle `get-signals`/`set-signal`).

- [ ] **Step 4: Handle the commands + emit signals**

In `packages/devtools/src/agent.ts`:
- Add imports:
```ts
import { devWriteSignal } from '@cairn/reactivity';
import { coerceSignalValue } from './signal-value';
```
- Add a helper near `emit`:
```ts
function emitSignals(): void {
  if (!state || state.subscribers.size === 0) return;
  emit({ type: 'signals', list: state.registry.list() });
}
```
- In `handleCommand`'s switch, add:
```ts
    case 'get-signals': emitSignals(); break;
    case 'set-signal': {
      const node = state.registry.resolve(cmd.id);
      if (node) { const r = coerceSignalValue(node.value, cmd.value); if (r.ok) devWriteSignal(node as any, r.value); }
      break;
    }
```
- In the `onCommit` handler, right after the existing `emit({ type: 'commit', ... })`, add `emitSignals();` so the list stays fresh (values update after each frame).
- In `subscribe`, the panel will request `get-signals` after `hello` (panel change is Task 6) — no agent change needed there, but it's fine to also `emitSignals()` is NOT added on subscribe (lazy; the panel asks).

- [ ] **Step 5: Run + typecheck**

Run: `pnpm test -- packages/devtools`
Expected: all pass.
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/protocol.ts packages/devtools/src/agent.ts packages/devtools/test/agent.test.ts
git commit -m "feat(devtools): signals event + set-signal/get-signals commands"
```

---

## Task 6: Panel Signals tab on the registry (live editing)

**Files:**
- Modify: `devtools-extension/src/panel/panel.ts`

XSS rule: `textContent`/DOM builders only.

- [ ] **Step 1: Track the signals list + request it**

In `panel.ts`, add state and handle the `signals` event:
```ts
let signals: import('@cairn/devtools').SignalInfo[] = [];
```
In `handleEvent`, extend:
- on `hello`: after `send({ type: 'get-snapshot' })` also `send({ type: 'get-signals' })`.
- add a branch:
```ts
  } else if (e.type === 'signals') {
    signals = e.list;
    renderSignals();
  }
```
(Keep the existing `commit` branch calling `renderSpark()`; `renderSignals` no longer derives from commitLog.)

- [ ] **Step 2: Rewrite `renderSignals` to use the registry list with scalar editing**

Replace the `renderSignals` implementation:
```ts
function renderSignals(): void {
  const sigN = document.getElementById('sigN');
  if (sigN) sigN.textContent = `(${signals.length})`;
  sigList.replaceChildren();
  if (signals.length === 0) {
    const e = document.createElement('div'); e.className = 'sig'; e.style.color = 'var(--ink-faint)';
    e.textContent = 'No signals yet — interact with the app.'; sigList.appendChild(e); return;
  }
  for (const s of signals) {
    const row = document.createElement('div'); row.className = 'sig';
    const dot = document.createElement('span'); dot.className = 'dot';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.name ?? `#${s.id}`;
    const eq = document.createElement('span'); eq.className = 'eq'; eq.textContent = '=';
    const vv = document.createElement('span'); vv.className = 'vv'; vv.textContent = s.type === 'string' ? `"${s.value}"` : s.value;
    if (s.type !== 'other') {
      vv.contentEditable = 'true';
      vv.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); (vv as HTMLElement).blur(); } };
      vv.onblur = () => send({ type: 'set-signal', id: s.id, value: vv.textContent || '' });
    }
    const drives = document.createElement('span'); drives.className = 'drives';
    drives.textContent = `${s.observers} eff`;
    row.append(dot, nm, eq, vv, drives);
    sigList.appendChild(row);
  }
}
```

- [ ] **Step 3: Build**

Run: `cd devtools-extension && pnpm build`
Expected: builds clean. `grep -n "innerHTML" devtools-extension/src/panel/panel.ts` → no matches.

- [ ] **Step 4: Commit**

```bash
git add devtools-extension/src/panel/panel.ts
git commit -m "feat(extension): Signals tab lists live registry with scalar editing"
```

---

## Task 7: e2e + docs

**Files:**
- Modify: `packages/devtools/test/integration/agent-browser.spec.ts`
- Modify: `devtools-extension/README.md`
- Modify: `docs/superpowers/specs/2026-07-05-dt4b-signal-monitoring-design.md`

- [ ] **Step 1: Add the e2e test**

Append to `packages/devtools/test/integration/agent-browser.spec.ts`:
```ts
test('get-signals lists the named count signal; set-signal updates the app', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async () => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: any[] = []; hook.subscribe((e: any) => events.push(e));
    hook.send({ type: 'get-signals' });
    const sig = [...events].reverse().find((e) => e.type === 'signals');
    const count = sig?.list?.find((s: any) => s.name === 'count');
    if (!count) return { ok: false };
    const before = count.value;
    hook.send({ type: 'set-signal', id: count.id, value: '9' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // read the snapshot: the "count: N" Text node should now reflect 9
    const ev2: any[] = []; hook.subscribe((e: any) => ev2.push(e)); hook.send({ type: 'get-signals' });
    const sig2 = [...ev2].reverse().find((e) => e.type === 'signals');
    const count2 = sig2?.list?.find((s: any) => s.name === 'count');
    return { ok: true, before, after: count2?.value };
  });
  expect(res.ok).toBe(true);
  expect(res.before).toBe('0');
  expect(res.after).toBe('9');
});
```

- [ ] **Step 2: Run e2e**

Run: `pnpm test:e2e`
Expected: all prior e2e + this one pass.

- [ ] **Step 3: README checklist + spec status**

In `devtools-extension/README.md` add under the checklist:
```markdown
- [ ] Signals tab lists all signals with current values (named ones by name, others as #id).
- [ ] Editing a scalar signal's value updates the app and highlights changed nodes in the tree.
- [ ] Object/other signals are shown read-only.
```
Change the spec status line to `**Статус:** реализовано (DT4b)`.

- [ ] **Step 4: Full sweep + commit**

Run: `pnpm test` (all green), `pnpm typecheck` (clean), `pnpm test:e2e` (green).
```bash
git add packages/devtools/test/integration/agent-browser.spec.ts devtools-extension/README.md docs/superpowers/specs/2026-07-05-dt4b-signal-monitoring-design.md
git commit -m "test(devtools): e2e set-signal updates app; docs DT4b checklist + spec status"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** devWriteSignal (T1), serialize/coerce (T2), signalId+registry (T3), why-frame refactor + composite hook (T4), protocol signals/set-signal/get-signals + agent (T5), panel Signals live (T6), e2e+docs (T7).
- **Type consistency:** `SignalInfo` defined in protocol (T3) and consumed by registry (T3), agent (T5), panel (T6). `signalId`/`resetSignalIds` (T3) used by why-frame (T4) and registry (T3). `serializeSignalValue`/`coerceSignalValue` (T2) used by registry (T3) and agent (T5). `devWriteSignal` (T1) used by agent (T5). `SignalRef` (existing D3) still used by why-frame changed-set.
- **Refactor safety:** the agent now owns `setReactiveDevHooks`; why-frame keeps identical counting/dedup via `noteWrite`/`noteEffectRun`; the composite hook feeds the same data so `CommitMeta.signals`/counts are unchanged (D3 behavior preserved). `uninstallDevtools` clears the hook slot.
- **Prod cost:** unchanged — reactive hooks are null until install; registry only grows under an active agent.
- **XSS:** panel Signals uses `textContent` only.
- **Adaptation points:** ensure test files import `createRoot`/`createSignal` where the new tests use them (T4, T5); the `agent.test.ts` `appRoot()` fake has no signals, so signal tests create their own in a `createRoot`.
```
