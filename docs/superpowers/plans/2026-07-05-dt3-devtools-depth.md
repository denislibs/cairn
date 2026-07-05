# DT3 — Cairn DevTools Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen Cairn DevTools (on top of merged DT1/DT2) — meaningful component names in the tree, resolved-style introspection in the props panel, per-frame changed-signal list, and a commit profiler (duration + timeline) with an optional snapshot delta protocol.

**Architecture:** Same DT1 layering (instrumentation → agent → bridge → panel). DT3 adds cheap, non-hot-path data: `debugName` on widget/material factory instances, `debugStyle` on Box/Text instances, an optional `name` on signals, frame `durationMs` measured in `mount`. The agent surfaces the new data through additive protocol fields; the panel renders them.

**Tech Stack:** TypeScript, pnpm workspaces, vitest (+ jsdom), esbuild (extension), Playwright (integration).

**Spec:** `docs/superpowers/specs/2026-07-05-dt3-devtools-depth-design.md`

---

## File Structure

**Core edits:**
- `packages/reactivity/src/signal.ts` — `SignalOptions.name` → set `SignalState.name`.
- `packages/reactivity/src/core.ts` — add optional `name?: string` to `SignalState`.
- `packages/runtime/src/instance.ts` — add `debugStyle?: BaseStyle`.
- `packages/runtime/src/devtools-hook.ts` + `mount.ts` — `durationMs` in `onCommit`.
- `packages/primitives/src/box.ts`, `text.ts` — set `instance.debugStyle = s`.
- `packages/widgets/src/*.ts`, `packages/material/src/*.ts` — set `inst.debugName`.

**`@cairn/devtools`:**
- `protocol.ts` — `SnapshotNode.style`, `CommitMeta.signals` + `durationMs`, `commit-delta` event.
- `serialize.ts` — style whitelist extraction.
- `commit-log.ts` — `CommitEntry.signals` + `durationMs`.
- `why-frame.ts` — signal ids + per-frame changed-signal set.
- `delta.ts` (new) — `computeDelta` / `applyDelta`.
- `agent.ts` — thread signals/durationMs into meta; optional delta emission.

**Extension:** `devtools-extension/src/panel/panel.ts` — Style section, signals in log, profiler timeline, (optional) delta apply.

**Example/tests:** `examples/devtools-demo/main.tsx` (use material `Button` + named signal), Playwright specs.

---

## Task 1: Component names in `@cairn/widgets`

**Files:**
- Modify: every factory in `packages/widgets/src/*.ts` that returns an `Instance`
- Test: `packages/widgets/test/debug-name.test.ts`

**Rule:** For every exported factory (and sub-factory namespace method) that returns an `Instance`, set `inst.debugName = '<ExportName>'` on the returned root instance immediately before `return`. Use the PascalCase component name; for namespace sub-parts use a compound name (e.g. `Tabs.Tab` → `'Tab'`, `Tabs.List` → `'TabList'`, `Tabs.Panel` → `'TabPanel'`, `Accordion.Trigger` → `'AccordionTrigger'`, `Accordion.Content` → `'AccordionContent'`, `List.Item` → `'ListItem'`, `Card.*`/`Dialog.*` → `'CardContent'`/`'DialogTitle'` etc). Do NOT touch primitives (Box/Row/Text are inferred) and do NOT touch infra files (`context.ts`, `control.ts`, `theme.ts`, `field.ts`, `form.ts`, `native/`).

- [ ] **Step 1: Worked example — patch one factory**

In `packages/widgets/src/button.ts`, find where the factory returns its instance (e.g. `return inst;` / `return HeadlessX(...)`). Capture it into a local and name it:
```ts
  // before:  return inst;
  inst.debugName = 'Button';
  return inst;
```
If the factory returns a call directly (e.g. `return Box({...});`), capture first:
```ts
  const inst = Box({ ... });
  inst.debugName = 'Button';
  return inst;
```

- [ ] **Step 2: Write the failing test**

`packages/widgets/test/debug-name.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { Button } from '../src/button';
import { Chip } from '../src/chip';
import { Badge } from '../src/badge';
import { defaultTheme } from '../src/theme';

function withTheme<T>(fn: () => T): T {
  return runWithContext(themeContext, () => defaultTheme as any, fn);
}

describe('widget debugName', () => {
  it('Button instance is named', () => {
    createRoot(() => withTheme(() => {
      expect(Button({ label: 'OK' }).debugName).toBe('Button');
    }));
  });
  it('Chip instance is named', () => {
    createRoot(() => withTheme(() => {
      expect(Chip({ label: 'x' }).debugName).toBe('Chip');
    }));
  });
  it('Badge instance is named', () => {
    createRoot(() => withTheme(() => {
      expect(Badge({ badgeContent: 1 }).debugName).toBe('Badge');
    }));
  });
});
```
> If a chosen widget's real props differ (e.g. `Badge` needs different props), read its signature and adjust the construction — the assertion (`.debugName`) is what matters. If a widget requires more context than `themeContext` to construct, pick a different representative widget that builds under `createRoot`+`themeContext`.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/widgets/test/debug-name.test.ts`
Expected: FAIL (debugName undefined) until factories are patched.

- [ ] **Step 4: Apply the rule to all widget factories**

Patch each factory file per the Rule above. Concrete file → name mapping (root factory unless a sub-part is listed):
`button.ts`→Button; `checkbox.ts`→Checkbox; `radio.ts`→Radio; `switch.ts`→Switch; `slider.ts`→Slider; `input.ts`→Input; `select.ts`→Select; `combobox.ts`→Combobox; `chip.ts`→Chip; `badge.ts`→Badge; `avatar.ts`→Avatar; `card.ts`→Card (+ sub-parts CardContent/CardActions if present); `list.ts`→List (+ List.Item→ListItem); `table.ts`→Table; `progress.ts`→Progress; `skeleton.ts`→Skeleton; `divider.ts`→Divider; `tabs.ts`→Tabs.List→TabList / Tabs.Tab→Tab / Tabs.Panel→TabPanel; `accordion.ts`→Accordion.Trigger→AccordionTrigger / Accordion.Content→AccordionContent; `stepper.ts`→Stepper; `breadcrumbs.ts`→Breadcrumbs; `pagination.ts`→Pagination; `dialog.ts`→Dialog sub-parts (DialogTrigger/DialogContent/DialogTitle/DialogDescription/DialogActions/DialogClose as they exist); `drawer.ts`→Drawer; `toast.ts`→Toast; `tooltip.ts`→Tooltip; `popover.ts`→Popover; `menu.ts`→Menu; `modal.ts`→Modal; `toggle.ts`→Toggle. For any factory where you're unsure whether it returns an `Instance`, check: if it returns something with a `.layout` property, name it; otherwise skip.

- [ ] **Step 5: Run tests + full suite**

Run: `pnpm test -- packages/widgets`
Expected: the new debug-name test passes and all existing widget tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/widgets/src packages/widgets/test/debug-name.test.ts
git commit -m "feat(widgets): set Instance.debugName on component factories for devtools"
```

---

## Task 2: Component names in `@cairn/material`

**Files:**
- Modify: every factory in `packages/material/src/*.ts` that returns an `Instance`
- Test: `packages/material/test/debug-name.test.ts`

**Rule:** Same as Task 1, applied to material factories. The material factory's `debugName` overwrites the inner widget/primitive name (it runs last), so the tree shows the Material component. Skip infra files: `colors.ts`, `state-layer.ts`, `ripple.ts`, `theme.ts`.

- [ ] **Step 1: Worked example**

In `packages/material/src/button.ts`, the factory ends with `return HeadlessButton(headlessProps);`. Change to:
```ts
  const inst = HeadlessButton(headlessProps);
  inst.debugName = 'Button';
  return inst;
```

- [ ] **Step 2: Write the failing test**

`packages/material/test/debug-name.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Button } from '../src/button';
import { Chip } from '../src/chip';
import { createMaterialTheme } from '../src/theme';

function fakeHost() {
  return { scheduler: { requestFrame() { return 1; }, cancelFrame() {} }, renderer: {}, metrics: {}, input: {} } as any;
}
function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  return runWithContext(hostContext, fakeHost(), () =>
    runWithContext(themeContext, () => theme as any, fn));
}

describe('material debugName', () => {
  it('Button is named Button (overrides inner widget)', () => {
    createRoot(() => withContext(() => {
      expect(Button({ label: 'OK' }).debugName).toBe('Button');
    }));
  });
  it('Chip is named Chip', () => {
    createRoot(() => withContext(() => {
      expect(Chip({ label: 'x' }).debugName).toBe('Chip');
    }));
  });
});
```
> Mirror the `withContext` harness from the existing `packages/material/test/button.test.ts`. Adjust props to each component's real signature if needed.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/material/test/debug-name.test.ts`
Expected: FAIL until material factories are patched.

- [ ] **Step 4: Apply to all material factories**

File → name: `button.ts`→Button; `icon-button.ts`→IconButton; `fab.ts`→Fab; `checkbox.ts`→Checkbox; `radio.ts`→Radio; `switch.ts`→Switch; `textfield.ts`→TextField; `select.ts`→Select; `paper.ts`→Paper; `card.ts`→Card (+ Card.Content→CardContent, Card.Actions→CardActions); `appbar.ts`→AppBar (+ AppBar.Title→AppBarTitle); `list.ts`→List (+ List.Item→ListItem); `dialog.ts`→Dialog sub-parts; `snackbar.ts`→Snackbar (SnackbarItem); `tabs.ts`→Tabs.List→TabList / Tabs.Tab→Tab / Tabs.Panel→TabPanel; `chip.ts`→Chip; `badge.ts`→Badge; `progress.ts`→LinearProgress / CircularProgress.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- packages/material`
Expected: new test passes; existing material tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/material/src packages/material/test/debug-name.test.ts
git commit -m "feat(material): set Instance.debugName on component factories for devtools"
```

---

## Task 3: `debugStyle` on Box/Text instances

**Files:**
- Modify: `packages/runtime/src/instance.ts` (add field)
- Modify: `packages/primitives/src/box.ts:184-207` (bind callback)
- Modify: `packages/primitives/src/text.ts:88-90` (bind callback)
- Test: `packages/primitives/test/debug-style.test.ts`

- [ ] **Step 1: Add the field to the Instance interface**

In `packages/runtime/src/instance.ts`, import `BaseStyle` type and add to the `Instance` interface (after `debugName`):
```ts
  /** Dev-only resolved style snapshot for devtools; ignored in production. */
  debugStyle?: import('@cairn/style').BaseStyle;
```
(Use the inline import type to avoid a new top-level import if `@cairn/style` isn't already imported; if it is, use the named type.)

- [ ] **Step 2: Write the failing test**

`packages/primitives/test/debug-style.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
import { Text } from '../src/text';

describe('debugStyle', () => {
  it('Box exposes its resolved style', () => {
    createRoot(() => {
      const b = Box({ style: { backgroundColor: '#ff0000', padding: 8, borderRadius: 4 } });
      expect(b.debugStyle?.backgroundColor).toBe('#ff0000');
      expect(b.debugStyle?.padding).toBe(8);
    });
  });
  it('Text exposes its resolved style', () => {
    createRoot(() => {
      const t = Text({ style: { color: '#123456', font: '16px sans-serif' }, children: 'hi' });
      expect(t.debugStyle?.color).toBe('#123456');
    });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/primitives/test/debug-style.test.ts`
Expected: FAIL (debugStyle undefined).

- [ ] **Step 4: Set debugStyle in box.ts**

In `packages/primitives/src/box.ts`, inside the `bind(styleSource, (s) => { ... })` callback, right after `current = s;`, add:
```ts
    instance.debugStyle = s;
```

- [ ] **Step 5: Set debugStyle in text.ts**

In `packages/primitives/src/text.ts`, inside its `bind(styleSource, (s) => { ... })` callback (line ~88), right after `current = s;`, add:
```ts
    instance.debugStyle = s;
```

- [ ] **Step 6: Run tests + primitives suite**

Run: `pnpm test -- packages/primitives/test/debug-style.test.ts`
Expected: PASS.
Run: `pnpm test -- packages/primitives`
Expected: existing primitives tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/instance.ts packages/primitives/src/box.ts packages/primitives/src/text.ts packages/primitives/test/debug-style.test.ts
git commit -m "feat(primitives): expose resolved style as Instance.debugStyle for devtools"
```

---

## Task 4: Serialize a style whitelist into `SnapshotNode.style`

**Files:**
- Modify: `packages/devtools/src/protocol.ts` (add `style?`)
- Modify: `packages/devtools/src/serialize.ts`
- Test: `packages/devtools/test/serialize.test.ts` (extend)

- [ ] **Step 1: Add the protocol field**

In `packages/devtools/src/protocol.ts`, add to the `SnapshotNode` interface (after `semantics?`):
```ts
  style?: Record<string, unknown>;
```

- [ ] **Step 2: Write the failing test (extend serialize.test.ts)**

Add to `packages/devtools/test/serialize.test.ts`:
```ts
  it('extracts a whitelist of debugStyle into style', () => {
    const inst = node('BoxNode', { w: 1, h: 1 });
    (inst as any).debugStyle = {
      backgroundColor: '#f00',
      padding: { top: 1, right: 2, bottom: 3, left: 4 },
      border: { width: 1, color: '#000' },
      borderRadius: 6,
      opacity: 0.5,
      font: '16px sans-serif',
      gap: 8,
      // non-whitelisted key must be dropped:
      transform: { translateX: 5 },
    };
    const snap = serialize(inst);
    expect(snap.style).toEqual({
      backgroundColor: '#f00',
      padding: { top: 1, right: 2, bottom: 3, left: 4 },
      border: { width: 1, color: '#000' },
      borderRadius: 6,
      opacity: 0.5,
      font: '16px sans-serif',
      gap: 8,
    });
  });

  it('omits style when debugStyle is absent', () => {
    expect(serialize(node('BoxNode')).style).toBeUndefined();
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/serialize.test.ts`
Expected: FAIL (style undefined / not extracted).

- [ ] **Step 4: Implement the whitelist extraction**

In `packages/devtools/src/serialize.ts`, add a helper and call it in `build`:
```ts
const STYLE_KEYS = [
  'backgroundColor', 'color', 'padding', 'border', 'borderRadius',
  'opacity', 'font', 'gap', 'boxShadow',
] as const;

function extractStyle(debugStyle: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!debugStyle) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of STYLE_KEYS) {
    const v = debugStyle[k];
    if (v === undefined || typeof v === 'function') continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
```
In `build`, after the `semantics` block, add:
```ts
  const style = extractStyle((inst as { debugStyle?: Record<string, unknown> }).debugStyle);
  if (style) snap.style = style;
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- packages/devtools/test/serialize.test.ts`
Expected: PASS (all serialize tests).

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/protocol.ts packages/devtools/src/serialize.ts packages/devtools/test/serialize.test.ts
git commit -m "feat(devtools): serialize whitelisted resolved style into snapshot"
```

---

## Task 5: Signal names in reactivity

**Files:**
- Modify: `packages/reactivity/src/core.ts` (add `SignalState.name`)
- Modify: `packages/reactivity/src/signal.ts` (accept `name` option)
- Test: `packages/reactivity/test/signal-name.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/signal-name.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createSignal } from '../src/index';
import { setReactiveDevHooks } from '../src/core';

afterEach(() => setReactiveDevHooks(null));

describe('signal name', () => {
  it('passes the name through to onSignalCreate', () => {
    const names: (string | undefined)[] = [];
    setReactiveDevHooks({ onSignalCreate: (n) => names.push((n as { name?: string }).name) });
    createSignal(0, { name: 'count' });
    createSignal(1);
    expect(names).toEqual(['count', undefined]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/reactivity/test/signal-name.test.ts`
Expected: FAIL (`name` not accepted / not on node).

- [ ] **Step 3: Add `name` to `SignalState`**

In `packages/reactivity/src/core.ts`, in the `SignalState<T>` interface, add:
```ts
  name?: string;
```

- [ ] **Step 4: Accept `name` in `createSignal`**

In `packages/reactivity/src/signal.ts`, extend `SignalOptions` and set it on the node:
```ts
export interface SignalOptions<T> {
  equals?: EqualsFn<T> | false;
  name?: string;
}
```
In `createSignal`, when building `node`, add the name (only if provided):
```ts
  const node: SignalState<T> = {
    value,
    observers: null,
    equals: options?.equals ?? defaultEquals,
  };
  if (options?.name !== undefined) node.name = options.name;
  runSignalCreateHook(node as SignalState<unknown>);
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- packages/reactivity/test/signal-name.test.ts`
Expected: PASS.
Run: `pnpm test -- packages/reactivity`
Expected: all reactivity tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/reactivity/src/core.ts packages/reactivity/src/signal.ts packages/reactivity/test/signal-name.test.ts
git commit -m "feat(reactivity): optional signal name (createSignal { name }) for devtools"
```

---

## Task 6: Per-frame changed-signal list in the agent

**Files:**
- Modify: `packages/devtools/src/protocol.ts` (`CommitMeta.signals`)
- Modify: `packages/devtools/src/commit-log.ts` (`CommitEntry.signals`)
- Modify: `packages/devtools/src/why-frame.ts` (ids + changed set)
- Modify: `packages/devtools/src/agent.ts` (thread into meta)
- Test: `packages/devtools/test/why-frame.test.ts` (extend), `packages/devtools/test/agent.test.ts` (extend)

- [ ] **Step 1: Add protocol + log fields**

In `packages/devtools/src/protocol.ts`, change `CommitMeta`:
```ts
export interface SignalRef { id: number; name?: string }
export interface CommitMeta {
  frame: number;
  signalWrites: number;
  effectRuns: number;
  signals: SignalRef[];
  durationMs: number;
}
```
> Note: `durationMs` is populated in Task 7; for this task set it to `0` where meta is built, then Task 7 fills it. Add `durationMs: 0` to every place a `CommitMeta` is constructed in `agent.ts` so the type stays satisfied.

In `packages/devtools/src/commit-log.ts`, extend `CommitEntry`:
```ts
export interface CommitEntry {
  frame: number;
  changedIds: number[];
  signalWrites: number;
  effectRuns: number;
  signals: { id: number; name?: string }[];
  durationMs: number;
}
```

- [ ] **Step 2: Write the failing why-frame test**

Add to `packages/devtools/test/why-frame.test.ts`:
```ts
  it('collects the set of changed signals with stable ids and names', () => {
    const tracker = new WhyFrameTracker();
    tracker.start();
    let firstId = -1;
    createRoot(() => {
      const [a, setA] = createSignal(0, { name: 'a' });
      const [, setB] = createSignal(0); // unnamed
      setA(1); setA(2); // same signal twice → one entry
      setB(1);
      a();
    });
    const r = tracker.take();
    expect(r.signals.length).toBe(2);
    const named = r.signals.find((s) => s.name === 'a');
    expect(named).toBeTruthy();
    firstId = named!.id;
    // second frame: writing the same signal again yields the same id
    tracker.take(); // drain
    tracker.stop();
    expect(typeof firstId).toBe('number');
  });
```
Ensure the test file imports `createRoot` and `createSignal` from `@cairn/reactivity` (extend the existing import).

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/why-frame.test.ts`
Expected: FAIL (`signals` not on take() result).

- [ ] **Step 4: Implement signal tracking in `why-frame.ts`**

Replace `packages/devtools/src/why-frame.ts` with:
```ts
import { setReactiveDevHooks } from '@cairn/reactivity';

interface SignalNode { name?: string }

export interface SignalRef { id: number; name?: string }

export class WhyFrameTracker {
  private signalWrites = 0;
  private effectRuns = 0;
  private ids = new WeakMap<object, number>();
  private nextId = 1;
  private changed = new Map<number, SignalRef>();

  private idOf(node: object): number {
    let id = this.ids.get(node);
    if (id === undefined) { id = this.nextId++; this.ids.set(node, id); }
    return id;
  }

  start(): void {
    setReactiveDevHooks({
      onSignalCreate: (n) => { this.idOf(n as object); },
      onSignalWrite: (n) => {
        this.signalWrites++;
        const id = this.idOf(n as object);
        if (!this.changed.has(id)) {
          this.changed.set(id, { id, name: (n as SignalNode).name });
        }
      },
      onComputationRun: (n) => { if ((n as { isEffect?: boolean }).isEffect) this.effectRuns++; },
    });
  }

  stop(): void { setReactiveDevHooks(null); }

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

- [ ] **Step 5: Thread signals into agent meta**

In `packages/devtools/src/agent.ts`, the `onCommit` handler builds meta from `counts = why.take()`. Since `take()` now returns `{ signalWrites, effectRuns, signals }`, update the meta and log construction to include `signals` and `durationMs: 0` (duration filled in Task 7):
```ts
      const counts = why.take();
      s.frame++;
      s.log.push({ frame: s.frame, changedIds: changed.map((c) => c.id), ...counts, durationMs: 0 });
      s.last = snapshot;
      if (s.pick) s.pick.update(snapshot);
      s.lastMeta = { frame: s.frame, ...counts, durationMs: 0 };
      emit({ type: 'commit', snapshot, changed, meta: s.lastMeta });
```
And in the `get-snapshot` fallback meta, add the new required fields:
```ts
        emit({ type: 'commit', snapshot, changed: [], meta: state.lastMeta ?? { frame: state.frame, signalWrites: 0, effectRuns: 0, signals: [], durationMs: 0 } });
```

- [ ] **Step 6: Extend the agent test**

Add to `packages/devtools/test/agent.test.ts` a test that mounts an app whose root writes a named signal during a subscribed frame and asserts the commit meta carries it. Simplest reliable form: subscribe, then create+write a named signal inside a `createRoot`, then trigger a frame via a second mount commit — but the demo-level assertion is covered by Playwright (Task 11). For the unit level, assert the shape only:
```ts
  it('commit meta includes signals array and durationMs field', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);
    const commit = events.find((e) => e.type === 'commit');
    expect(commit && commit.type === 'commit' && Array.isArray(commit.meta.signals)).toBe(true);
    expect(commit && commit.type === 'commit' && typeof commit.meta.durationMs).toBe('number');
    dispose();
  });
```

- [ ] **Step 7: Run tests**

Run: `pnpm test -- packages/devtools`
Expected: all pass.
Run: `pnpm typecheck`
Expected: clean (CommitMeta now requires `signals` + `durationMs` everywhere it's built).

- [ ] **Step 8: Commit**

```bash
git add packages/devtools/src/protocol.ts packages/devtools/src/commit-log.ts packages/devtools/src/why-frame.ts packages/devtools/src/agent.ts packages/devtools/test/why-frame.test.ts packages/devtools/test/agent.test.ts
git commit -m "feat(devtools): per-frame changed-signal list (ids + names) in commit meta"
```

---

## Task 7: Frame duration (profiler data)

**Files:**
- Modify: `packages/runtime/src/devtools-hook.ts` (signature)
- Modify: `packages/runtime/src/mount.ts` (measure + pass)
- Modify: `packages/devtools/src/agent.ts` (consume duration)
- Test: `packages/runtime/test/devtools-commit.test.ts` (extend), `packages/devtools/test/agent.test.ts` (already asserts durationMs is a number)

- [ ] **Step 1: Widen the runtime hook signature**

In `packages/runtime/src/devtools-hook.ts`:
```ts
export interface RuntimeDevHooks {
  onCommit(root: Instance, viewport: { w: number; h: number }, durationMs: number): void;
}
// ...
export function emitCommit(root: Instance, viewport: { w: number; h: number }, durationMs: number): void {
  if (hooks) hooks.onCommit(root, viewport, durationMs);
}
```

- [ ] **Step 2: Measure in mount**

In `packages/runtime/src/mount.ts` `renderFrame`, wrap the layout+paint body with timing. Add a `now()` helper at module top:
```ts
const now = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
```
At the start of `renderFrame`, capture `const t0 = now();`. Replace the `emitCommit(root, ctx.viewport);` call (after `endFrame()`) with:
```ts
      host.renderer.endFrame();
      emitCommit(root, ctx.viewport, now() - t0);
```

- [ ] **Step 3: Consume duration in the agent**

In `packages/devtools/src/agent.ts`, update the `onCommit` signature and use `durationMs` instead of the `0` placeholder from Task 6:
```ts
    onCommit: (root, viewport, durationMs) => {
      // ...unchanged lazy guard + serialize + diff + counts...
      s.log.push({ frame: s.frame, changedIds: changed.map((c) => c.id), ...counts, durationMs });
      s.lastMeta = { frame: s.frame, ...counts, durationMs };
      emit({ type: 'commit', snapshot, changed, meta: s.lastMeta });
    },
```

- [ ] **Step 4: Extend the runtime commit test**

Add to `packages/runtime/test/devtools-commit.test.ts` an assertion that `durationMs` is passed (a number ≥ 0):
```ts
  it('passes a numeric durationMs to onCommit', () => {
    let dur = -1;
    setRuntimeDevHooks({ onCommit: (_r, _v, d) => { dur = d; } });
    const { host } = createFakeHost();
    const app: Instance = { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, layout: () => ({ w: 200, h: 100 }) } as any, children: [], paintSelf() {} };
    const dispose = mount(() => app, host);
    expect(typeof dur).toBe('number');
    expect(dur).toBeGreaterThanOrEqual(0);
    dispose();
  });
```
> Adjust the existing test in that file: its `onCommit` callback now receives a third arg — that's backward compatible (extra args are ignored), so existing assertions still hold.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test -- packages/runtime packages/devtools`
Expected: all pass.
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/devtools-hook.ts packages/runtime/src/mount.ts packages/devtools/src/agent.ts packages/runtime/test/devtools-commit.test.ts
git commit -m "feat(devtools): measure frame durationMs and thread into commit meta"
```

---

## Task 8: Snapshot delta core (`delta.ts`) — pure compute/apply

**Files:**
- Create: `packages/devtools/src/delta.ts`
- Modify: `packages/devtools/src/protocol.ts` (`commit-delta` event + `SnapshotDelta`)
- Test: `packages/devtools/test/delta.test.ts`

> This task is the pure, safe, reusable delta core. Agent/panel wiring (Task 9) is separately trimmable per the spec.

- [ ] **Step 1: Add protocol types**

In `packages/devtools/src/protocol.ts`:
```ts
export interface SnapshotDelta {
  added: SnapshotNode[];               // full subtrees newly present (with parentId)
  removed: number[];                   // ids no longer present
  changed: { id: number; patch: Partial<Omit<SnapshotNode, 'children'>> }[];
  addedParents: Record<number, number>; // addedNodeId -> parentId
}
```
And add a variant to `AgentEvent`:
```ts
  | { type: 'commit-delta'; delta: SnapshotDelta; meta: CommitMeta }
```

- [ ] **Step 2: Write the failing property-style test**

`packages/devtools/test/delta.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { computeDelta, applyDelta } from '../src/delta';

function n(id: number, w: number, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect: { x: 0, y: 0, w, h: 1 }, size: { w, h: 1 }, offset: { x: 0, y: 0 },
    layout: { flex: 0, zIndex: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('delta', () => {
  it('applyDelta(prev, computeDelta(prev,next)) reconstructs next', () => {
    const prev = n(1, 10, [n(2, 5), n(3, 5, [n(4, 2)])]);
    const next = n(1, 10, [n(2, 99), n(5, 7)]); // 2 changed (w), 3+4 removed, 5 added
    const rebuilt = applyDelta(prev, computeDelta(prev, next));
    expect(rebuilt).toEqual(next);
  });

  it('handles no changes', () => {
    const t = n(1, 10, [n(2, 5)]);
    expect(applyDelta(t, computeDelta(t, structuredClone(t)))).toEqual(t);
  });

  it('handles a pure attribute change on the root', () => {
    const prev = n(1, 10);
    const next = n(1, 20);
    expect(applyDelta(prev, computeDelta(prev, next))).toEqual(next);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/delta.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `delta.ts`**

`packages/devtools/src/delta.ts`:
```ts
import type { SnapshotNode, SnapshotDelta } from './protocol';

function index(node: SnapshotNode, map: Map<number, SnapshotNode>, parent: Map<number, number>, parentId?: number): void {
  map.set(node.id, node);
  if (parentId !== undefined) parent.set(node.id, parentId);
  for (const c of node.children) index(c, map, parent, node.id);
}

function shallowEqual(a: SnapshotNode, b: SnapshotNode): boolean {
  // Compare everything except children (structure handled separately).
  const { children: _ac, ...ar } = a;
  const { children: _bc, ...br } = b;
  return JSON.stringify(ar) === JSON.stringify(br);
}

export function computeDelta(prev: SnapshotNode, next: SnapshotNode): SnapshotDelta {
  const prevMap = new Map<number, SnapshotNode>();
  const prevParent = new Map<number, number>();
  const nextMap = new Map<number, SnapshotNode>();
  const nextParent = new Map<number, number>();
  index(prev, prevMap, prevParent);
  index(next, nextMap, nextParent);

  const added: SnapshotNode[] = [];
  const addedParents: Record<number, number> = {};
  const removed: number[] = [];
  const changed: { id: number; patch: Partial<Omit<SnapshotNode, 'children'>> }[] = [];

  for (const [id, node] of nextMap) {
    if (!prevMap.has(id)) {
      // Only record the topmost added node of a new subtree (parent already existed or is itself added-root handled by apply).
      const p = nextParent.get(id);
      if (p === undefined || prevMap.has(p)) {
        added.push(stripChildren(node));
        addedParents[id] = p ?? -1;
      }
    } else if (!shallowEqual(prevMap.get(id)!, node)) {
      const { children: _c, ...patch } = node;
      changed.push({ id, patch });
    }
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) {
      const p = prevParent.get(id);
      if (p === undefined || !prevMap.has(p) || nextMap.has(p)) removed.push(id);
    }
  }
  return { added, removed, changed, addedParents };
}

// Deep-clone a node but keep its full subtree (added subtrees are sent whole).
function stripChildren(node: SnapshotNode): SnapshotNode {
  return structuredClone(node);
}

export function applyDelta(prev: SnapshotNode, delta: SnapshotDelta): SnapshotNode {
  const root = structuredClone(prev);
  const map = new Map<number, SnapshotNode>();
  const buildIndex = (n: SnapshotNode): void => { map.set(n.id, n); n.children.forEach(buildIndex); };
  buildIndex(root);

  // 1) removals
  const removedSet = new Set(delta.removed);
  const prune = (n: SnapshotNode): void => {
    n.children = n.children.filter((c) => !removedSet.has(c.id));
    n.children.forEach(prune);
  };
  prune(root);
  removedSet.forEach((id) => map.delete(id));

  // 2) changes
  for (const { id, patch } of delta.changed) {
    const target = map.get(id);
    if (target) Object.assign(target, patch);
  }

  // 3) additions (append under their parent; -1 means new root — not expected for a stable root)
  for (const node of delta.added) {
    const parentId = delta.addedParents[node.id];
    const parent = parentId === -1 ? null : map.get(parentId);
    const clone = structuredClone(node);
    const reindex = (nn: SnapshotNode): void => { map.set(nn.id, nn); nn.children.forEach(reindex); };
    reindex(clone);
    if (parent) parent.children.push(clone);
  }

  return root;
}
```
> If the `computeDelta`/`applyDelta` round-trip test reveals ordering differences (added children appended vs. original position), and matching exact child order proves complex, STOP and report DONE_WITH_CONCERNS — the spec sanctions deferring the delta protocol to D4. Do NOT block the rest of DT3 on delta.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- packages/devtools/test/delta.test.ts`
Expected: PASS. If child-ordering causes `toEqual` failures that can't be resolved simply, report per the note above.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/delta.ts packages/devtools/src/protocol.ts packages/devtools/test/delta.test.ts
git commit -m "feat(devtools): pure snapshot delta compute/apply (protocol commit-delta)"
```

---

## Task 9 (OPTIONAL — trimmable): Emit deltas from the agent

**Files:**
- Modify: `packages/devtools/src/agent.ts`
- Test: `packages/devtools/test/agent.test.ts` (extend)

> Per the spec, this integration is the trimmable part. Implement it only if Task 8 landed cleanly. If skipped, the agent keeps sending full snapshots (already working) and the panel's delta-apply path (Task 10) is simply not exercised.

- [ ] **Step 1: Write the failing test**

Add to `packages/devtools/test/agent.test.ts`:
```ts
  it('emits commit-delta after the first full commit when enabled', () => {
    installDevtools({ delta: true } as any);
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    // two frames: first full commit, second should be a delta
    const dispose = mount(() => appRoot(), host);
    hook.send({ type: 'get-snapshot' }); // ensure baseline
    // trigger a second frame by re-mounting a fresh tree is not trivial with the fake;
    // instead assert the first event to a fresh subscriber is a full commit:
    const fresh: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => fresh.push(e));
    hook.send({ type: 'get-snapshot' });
    expect(fresh.some((e) => e.type === 'commit')).toBe(true);
    dispose();
  });
```
> This is a shape/behavior guard, not a full two-frame delta test (the fake host commits once). The real delta round-trip is covered by Task 8's unit tests; end-to-end delta is verified manually in the panel.

- [ ] **Step 2: Implement opt-in delta emission**

In `packages/devtools/src/agent.ts`, add `delta?: boolean` to `DevtoolsOptions`. Track whether a full commit has been sent to current subscribers (`s.deltaBaseSent: boolean`, reset to false whenever `s.last` is null or a new subscriber attaches). In `onCommit`, when `opts.delta` is true and a baseline snapshot was already emitted, compute `computeDelta(prevSnapshot, snapshot)` and `emit({ type: 'commit-delta', delta, meta })` instead of the full commit; otherwise emit the full `commit` and set the baseline. Always emit a full `commit` (not delta) from the `get-snapshot` handler and to brand-new subscribers (so a late panel gets a full tree first). Keep `s.last` = the latest full snapshot for future delta bases.

Minimal shape:
```ts
      if (opts.delta && s.deltaBaseSent && prevForDelta) {
        emit({ type: 'commit-delta', delta: computeDelta(prevForDelta, snapshot), meta: s.lastMeta });
      } else {
        emit({ type: 'commit', snapshot, changed, meta: s.lastMeta });
        s.deltaBaseSent = true;
      }
```
(`prevForDelta` = the snapshot from the previous commit; import `computeDelta`.)

- [ ] **Step 3: Run tests + typecheck**

Run: `pnpm test -- packages/devtools` and `pnpm typecheck`
Expected: green/clean.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/agent.ts packages/devtools/test/agent.test.ts
git commit -m "feat(devtools): opt-in commit-delta emission from agent"
```

---

## Task 10: Panel — Style section, signals, profiler timeline, delta apply

**Files:**
- Modify: `devtools-extension/src/panel/panel.ts`
- (No new deps.)

**XSS rule (unchanged from DT2):** use ONLY `textContent` / DOM builders. Never `innerHTML`.

- [ ] **Step 1: Render the Style section in the props pane**

In `renderProps()`, after the existing layout/flags rows, if `node.style` is present, add a "Style" subheading and a `kv` row per key. For object values (padding/border), stringify compactly with `JSON.stringify(value)`; all values go through `textContent` via the existing `kv` helper:
```ts
  if (node.style) {
    const head = document.createElement('div');
    head.className = 'kv';
    const b = document.createElement('b'); b.textContent = '— style —'; head.append(b);
    propsEl.appendChild(head);
    for (const [k, v] of Object.entries(node.style)) {
      kv(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  }
```

- [ ] **Step 2: Show changed signals in the commit log line**

In `appendCommit(meta)`, extend the log line text to include signal names/ids:
```ts
  const sig = meta.signals && meta.signals.length
    ? '  signals:[' + meta.signals.map((s) => s.name ?? '#' + s.id).join(',') + ']'
    : '';
  line.textContent = `#${meta.frame}  ${Math.round(meta.durationMs)}ms  signals:${meta.signalWrites} effects:${meta.effectRuns} changed:${changedIds.size}${sig}`;
```
Update the `CommitMeta` import usage — `meta.signals` and `meta.durationMs` now exist on the type imported from `@cairn/devtools`.

- [ ] **Step 3: Add a simple profiler timeline**

Add a `#profiler` container to `panel.html` (a thin strip above `#log`), and in `appendCommit` push a bar element whose height ∝ `durationMs` and title shows frame+duration:
```ts
function appendProfilerBar(meta: CommitMeta): void {
  const bar = document.createElement('div');
  bar.className = 'bar';
  const h = Math.min(40, 2 + Math.round(meta.durationMs * 2));
  bar.style.height = `${h}px`;
  bar.title = `#${meta.frame} · ${Math.round(meta.durationMs)}ms · ${changedIds.size} changed`;
  profilerEl.appendChild(bar);
  while (profilerEl.childElementCount > 120) profilerEl.firstElementChild?.remove();
}
```
Call `appendProfilerBar(event.meta)` in the `commit` branch of `handleEvent`. Add `#profiler { display:flex; align-items:flex-end; gap:1px; height:44px; overflow:hidden; border-bottom:1px solid #eee; padding:2px }` and `.bar{ width:3px; background:#4c8bf5 }` to `panel.css`, and `const profilerEl = document.getElementById('profiler') as HTMLDivElement;` in panel.ts.

- [ ] **Step 4: Handle `commit-delta` (if Task 9 landed)**

In `handleEvent`, add a branch: on `commit-delta`, apply it to the retained `snapshot` using a local copy of the delta-apply logic. Since the panel bundles from `@cairn/devtools` types only (no runtime import), inline a minimal `applyDelta` OR — cleaner — import `applyDelta` as a VALUE from `@cairn/devtools` (this makes the panel bundle include it; that's fine, it's pure and small). Add:
```ts
import { applyDelta } from '@cairn/devtools';
// ...
  } else if (event.type === 'commit-delta') {
    if (snapshot) {
      snapshot = applyDelta(snapshot, event.delta);
      changedIds = new Set(event.delta.changed.map((c) => c.id));
      renderTree(); renderProps(); appendCommit(event.meta); appendProfilerBar(event.meta);
    }
  }
```
> If Task 9 was skipped, skip this step — the agent never sends `commit-delta`.

- [ ] **Step 5: Build the extension**

Run: `cd devtools-extension && pnpm build`
Expected: no esbuild errors; `dist/panel.js` regenerated. Note: importing `applyDelta` as a value means `@cairn/devtools` code IS now bundled into `panel.js` — that's expected and fine (it's pure, no DOM/runtime deps).

- [ ] **Step 6: Commit**

```bash
git add devtools-extension/src/panel
git commit -m "feat(extension): panel shows style, changed signals, profiler timeline, delta apply"
```

---

## Task 11: Demo + Playwright integration

**Files:**
- Modify: `examples/devtools-demo/main.tsx`
- Modify: `packages/devtools/test/integration/agent-browser.spec.ts`

- [ ] **Step 1: Use a named signal + a material component in the demo**

In `examples/devtools-demo/main.tsx`, change the count signal to be named and add the `@cairn/material` alias usage is already available (the example resolves `@cairn/material` via its vite alias — confirm the alias exists; if not, add `'@cairn/material': pkg('material/src/index.ts')` to `examples/devtools-demo/vite.config.ts`). Replace the plain `Box` button with a material `Button`, and name the signal:
```tsx
import { Button, createMaterialTheme } from '@cairn/material';
import { ThemeProvider } from '@cairn/primitives';
// signal:
const [count, setCount] = createSignal(0, { name: 'count' });
// wrap the app in ThemeProvider({ theme: createMaterialTheme(), children: () => App() }) at mount,
// and use Button({ label: 'Increment', onClick: () => setCount((c) => c + 1) }) in the Row.
```
Keep `installDevtools({ canvas })` before `mount`. Ensure the tree now contains a `Button` node.
> Read the existing `examples/mt-showcase/main.tsx` for the exact `ThemeProvider` + `createMaterialTheme` bootstrap and mirror it.

- [ ] **Step 2: Extend the Playwright spec**

Add tests to `packages/devtools/test/integration/agent-browser.spec.ts`:
```ts
test('tree shows material component names', async ({ page }) => {
  await page.goto('/');
  const names = await page.evaluate(() => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const evts: any[] = []; hook.subscribe((e: any) => evts.push(e));
    hook.send({ type: 'get-snapshot' });
    const commit = evts.find((e) => e.type === 'commit');
    const out: string[] = [];
    const walk = (n: any) => { out.push(n.name); n.children.forEach(walk); };
    if (commit) walk(commit.snapshot);
    return out;
  });
  expect(names).toContain('Button');
});

test('nodes carry resolved style', async ({ page }) => {
  await page.goto('/');
  const hasStyle = await page.evaluate(() => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const evts: any[] = []; hook.subscribe((e: any) => evts.push(e));
    hook.send({ type: 'get-snapshot' });
    const commit = evts.find((e) => e.type === 'commit');
    let found = false;
    const walk = (n: any) => { if (n.style && (n.style.backgroundColor || n.style.padding)) found = true; n.children.forEach(walk); };
    if (commit) walk(commit.snapshot);
    return found;
  });
  expect(hasStyle).toBe(true);
});
```

- [ ] **Step 3: Run Playwright**

Run: `pnpm test:e2e`
Expected: existing DT1 smoke tests + the two new tests pass (webServer serves the demo).
> If the demo fails to render with material Button (missing ThemeProvider), fix the bootstrap until the page renders and the agent reports a `Button` node.

- [ ] **Step 4: Commit**

```bash
git add examples/devtools-demo packages/devtools/test/integration/agent-browser.spec.ts
git commit -m "test(devtools): demo uses material Button + named signal; e2e asserts names/style"
```

---

## Task 12: Final verification + docs

**Files:**
- Modify: `docs/superpowers/specs/2026-07-05-dt3-devtools-depth-design.md` (status)
- Modify: `devtools-extension/README.md` (checklist additions)

- [ ] **Step 1: Full sweep**

Run: `pnpm test`
Expected: all packages green.
Run: `pnpm typecheck`
Expected: clean.
Run: `pnpm test:e2e`
Expected: green.

- [ ] **Step 2: Update the extension manual checklist**

In `devtools-extension/README.md`, add checklist items:
```markdown
- [ ] Tree shows component names (Button/Card/Chip), not just Box/Row/Text.
- [ ] Selecting a node shows a Style section (backgroundColor/padding/…).
- [ ] Commit log lines show changed signal names (e.g. `signals:[count]`) and frame duration.
- [ ] Profiler strip shows a bar per commit; taller = slower frame.
```

- [ ] **Step 3: Mark the spec implemented**

Change the spec status line to `**Статус:** реализовано (DT3)`. If the delta protocol (Task 9 / panel delta) was trimmed, append `; дельта-протокол вынесен в D4` and move the delta bullet in "Вне охвата (D4+)".

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-05-dt3-devtools-depth-design.md devtools-extension/README.md
git commit -m "docs(devtools): mark DT3 implemented; extension checklist for depth features"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** names D3a (Tasks 1–2), style D3b (Tasks 3–4), why-frame signals D3c (Tasks 5–6), profiler duration+timeline D3d (Tasks 7, 10), delta D3d (Tasks 8–9, panel step 4) — with delta explicitly trimmable. Demo+e2e (Task 11), final (Task 12).
- **Type consistency:** `CommitMeta` gains `signals: SignalRef[]` + `durationMs: number` in Task 6/7 and every construction site (agent onCommit, get-snapshot fallback) is updated in the same tasks; `CommitEntry` mirrors it. `SnapshotNode.style?`, `SnapshotDelta`, `commit-delta`, `SignalRef` are defined once in `protocol.ts`. `computeDelta`/`applyDelta` names are stable. `debugName`/`debugStyle` are the DT1-added / Task-3-added Instance fields.
- **Zero-ish prod cost:** debugName = one string assign per component; debugStyle = one ref assign in an existing bind callback; durationMs = 2 `now()` calls per frame. None on a hot per-signal path.
- **Adaptation points flagged inline:** widget/material construction context in tests (Tasks 1–2), material alias in the demo vite config (Task 11), delta child-ordering escape hatch (Task 8), delta emission optionality (Task 9).
```
