# DT1 — Cairn DevTools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build React-DevTools-style tooling for Cairn — a `@cairn/devtools` agent (tree snapshot, diff, commit log, on-canvas highlight, pick) fed by zero-cost dev hooks in the framework core, surfaced through a Chrome extension panel.

**Architecture:** Dev hooks (null-guarded) in `@cairn/reactivity` and `@cairn/runtime` feed a DOM-free agent in `@cairn/devtools` that serializes the `Instance` tree each commit. A transport-independent protocol (snapshot/command) connects the agent (published on `window.__CAIRN_DEVTOOLS_HOOK__`) to a Chrome extension (injected → content → devtools panel).

**Tech Stack:** TypeScript, pnpm workspaces, vitest (+ jsdom), esbuild (extension build), Chrome Manifest V3, Playwright (integration smoke).

**Spec:** `docs/superpowers/specs/2026-07-04-dt1-devtools-inspector-design.md`

---

## File Structure

**New package `packages/devtools/` (`@cairn/devtools`):**
- `src/protocol.ts` — shared types: `Rect`, `SnapshotNode`, `ChangedNode`, `CommitMeta`, `AgentEvent`, `PanelCommand`, `DevtoolsHook`.
- `src/ids.ts` — `idOf(inst)` (stable `WeakMap` id) + `instanceById(id)` (reverse `WeakRef` map).
- `src/name.ts` — `inferName(inst)` from `debugName` / layout class.
- `src/serialize.ts` — `serialize(root)` → `SnapshotNode` (absolute rects).
- `src/diff.ts` — `diffSnapshots(prev, next)` → `ChangedNode[]`.
- `src/commit-log.ts` — `CommitLog` ring buffer.
- `src/why-frame.ts` — `WhyFrameTracker` (signal/effect counters via reactive hooks).
- `src/highlight.ts` — `canvasRectToPage`, `pagePointToCanvas`, `Highlighter` DOM overlay.
- `src/pick.ts` — `hitTest`, `PickController`.
- `src/find.ts` — `findNode(snapshot, id)`.
- `src/agent.ts` — `installDevtools(opts)`.
- `src/index.ts` — public exports.
- `test/*.test.ts` — one per module.

**Core instrumentation (edits):**
- `packages/reactivity/src/core.ts` — `ReactiveDevHooks`, `setReactiveDevHooks`, `runSignalCreateHook`; call sites in `writeSignal`, `runComputation`.
- `packages/reactivity/src/signal.ts` — call `runSignalCreateHook`.
- `packages/reactivity/src/index.ts` — export hook API.
- `packages/runtime/src/devtools-hook.ts` — `RuntimeDevHooks`, `setRuntimeDevHooks`, `emitCommit`.
- `packages/runtime/src/mount.ts` — call `emitCommit` after paint.
- `packages/runtime/src/instance.ts` — add `debugName?: string`.
- `packages/runtime/src/index.ts` — export `setRuntimeDevHooks`.

**Extension `devtools-extension/`:**
- `manifest.json`, `build.mjs`, `package.json`, `README.md`.
- `src/injected.ts`, `src/content.ts`, `src/devtools.ts`, `src/bridge.ts`, `src/devtools.html`.
- `src/panel/panel.html`, `src/panel/panel.ts`, `src/panel/panel.css`.

**Example `examples/devtools-demo/`:** `index.html`, `main.tsx`.

---

## Task 1: Scaffold `@cairn/devtools` package + protocol types

**Files:**
- Create: `packages/devtools/package.json`
- Create: `packages/devtools/tsconfig.json`
- Create: `packages/devtools/src/protocol.ts`
- Create: `packages/devtools/src/index.ts`
- Create: `packages/devtools/test/protocol.test.ts`
- Modify: `package.json` (root — add devtools to `typecheck`)

- [ ] **Step 1: Create package manifest and tsconfig**

`packages/devtools/package.json`:
```json
{
  "name": "@cairn/devtools",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "sideEffects": false,
  "dependencies": {
    "@cairn/runtime": "workspace:*",
    "@cairn/reactivity": "workspace:*",
    "@cairn/layout": "workspace:*"
  }
}
```

`packages/devtools/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src", "test"]
}
```

- [ ] **Step 2: Write protocol types**

`packages/devtools/src/protocol.ts`:
```ts
export interface Rect { x: number; y: number; w: number; h: number }

export interface SnapshotNode {
  id: number;
  name: string;
  rect: Rect;                       // absolute, layout/CSS px
  size: { w: number; h: number };
  offset: { x: number; y: number }; // relative to parent
  layout: {
    flex: number;
    zIndex: number;
    margin: { top: number; right: number; bottom: number; left: number };
    left?: number; top?: number; right?: number; bottom?: number;
  };
  flags: {
    clip: boolean;
    transform: boolean;
    opacity: number;
    focusable: boolean;
    pointerEvents: 'auto' | 'none';
  };
  semantics?: { role: string; label?: string };
  children: SnapshotNode[];
}

export interface ChangedNode { id: number; fields: string[] }
export interface CommitMeta { frame: number; signalWrites: number; effectRuns: number }

export type AgentEvent =
  | { type: 'hello'; version: string }
  | { type: 'commit'; snapshot: SnapshotNode; changed: ChangedNode[]; meta: CommitMeta }
  | { type: 'selection'; id: number };

export type PanelCommand =
  | { type: 'inspect-start' }
  | { type: 'inspect-stop' }
  | { type: 'highlight'; id: number | null }
  | { type: 'select'; id: number }
  | { type: 'get-snapshot' };

export interface DevtoolsHook {
  version: string;
  subscribe(cb: (e: AgentEvent) => void): () => void;
  send(cmd: PanelCommand): void;
  getSnapshot(): SnapshotNode | null;
}

export const DEVTOOLS_VERSION = '0.0.0';
```

`packages/devtools/src/index.ts`:
```ts
export * from './protocol';
```

- [ ] **Step 3: Write a type-round-trip test**

`packages/devtools/test/protocol.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DEVTOOLS_VERSION, type AgentEvent, type PanelCommand } from '../src/protocol';

describe('protocol', () => {
  it('AgentEvent and PanelCommand are JSON-serializable', () => {
    const evt: AgentEvent = { type: 'selection', id: 3 };
    const cmd: PanelCommand = { type: 'highlight', id: null };
    expect(JSON.parse(JSON.stringify(evt))).toEqual(evt);
    expect(JSON.parse(JSON.stringify(cmd))).toEqual(cmd);
    expect(typeof DEVTOOLS_VERSION).toBe('string');
  });
});
```

- [ ] **Step 4: Add devtools to root typecheck and run tests**

In root `package.json` `typecheck` script, append (before the closing quote):
```
 && tsc --noEmit -p packages/devtools/tsconfig.json
```

Run: `pnpm install && pnpm test -- packages/devtools/test/protocol.test.ts`
Expected: 1 test passes.
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools package.json pnpm-lock.yaml
git commit -m "feat(devtools): scaffold @cairn/devtools package + protocol types"
```

---

## Task 2: Stable IDs (`ids.ts`)

**Files:**
- Create: `packages/devtools/src/ids.ts`
- Test: `packages/devtools/test/ids.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/ids.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type { Instance } from '@cairn/runtime';
import { idOf, instanceById, resetIds } from '../src/ids';

function fakeInstance(): Instance {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 } } as any, children: [], paintSelf() {} };
}

describe('ids', () => {
  beforeEach(() => resetIds());

  it('returns the same id for the same instance', () => {
    const a = fakeInstance();
    expect(idOf(a)).toBe(idOf(a));
  });

  it('returns different ids for different instances', () => {
    expect(idOf(fakeInstance())).not.toBe(idOf(fakeInstance()));
  });

  it('resolves an instance back by id', () => {
    const a = fakeInstance();
    const id = idOf(a);
    expect(instanceById(id)).toBe(a);
  });

  it('returns undefined for an unknown id', () => {
    expect(instanceById(999999)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/ids.test.ts`
Expected: FAIL (`Cannot find module '../src/ids'`).

- [ ] **Step 3: Implement**

`packages/devtools/src/ids.ts`:
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

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test -- packages/devtools/test/ids.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/ids.ts packages/devtools/test/ids.test.ts
git commit -m "feat(devtools): stable instance ids with reverse resolution"
```

---

## Task 3: Name inference (`name.ts`)

**Files:**
- Create: `packages/devtools/src/name.ts`
- Test: `packages/devtools/test/name.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/name.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Instance } from '@cairn/runtime';
import { inferName } from '../src/name';

function withLayout(ctor: string, extra: Record<string, unknown> = {}): Instance {
  const layout = Object.assign(Object.create({ constructor: { name: ctor } }), {
    offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, ...extra,
  });
  return { layout: layout as any, children: [], paintSelf() {} };
}

describe('inferName', () => {
  it('prefers explicit debugName', () => {
    const inst = withLayout('BoxNode');
    (inst as { debugName?: string }).debugName = 'Button';
    expect(inferName(inst)).toBe('Button');
  });
  it('maps BoxNode to Box', () => expect(inferName(withLayout('BoxNode'))).toBe('Box'));
  it('maps TextNode to Text', () => expect(inferName(withLayout('TextNode'))).toBe('Text'));
  it('maps FlexNode row to Row', () => expect(inferName(withLayout('FlexNode', { direction: 'row' }))).toBe('Row'));
  it('maps FlexNode column to Column', () => expect(inferName(withLayout('FlexNode', { direction: 'column' }))).toBe('Column'));
  it('maps StackNode to Stack', () => expect(inferName(withLayout('StackNode'))).toBe('Stack'));
  it('falls back to the class name', () => expect(inferName(withLayout('WeirdNode'))).toBe('WeirdNode'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/name.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/devtools/src/name.ts`:
```ts
import type { Instance } from '@cairn/runtime';

export function inferName(inst: Instance): string {
  const dbg = (inst as { debugName?: string }).debugName;
  if (dbg) return dbg;
  const layout = inst.layout as { direction?: string; constructor?: { name?: string } };
  const cls = layout?.constructor?.name;
  switch (cls) {
    case 'FlexNode': return layout.direction === 'column' ? 'Column' : 'Row';
    case 'BoxNode': return 'Box';
    case 'TextNode': return 'Text';
    case 'StackNode': return 'Stack';
    case 'ScrollNode': return 'ScrollView';
    case 'GridNode': return 'Grid';
    default: return cls ?? 'Node';
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test -- packages/devtools/test/name.test.ts`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/name.ts packages/devtools/test/name.test.ts
git commit -m "feat(devtools): node name inference from layout class / debugName"
```

---

## Task 4: Serialize the instance tree (`serialize.ts`)

**Files:**
- Create: `packages/devtools/src/serialize.ts`
- Test: `packages/devtools/test/serialize.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/serialize.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type { Instance } from '@cairn/runtime';
import { serialize } from '../src/serialize';
import { resetIds } from '../src/ids';

function node(ctor: string, opts: {
  x?: number; y?: number; w?: number; h?: number; children?: Instance[];
} = {}): Instance {
  const layout = Object.assign(Object.create({ constructor: { name: ctor } }), {
    offsetX: opts.x ?? 0, offsetY: opts.y ?? 0,
    size: { w: opts.w ?? 0, h: opts.h ?? 0 },
    flex: 0, zIndex: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  return { layout: layout as any, children: opts.children ?? [], paintSelf() {} };
}

describe('serialize', () => {
  beforeEach(() => resetIds());

  it('produces absolute rects by accumulating offsets', () => {
    const child = node('TextNode', { x: 5, y: 7, w: 10, h: 2 });
    const root = node('BoxNode', { x: 3, y: 4, w: 100, h: 50, children: [child] });
    const snap = serialize(root);
    expect(snap.rect).toEqual({ x: 3, y: 4, w: 100, h: 50 });
    expect(snap.children[0].rect).toEqual({ x: 8, y: 11, w: 10, h: 2 });
  });

  it('records name, size, offset and children', () => {
    const snap = serialize(node('FlexNode', { w: 20, h: 20, children: [node('TextNode')] }));
    expect(snap.name).toBe('Row');
    expect(snap.size).toEqual({ w: 20, h: 20 });
    expect(snap.children).toHaveLength(1);
    expect(snap.children[0].name).toBe('Text');
  });

  it('captures flags and semantics', () => {
    const inst = node('BoxNode', { w: 1, h: 1 });
    inst.focusable = true;
    inst.paintOpacity = 0.5;
    inst.semantics = { role: 'button', label: 'OK' } as any;
    const snap = serialize(inst);
    expect(snap.flags.focusable).toBe(true);
    expect(snap.flags.opacity).toBe(0.5);
    expect(snap.semantics).toEqual({ role: 'button', label: 'OK' });
  });

  it('omits semantics when role is none', () => {
    const inst = node('BoxNode');
    inst.semantics = { role: 'none' } as any;
    expect(serialize(inst).semantics).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/serialize.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/devtools/src/serialize.ts`:
```ts
import type { Instance } from '@cairn/runtime';
import type { SnapshotNode } from './protocol';
import { idOf } from './ids';
import { inferName } from './name';

export function serialize(root: Instance): SnapshotNode {
  return build(root, 0, 0);
}

function build(inst: Instance, absX: number, absY: number): SnapshotNode {
  const l = inst.layout;
  const x = absX + l.offsetX;
  const y = absY + l.offsetY;

  const snap: SnapshotNode = {
    id: idOf(inst),
    name: inferName(inst),
    rect: { x, y, w: l.size.w, h: l.size.h },
    size: { w: l.size.w, h: l.size.h },
    offset: { x: l.offsetX, y: l.offsetY },
    layout: {
      flex: l.flex,
      zIndex: l.zIndex,
      margin: l.margin,
      left: l.left, top: l.top, right: l.right, bottom: l.bottom,
    },
    flags: {
      clip: inst.clipChildren != null,
      transform: inst.transform != null,
      opacity: inst.paintOpacity ?? 1,
      focusable: !!inst.focusable,
      pointerEvents: inst.pointerEvents ?? 'auto',
    },
    children: inst.children.map((c) => build(c, x, y)),
  };

  const sem = inst.semantics as { role?: string; label?: string } | undefined;
  if (sem && sem.role && sem.role !== 'none') {
    snap.semantics = { role: sem.role, label: sem.label };
  }
  return snap;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test -- packages/devtools/test/serialize.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/serialize.ts packages/devtools/test/serialize.test.ts
git commit -m "feat(devtools): serialize instance tree to snapshot with absolute rects"
```

---

## Task 5: Diff snapshots (`diff.ts`)

**Files:**
- Create: `packages/devtools/src/diff.ts`
- Test: `packages/devtools/test/diff.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/diff.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { diffSnapshots } from '../src/diff';

function n(id: number, rect: { x: number; y: number; w: number; h: number }, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect, size: { w: rect.w, h: rect.h }, offset: { x: rect.x, y: rect.y },
    layout: { flex: 0, zIndex: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('diffSnapshots', () => {
  it('reports no changes for identical trees', () => {
    const a = n(1, { x: 0, y: 0, w: 10, h: 10 });
    const b = n(1, { x: 0, y: 0, w: 10, h: 10 });
    expect(diffSnapshots(a, b)).toEqual([]);
  });

  it('reports a changed rect with the field name', () => {
    const prev = n(1, { x: 0, y: 0, w: 10, h: 10 });
    const next = n(1, { x: 0, y: 0, w: 20, h: 10 });
    const changed = diffSnapshots(prev, next);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe(1);
    expect(changed[0].fields).toContain('rect');
  });

  it('flags newly added nodes', () => {
    const prev = n(1, { x: 0, y: 0, w: 10, h: 10 });
    const next = n(1, { x: 0, y: 0, w: 10, h: 10 }, [n(2, { x: 1, y: 1, w: 2, h: 2 })]);
    const changed = diffSnapshots(prev, next);
    expect(changed).toEqual([{ id: 2, fields: ['added'] }]);
  });

  it('treats a null previous snapshot as everything added', () => {
    const next = n(1, { x: 0, y: 0, w: 10, h: 10 });
    expect(diffSnapshots(null, next)).toEqual([{ id: 1, fields: ['added'] }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/diff.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/devtools/src/diff.ts`:
```ts
import type { SnapshotNode, ChangedNode } from './protocol';

function flatten(node: SnapshotNode, map: Map<number, SnapshotNode>): void {
  map.set(node.id, node);
  for (const c of node.children) flatten(c, map);
}

export function diffSnapshots(prev: SnapshotNode | null, next: SnapshotNode): ChangedNode[] {
  const prevMap = new Map<number, SnapshotNode>();
  if (prev) flatten(prev, prevMap);
  const out: ChangedNode[] = [];
  walk(next, prevMap, out);
  return out;
}

function walk(node: SnapshotNode, prevMap: Map<number, SnapshotNode>, out: ChangedNode[]): void {
  const before = prevMap.get(node.id);
  if (!before) {
    out.push({ id: node.id, fields: ['added'] });
  } else {
    const fields: string[] = [];
    if (!rectEq(before.rect, node.rect)) fields.push('rect');
    if (before.offset.x !== node.offset.x || before.offset.y !== node.offset.y) fields.push('offset');
    if (before.layout.flex !== node.layout.flex) fields.push('flex');
    if (before.layout.zIndex !== node.layout.zIndex) fields.push('zIndex');
    if (fields.length) out.push({ id: node.id, fields });
  }
  for (const c of node.children) walk(c, prevMap, out);
}

function rectEq(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test -- packages/devtools/test/diff.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/diff.ts packages/devtools/test/diff.test.ts
git commit -m "feat(devtools): snapshot diff (changed rect/offset/flex/z + added)"
```

---

## Task 6: Commit log ring buffer (`commit-log.ts`)

**Files:**
- Create: `packages/devtools/src/commit-log.ts`
- Test: `packages/devtools/test/commit-log.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/commit-log.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CommitLog } from '../src/commit-log';

describe('CommitLog', () => {
  it('stores entries in order', () => {
    const log = new CommitLog(10);
    log.push({ frame: 1, changedIds: [1], signalWrites: 2, effectRuns: 1 });
    log.push({ frame: 2, changedIds: [], signalWrites: 0, effectRuns: 0 });
    expect(log.entries().map((e) => e.frame)).toEqual([1, 2]);
  });

  it('evicts oldest beyond capacity', () => {
    const log = new CommitLog(2);
    log.push({ frame: 1, changedIds: [], signalWrites: 0, effectRuns: 0 });
    log.push({ frame: 2, changedIds: [], signalWrites: 0, effectRuns: 0 });
    log.push({ frame: 3, changedIds: [], signalWrites: 0, effectRuns: 0 });
    expect(log.entries().map((e) => e.frame)).toEqual([2, 3]);
  });

  it('clears', () => {
    const log = new CommitLog();
    log.push({ frame: 1, changedIds: [], signalWrites: 0, effectRuns: 0 });
    log.clear();
    expect(log.entries()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/commit-log.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/devtools/src/commit-log.ts`:
```ts
export interface CommitEntry {
  frame: number;
  changedIds: number[];
  signalWrites: number;
  effectRuns: number;
}

export class CommitLog {
  private buf: CommitEntry[] = [];
  constructor(private capacity = 100) {}

  push(entry: CommitEntry): void {
    this.buf.push(entry);
    if (this.buf.length > this.capacity) this.buf.shift();
  }

  entries(): CommitEntry[] {
    return this.buf.slice();
  }

  clear(): void {
    this.buf = [];
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test -- packages/devtools/test/commit-log.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/commit-log.ts packages/devtools/test/commit-log.test.ts
git commit -m "feat(devtools): commit log ring buffer"
```

---

## Task 7: Reactivity dev hooks (core instrumentation)

**Files:**
- Modify: `packages/reactivity/src/core.ts`
- Modify: `packages/reactivity/src/signal.ts:20-31`
- Modify: `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/dev-hooks.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/dev-hooks.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createSignal, createEffect, createRoot } from '../src/index';
import { setReactiveDevHooks } from '../src/core';

afterEach(() => setReactiveDevHooks(null));

describe('reactive dev hooks', () => {
  it('fires onSignalCreate when a signal is created', () => {
    let created = 0;
    setReactiveDevHooks({ onSignalCreate: () => { created++; } });
    createSignal(0);
    expect(created).toBe(1);
  });

  it('fires onSignalWrite with prev and next on a real change', () => {
    const writes: Array<[unknown, unknown]> = [];
    setReactiveDevHooks({ onSignalWrite: (_n, prev, next) => { writes.push([prev, next]); } });
    const [, set] = createSignal(1);
    set(2);
    set(2); // no-op (equal) — must not fire
    expect(writes).toEqual([[1, 2]]);
  });

  it('fires onComputationRun when an effect runs', () => {
    let runs = 0;
    setReactiveDevHooks({ onComputationRun: (n) => { if ((n as { isEffect?: boolean }).isEffect) runs++; } });
    createRoot(() => {
      const [get, set] = createSignal(0);
      createEffect(() => { get(); });
      set(1);
    });
    expect(runs).toBeGreaterThanOrEqual(2); // initial run + after set
  });

  it('does nothing after hooks are cleared', () => {
    let created = 0;
    setReactiveDevHooks({ onSignalCreate: () => { created++; } });
    setReactiveDevHooks(null);
    createSignal(0);
    expect(created).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/reactivity/test/dev-hooks.test.ts`
Expected: FAIL (`setReactiveDevHooks` not exported).

- [ ] **Step 3: Add hook plumbing in `core.ts`**

In `packages/reactivity/src/core.ts`, after the `defaultEquals` export (line ~5), add:
```ts
// ---- dev hooks (null in production; set only by @cairn/devtools) ----
export interface ReactiveDevHooks {
  onSignalCreate?(node: SignalState<unknown>): void;
  onSignalWrite?(node: SignalState<unknown>, prev: unknown, next: unknown): void;
  onComputationRun?(node: Computation<unknown>): void;
}
let devHooks: ReactiveDevHooks | null = null;
export function setReactiveDevHooks(h: ReactiveDevHooks | null): void { devHooks = h; }
export function runSignalCreateHook(node: SignalState<unknown>): void {
  if (devHooks && devHooks.onSignalCreate) devHooks.onSignalCreate(node);
}
```

In `writeSignal`, change the mutation block so the hook fires before assignment:
```ts
export function writeSignal<T>(node: SignalState<T>, value: T): T {
  if (node.equals === false || !node.equals(node.value, value)) {
    if (devHooks && devHooks.onSignalWrite) devHooks.onSignalWrite(node as SignalState<unknown>, node.value, value);
    node.value = value;
    const observers = node.observers;
    if (observers && observers.length) {
      runUpdates(() => {
        for (let i = 0; i < observers.length; i++) markDirty(observers[i], STALE);
      });
    }
  }
  return value;
}
```

In `runComputation`, add the hook as the first statement inside the function body (before `cleanNode(node)`):
```ts
function runComputation<T>(node: Computation<T>): void {
  if (devHooks && devHooks.onComputationRun) devHooks.onComputationRun(node as Computation<unknown>);
  cleanNode(node);
  // ...rest unchanged
```

- [ ] **Step 4: Fire create hook from `signal.ts`**

In `packages/reactivity/src/signal.ts`, add `runSignalCreateHook` to the import from `./core` and call it right after the node is created:
```ts
import {
  type SignalState,
  type EqualsFn,
  readSource,
  writeSignal,
  defaultEquals,
  runSignalCreateHook,
} from './core';
```
Inside `createSignal`, after `const node: SignalState<T> = { ... };`:
```ts
  runSignalCreateHook(node as SignalState<unknown>);
```

- [ ] **Step 5: Export from index and run tests**

In `packages/reactivity/src/index.ts`, add:
```ts
export { setReactiveDevHooks } from './core';
export type { ReactiveDevHooks } from './core';
```

Run: `pnpm test -- packages/reactivity/test/dev-hooks.test.ts`
Expected: 4 tests pass.
Run: `pnpm test -- packages/reactivity`
Expected: all existing reactivity tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/reactivity/src/core.ts packages/reactivity/src/signal.ts packages/reactivity/src/index.ts packages/reactivity/test/dev-hooks.test.ts
git commit -m "feat(reactivity): null-guarded dev hooks (signal create/write, computation run)"
```

---

## Task 8: Why-frame tracker (`why-frame.ts`)

**Files:**
- Create: `packages/devtools/src/why-frame.ts`
- Test: `packages/devtools/test/why-frame.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/why-frame.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createSignal, createEffect, createRoot, setReactiveDevHooks } from '@cairn/reactivity';
import { WhyFrameTracker } from '../src/why-frame';

afterEach(() => setReactiveDevHooks(null));

describe('WhyFrameTracker', () => {
  it('counts signal writes and effect runs, then resets on take', () => {
    const tracker = new WhyFrameTracker();
    tracker.start();
    createRoot(() => {
      const [get, set] = createSignal(0);
      createEffect(() => { get(); });
      set(1);
      set(2);
    });
    const first = tracker.take();
    expect(first.signalWrites).toBe(2);
    expect(first.effectRuns).toBeGreaterThanOrEqual(1);
    const second = tracker.take();
    expect(second).toEqual({ signalWrites: 0, effectRuns: 0 });
    tracker.stop();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/why-frame.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/devtools/src/why-frame.ts`:
```ts
import { setReactiveDevHooks } from '@cairn/reactivity';

export class WhyFrameTracker {
  private signalWrites = 0;
  private effectRuns = 0;

  start(): void {
    setReactiveDevHooks({
      onSignalWrite: () => { this.signalWrites++; },
      onComputationRun: (n) => { if ((n as { isEffect?: boolean }).isEffect) this.effectRuns++; },
    });
  }

  stop(): void {
    setReactiveDevHooks(null);
  }

  take(): { signalWrites: number; effectRuns: number } {
    const result = { signalWrites: this.signalWrites, effectRuns: this.effectRuns };
    this.signalWrites = 0;
    this.effectRuns = 0;
    return result;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test -- packages/devtools/test/why-frame.test.ts`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/why-frame.ts packages/devtools/test/why-frame.test.ts
git commit -m "feat(devtools): why-frame tracker (signal write / effect run counts)"
```

---

## Task 9: Runtime commit hook (core instrumentation)

**Files:**
- Create: `packages/runtime/src/devtools-hook.ts`
- Modify: `packages/runtime/src/instance.ts:12-26`
- Modify: `packages/runtime/src/mount.ts:55-60`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/devtools-commit.test.ts`

- [ ] **Step 1: Inspect the existing fake host**

Read `packages/runtime/test/fake-host.ts` and note the exact factory export name and signature (used by this task and Task 12). The test below assumes `makeFakeHost(width, height)`; if the real export differs (e.g. `createFakeHost()` with metrics set differently), adapt the import and construction accordingly. The fake host must expose `metrics.width/height` + `metrics.onResize`, a `renderer` with `beginFrame/clear/endFrame/measureText`, and `scheduler.requestFrame` running synchronously.

- [ ] **Step 2: Write the failing test**

`packages/runtime/test/devtools-commit.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '../src/mount';
import { setRuntimeDevHooks } from '../src/devtools-hook';
import type { Instance } from '../src/instance';
import { makeFakeHost } from './fake-host';

afterEach(() => setRuntimeDevHooks(null));

describe('runtime commit hook', () => {
  it('calls onCommit with the app root and viewport after a frame', () => {
    const calls: Array<{ root: Instance; viewport: { w: number; h: number } }> = [];
    setRuntimeDevHooks({ onCommit: (root, viewport) => calls.push({ root, viewport }) });

    const host = makeFakeHost(200, 100);
    const app: Instance = {
      layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, layout: () => ({ w: 200, h: 100 }) } as any,
      children: [], paintSelf() {},
    };
    const dispose = mount(() => app, host);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].root).toBe(app);
    expect(calls[0].viewport).toEqual({ w: 200, h: 100 });
    dispose();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/runtime/test/devtools-commit.test.ts`
Expected: FAIL (`../src/devtools-hook` not found).

- [ ] **Step 4: Create the hook module**

`packages/runtime/src/devtools-hook.ts`:
```ts
import type { Instance } from './instance';

export interface RuntimeDevHooks {
  onCommit(root: Instance, viewport: { w: number; h: number }): void;
}

let hooks: RuntimeDevHooks | null = null;

export function setRuntimeDevHooks(h: RuntimeDevHooks | null): void {
  hooks = h;
}

export function emitCommit(root: Instance, viewport: { w: number; h: number }): void {
  if (hooks) hooks.onCommit(root, viewport);
}
```

- [ ] **Step 5: Add `debugName` to Instance**

In `packages/runtime/src/instance.ts`, inside the `Instance` interface (after `transformOrigin`), add:
```ts
  /** Dev-only human-readable name for devtools; ignored in production. */
  debugName?: string;
```

- [ ] **Step 6: Emit the commit from `mount`**

In `packages/runtime/src/mount.ts`, add the import near the other scheduler import:
```ts
import { emitCommit } from './devtools-hook';
```
In `renderFrame`, after `host.renderer.endFrame();`:
```ts
      host.renderer.endFrame();
      emitCommit(root, ctx.viewport);
```

- [ ] **Step 7: Export from runtime index and run tests**

In `packages/runtime/src/index.ts`, add:
```ts
export { setRuntimeDevHooks } from './devtools-hook';
export type { RuntimeDevHooks } from './devtools-hook';
```

Run: `pnpm test -- packages/runtime/test/devtools-commit.test.ts`
Expected: 1 test passes.
Run: `pnpm test -- packages/runtime`
Expected: existing runtime tests still pass.

- [ ] **Step 8: Commit**

```bash
git add packages/runtime/src/devtools-hook.ts packages/runtime/src/instance.ts packages/runtime/src/mount.ts packages/runtime/src/index.ts packages/runtime/test/devtools-commit.test.ts
git commit -m "feat(runtime): per-commit devtools hook + Instance.debugName"
```

---

## Task 10: Find-by-id helper (`find.ts`)

**Files:**
- Create: `packages/devtools/src/find.ts`
- Test: `packages/devtools/test/find.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/find.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { findNode } from '../src/find';

function n(id: number, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect: { x: 0, y: 0, w: 1, h: 1 }, size: { w: 1, h: 1 }, offset: { x: 0, y: 0 },
    layout: { flex: 0, zIndex: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('findNode', () => {
  const tree = n(1, [n(2), n(3, [n(4)])]);
  it('finds a nested node by id', () => expect(findNode(tree, 4)?.id).toBe(4));
  it('finds the root', () => expect(findNode(tree, 1)?.id).toBe(1));
  it('returns null for a missing id', () => expect(findNode(tree, 99)).toBeNull());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/find.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/devtools/src/find.ts`:
```ts
import type { SnapshotNode } from './protocol';

export function findNode(root: SnapshotNode, id: number): SnapshotNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test -- packages/devtools/test/find.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/find.ts packages/devtools/test/find.test.ts
git commit -m "feat(devtools): findNode snapshot lookup by id"
```

---

## Task 11: Hit-test picking + coordinate math (`pick.ts`, `highlight.ts`)

**Files:**
- Create: `packages/devtools/src/highlight.ts`
- Create: `packages/devtools/src/pick.ts`
- Test: `packages/devtools/test/highlight.test.ts`
- Test: `packages/devtools/test/pick.test.ts`

- [ ] **Step 1: Write the failing highlight-math test**

`packages/devtools/test/highlight.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { canvasRectToPage, pagePointToCanvas } from '../src/highlight';

function fakeCanvas(box: { left: number; top: number; width: number; height: number }): HTMLCanvasElement {
  return { getBoundingClientRect: () => box } as unknown as HTMLCanvasElement;
}

describe('coordinate math', () => {
  it('maps a canvas-space rect to page px (1:1 css size)', () => {
    const canvas = fakeCanvas({ left: 10, top: 20, width: 200, height: 100 });
    const page = canvasRectToPage(canvas, { x: 5, y: 5, w: 50, h: 25 }, { w: 200, h: 100 });
    expect(page).toEqual({ x: 15, y: 25, w: 50, h: 25 });
  });
  it('scales when the canvas is css-resized', () => {
    const canvas = fakeCanvas({ left: 0, top: 0, width: 400, height: 200 });
    const page = canvasRectToPage(canvas, { x: 10, y: 10, w: 20, h: 20 }, { w: 200, h: 100 });
    expect(page).toEqual({ x: 20, y: 20, w: 40, h: 40 });
  });
  it('inverts page point back to canvas space', () => {
    const canvas = fakeCanvas({ left: 0, top: 0, width: 400, height: 200 });
    const p = pagePointToCanvas(canvas, 20, 20, { w: 200, h: 100 });
    expect(p).toEqual({ x: 10, y: 10 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/highlight.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `highlight.ts`**

`packages/devtools/src/highlight.ts`:
```ts
import type { Rect } from './protocol';

export function canvasRectToPage(
  canvas: HTMLCanvasElement,
  rect: Rect,
  viewport: { w: number; h: number },
): Rect {
  const b = canvas.getBoundingClientRect();
  const sx = viewport.w ? b.width / viewport.w : 1;
  const sy = viewport.h ? b.height / viewport.h : 1;
  return { x: b.left + rect.x * sx, y: b.top + rect.y * sy, w: rect.w * sx, h: rect.h * sy };
}

export function pagePointToCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  viewport: { w: number; h: number },
): { x: number; y: number } {
  const b = canvas.getBoundingClientRect();
  const sx = b.width ? viewport.w / b.width : 1;
  const sy = b.height ? viewport.h / b.height : 1;
  return { x: (clientX - b.left) * sx, y: (clientY - b.top) * sy };
}

/** A fixed-position DOM overlay drawn over the canvas to outline a node. */
export class Highlighter {
  private el: HTMLDivElement | null = null;

  constructor(private canvas: HTMLCanvasElement) {}

  private ensure(): HTMLDivElement {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:2147483646',
      'background:rgba(80,140,255,0.25)', 'border:1px solid rgba(80,140,255,0.9)',
      'box-sizing:border-box', 'display:none',
    ].join(';');
    document.body.appendChild(el);
    this.el = el;
    return el;
  }

  show(rect: Rect, viewport: { w: number; h: number }): void {
    const el = this.ensure();
    const p = canvasRectToPage(this.canvas, rect, viewport);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.width = `${p.w}px`;
    el.style.height = `${p.h}px`;
    el.style.display = 'block';
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }

  dispose(): void {
    if (this.el) { this.el.remove(); this.el = null; }
  }
}
```

- [ ] **Step 4: Write the failing hit-test test**

`packages/devtools/test/pick.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { hitTest } from '../src/pick';

function n(id: number, rect: { x: number; y: number; w: number; h: number }, zIndex = 0, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect, size: { w: rect.w, h: rect.h }, offset: { x: rect.x, y: rect.y },
    layout: { flex: 0, zIndex, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('hitTest', () => {
  it('returns null when the point is outside the root', () => {
    expect(hitTest(n(1, { x: 0, y: 0, w: 10, h: 10 }), 50, 50)).toBeNull();
  });
  it('returns the deepest node containing the point', () => {
    const child = n(2, { x: 2, y: 2, w: 4, h: 4 });
    const root = n(1, { x: 0, y: 0, w: 20, h: 20 }, 0, [child]);
    expect(hitTest(root, 3, 3)?.id).toBe(2);
  });
  it('returns the root when no child contains the point', () => {
    const child = n(2, { x: 2, y: 2, w: 4, h: 4 });
    const root = n(1, { x: 0, y: 0, w: 20, h: 20 }, 0, [child]);
    expect(hitTest(root, 15, 15)?.id).toBe(1);
  });
  it('prefers the higher zIndex sibling on overlap', () => {
    const low = n(2, { x: 0, y: 0, w: 10, h: 10 }, 0);
    const high = n(3, { x: 0, y: 0, w: 10, h: 10 }, 5);
    const root = n(1, { x: 0, y: 0, w: 10, h: 10 }, 0, [low, high]);
    expect(hitTest(root, 5, 5)?.id).toBe(3);
  });
});
```

- [ ] **Step 5: Implement `pick.ts`**

`packages/devtools/src/pick.ts`:
```ts
import type { SnapshotNode } from './protocol';
import { pagePointToCanvas } from './highlight';

function contains(n: SnapshotNode, x: number, y: number): boolean {
  return x >= n.rect.x && x <= n.rect.x + n.rect.w && y >= n.rect.y && y <= n.rect.y + n.rect.h;
}

/** Deepest, top-most (by zIndex then paint order) node containing the point, or null. */
export function hitTest(root: SnapshotNode, x: number, y: number): SnapshotNode | null {
  if (!contains(root, x, y)) return null;
  const ordered = root.children
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.layout.zIndex - b.c.layout.zIndex || a.i - b.i);
  for (let k = ordered.length - 1; k >= 0; k--) {
    const hit = hitTest(ordered[k].c, x, y);
    if (hit) return hit;
  }
  return root;
}

export interface PickCallbacks {
  onHover(id: number | null): void;
  onSelect(id: number): void;
}

/** Wires pointer events on the canvas host element into hit-testing against the latest snapshot. */
export class PickController {
  private active = false;
  private snapshot: SnapshotNode | null = null;
  private readonly onMove = (e: PointerEvent): void => {
    if (!this.snapshot) return;
    const p = pagePointToCanvas(this.canvas, e.clientX, e.clientY, this.viewport());
    const hit = hitTest(this.snapshot, p.x, p.y);
    this.cb.onHover(hit ? hit.id : null);
  };
  private readonly onClick = (e: PointerEvent): void => {
    if (!this.snapshot) return;
    const p = pagePointToCanvas(this.canvas, e.clientX, e.clientY, this.viewport());
    const hit = hitTest(this.snapshot, p.x, p.y);
    if (hit) { this.cb.onSelect(hit.id); this.stop(); }
    e.preventDefault(); e.stopPropagation();
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: () => { w: number; h: number },
    private cb: PickCallbacks,
  ) {}

  update(snapshot: SnapshotNode | null): void { this.snapshot = snapshot; }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.canvas.addEventListener('pointermove', this.onMove, true);
    this.canvas.addEventListener('pointerdown', this.onClick, true);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.canvas.removeEventListener('pointermove', this.onMove, true);
    this.canvas.removeEventListener('pointerdown', this.onClick, true);
    this.cb.onHover(null);
  }
}
```

- [ ] **Step 6: Run both tests**

Run: `pnpm test -- packages/devtools/test/highlight.test.ts packages/devtools/test/pick.test.ts`
Expected: all pass (3 + 4).

- [ ] **Step 7: Commit**

```bash
git add packages/devtools/src/highlight.ts packages/devtools/src/pick.ts packages/devtools/test/highlight.test.ts packages/devtools/test/pick.test.ts
git commit -m "feat(devtools): hit-test picking + canvas<->page rect math + Highlighter overlay"
```

---

## Task 12: Agent wiring (`agent.ts`) + public exports

**Files:**
- Create: `packages/devtools/src/agent.ts`
- Modify: `packages/devtools/src/index.ts`
- Test: `packages/devtools/test/agent.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/devtools/test/agent.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mount, setRuntimeDevHooks } from '@cairn/runtime';
import type { Instance } from '@cairn/runtime';
import { setReactiveDevHooks } from '@cairn/reactivity';
import { installDevtools, uninstallDevtools } from '../src/agent';
import type { AgentEvent } from '../src/protocol';
import { makeFakeHost } from '../../runtime/test/fake-host';

afterEach(() => {
  uninstallDevtools();
  setRuntimeDevHooks(null);
  setReactiveDevHooks(null);
  delete (globalThis as { __CAIRN_DEVTOOLS_HOOK__?: unknown }).__CAIRN_DEVTOOLS_HOOK__;
});

function appRoot(): Instance {
  return {
    layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, flex: 0, zIndex: 0,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      layout: () => ({ w: 200, h: 100 }), constructor: { name: 'BoxNode' } } as any,
    children: [], paintSelf() {},
  };
}

describe('installDevtools', () => {
  it('publishes a hook on globalThis and emits hello on subscribe', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    expect(hook).toBeTruthy();
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    expect(events[0]).toEqual({ type: 'hello', version: hook.version });
  });

  it('emits a commit event when a mounted app renders a frame', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));

    const host = makeFakeHost(200, 100);
    const dispose = mount(() => appRoot(), host);

    const commit = events.find((e) => e.type === 'commit');
    expect(commit).toBeTruthy();
    if (commit && commit.type === 'commit') {
      expect(commit.snapshot.name).toBe('Box');
      expect(commit.meta.frame).toBeGreaterThanOrEqual(1);
    }
    dispose();
  });

  it('is idempotent', () => {
    installDevtools();
    const first = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    installDevtools();
    expect((globalThis as any).__CAIRN_DEVTOOLS_HOOK__).toBe(first);
  });
});
```

> Note: confirm `makeFakeHost` matches the runtime fake-host export (see Task 9 Step 1). Adjust the import path/name if needed.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/agent.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `agent.ts`**

`packages/devtools/src/agent.ts`:
```ts
import type { Instance } from '@cairn/runtime';
import { setRuntimeDevHooks } from '@cairn/runtime';
import type { AgentEvent, PanelCommand, DevtoolsHook, SnapshotNode } from './protocol';
import { DEVTOOLS_VERSION } from './protocol';
import { serialize } from './serialize';
import { diffSnapshots } from './diff';
import { CommitLog } from './commit-log';
import { WhyFrameTracker } from './why-frame';
import { findNode } from './find';
import { Highlighter } from './highlight';
import { PickController } from './pick';

export interface DevtoolsOptions {
  /** Canvas element for on-page highlight + pick. Optional (headless/tests omit it). */
  canvas?: HTMLCanvasElement;
}

interface AgentState {
  subscribers: Set<(e: AgentEvent) => void>;
  log: CommitLog;
  why: WhyFrameTracker;
  last: SnapshotNode | null;
  lastRoot: Instance | null;
  viewport: { w: number; h: number };
  frame: number;
  highlighter: Highlighter | null;
  pick: PickController | null;
}

let state: AgentState | null = null;

export function installDevtools(opts: DevtoolsOptions = {}): void {
  if (state) return; // idempotent

  const why = new WhyFrameTracker();
  const s: AgentState = {
    subscribers: new Set(),
    log: new CommitLog(),
    why,
    last: null,
    lastRoot: null,
    viewport: { w: 0, h: 0 },
    frame: 0,
    highlighter: opts.canvas ? new Highlighter(opts.canvas) : null,
    pick: null,
  };
  state = s;

  why.start();

  if (opts.canvas) {
    s.pick = new PickController(opts.canvas, () => s.viewport, {
      onHover: (id) => highlight(id),
      onSelect: (id) => emit({ type: 'selection', id }),
    });
  }

  setRuntimeDevHooks({
    onCommit: (root, viewport) => {
      s.viewport = viewport;
      s.lastRoot = root;
      // Lazy: build snapshots only when someone is watching.
      if (s.subscribers.size === 0) { why.take(); return; }
      const snapshot = serialize(root);
      const changed = diffSnapshots(s.last, snapshot);
      const counts = why.take();
      s.frame++;
      s.log.push({ frame: s.frame, changedIds: changed.map((c) => c.id), ...counts });
      s.last = snapshot;
      if (s.pick) s.pick.update(snapshot);
      emit({ type: 'commit', snapshot, changed, meta: { frame: s.frame, ...counts } });
    },
  });

  const hook: DevtoolsHook = {
    version: DEVTOOLS_VERSION,
    subscribe(cb) {
      s.subscribers.add(cb);
      cb({ type: 'hello', version: DEVTOOLS_VERSION });
      return () => s.subscribers.delete(cb);
    },
    send: handleCommand,
    getSnapshot: () => s.last,
  };
  (globalThis as { __CAIRN_DEVTOOLS_HOOK__?: DevtoolsHook }).__CAIRN_DEVTOOLS_HOOK__ = hook;
}

export function uninstallDevtools(): void {
  if (!state) return;
  state.why.stop();
  setRuntimeDevHooks(null);
  if (state.pick) state.pick.stop();
  if (state.highlighter) state.highlighter.dispose();
  delete (globalThis as { __CAIRN_DEVTOOLS_HOOK__?: DevtoolsHook }).__CAIRN_DEVTOOLS_HOOK__;
  state = null;
}

function emit(e: AgentEvent): void {
  if (!state) return;
  for (const cb of state.subscribers) cb(e);
}

function highlight(id: number | null): void {
  if (!state || !state.highlighter) return;
  if (id == null || !state.last) { state.highlighter.hide(); return; }
  const node = findNode(state.last, id);
  if (node) state.highlighter.show(node.rect, state.viewport);
  else state.highlighter.hide();
}

function handleCommand(cmd: PanelCommand): void {
  if (!state) return;
  switch (cmd.type) {
    case 'inspect-start': state.pick?.start(); break;
    case 'inspect-stop': state.pick?.stop(); break;
    case 'highlight': highlight(cmd.id); break;
    case 'select': highlight(cmd.id); emit({ type: 'selection', id: cmd.id }); break;
    case 'get-snapshot':
      if (state.last) {
        emit({ type: 'commit', snapshot: state.last, changed: [], meta: { frame: state.frame, signalWrites: 0, effectRuns: 0 } });
      }
      break;
  }
}
```

- [ ] **Step 4: Export from index**

Replace `packages/devtools/src/index.ts` with:
```ts
export * from './protocol';
export { installDevtools, uninstallDevtools } from './agent';
export type { DevtoolsOptions } from './agent';
export { serialize } from './serialize';
export { diffSnapshots } from './diff';
export { hitTest } from './pick';
export { findNode } from './find';
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test -- packages/devtools`
Expected: all devtools tests pass.
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/agent.ts packages/devtools/src/index.ts packages/devtools/test/agent.test.ts
git commit -m "feat(devtools): agent — installDevtools wires hooks, snapshot, commands, hook global"
```

---

## Task 13: Example app `examples/devtools-demo`

**Files:**
- Create: `examples/devtools-demo/index.html`
- Create: `examples/devtools-demo/main.tsx`

- [ ] **Step 1: Inspect an existing example**

Read `examples/mt-showcase/index.html` and `examples/mt-showcase/main.tsx` for the exact host bootstrap (`createWebHost`) and how examples are served (root `vite` dev server, or an example `package.json` / script). Mirror that setup for `devtools-demo`.

- [ ] **Step 2: Create the demo HTML**

`examples/devtools-demo/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Cairn DevTools Demo</title>
    <style>html,body{margin:0}#stage{display:block}</style>
  </head>
  <body>
    <canvas id="stage" width="800" height="600"></canvas>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create the demo app that installs devtools**

`examples/devtools-demo/main.tsx`:
```tsx
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { installDevtools } from '@cairn/devtools';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

// Install devtools BEFORE mount so the very first commit is captured.
installDevtools({ canvas });

function App() {
  const [count, setCount] = createSignal(0);
  return Column({
    mainAxisSize: 'min',
    style: { gap: 16, padding: 24 },
    children: [
      Text({ style: { font: '600 20px sans-serif', color: '#202124' }, children: 'DevTools demo' }),
      Row({
        mainAxisSize: 'min',
        style: { gap: 12, alignY: 'center' },
        children: [
          Box({
            style: { padding: { left: 16, right: 16, top: 8, bottom: 8 }, backgroundColor: '#1a73e8', borderRadius: 6, cursor: 'pointer' },
            focusable: true,
            onClick: () => setCount((c) => c + 1),
            children: Text({ style: { color: '#fff', font: '500 14px sans-serif' }, children: 'Increment' }),
          }),
          Text({ style: { font: '16px sans-serif', color: '#202124' }, children: () => `count: ${count()}` }),
        ],
      }),
    ],
  });
}

mount(App, host);
```

- [ ] **Step 4: Verify it runs in the browser**

Start the dev server the same way other examples run (mirror what you found in Step 1). Open the page, then in the browser console run:
```js
const evts = []; __CAIRN_DEVTOOLS_HOOK__.subscribe(e => evts.push(e));
__CAIRN_DEVTOOLS_HOOK__.send({ type: 'get-snapshot' });
console.log(evts.at(-1));
```
Expected: a `commit` event whose `snapshot` is a tree with `name: 'Column'` at the root and nested `Row`/`Text`/`Box` children.
Then: `__CAIRN_DEVTOOLS_HOOK__.send({ type: 'inspect-start' })` and hover the canvas — a blue highlight box tracks the hovered node; clicking selects it and emits a `selection` event.

- [ ] **Step 5: Commit**

```bash
git add examples/devtools-demo
git commit -m "example(devtools): demo app installing @cairn/devtools with pick/highlight"
```

---

## Task 14: Extension scaffold — manifest, build, bridge (injected/content/devtools)

**Files:**
- Create: `devtools-extension/package.json`
- Create: `devtools-extension/manifest.json`
- Create: `devtools-extension/build.mjs`
- Create: `devtools-extension/src/bridge.ts`
- Create: `devtools-extension/src/injected.ts`
- Create: `devtools-extension/src/content.ts`
- Create: `devtools-extension/src/devtools.ts`
- Create: `devtools-extension/src/devtools.html`

- [ ] **Step 1: Shared bridge envelope**

`devtools-extension/src/bridge.ts`:
```ts
import type { AgentEvent, PanelCommand } from '@cairn/devtools';

export const SOURCE_PAGE = 'cairn-devtools-page';
export const SOURCE_PANEL = 'cairn-devtools-panel';

export interface PageMessage { source: typeof SOURCE_PAGE; event: AgentEvent }
export interface PanelMessage { source: typeof SOURCE_PANEL; command: PanelCommand }
```

- [ ] **Step 2: Injected script (runs in page world)**

`devtools-extension/src/injected.ts`:
```ts
import { SOURCE_PAGE, SOURCE_PANEL, type PanelMessage } from './bridge';
import type { DevtoolsHook } from '@cairn/devtools';

declare global {
  interface Window { __CAIRN_DEVTOOLS_HOOK__?: DevtoolsHook }
}

function connect(hook: DevtoolsHook): void {
  hook.subscribe((event) => {
    window.postMessage({ source: SOURCE_PAGE, event }, '*');
  });
  window.addEventListener('message', (e) => {
    const data = e.data as PanelMessage | undefined;
    if (data && data.source === SOURCE_PANEL) hook.send(data.command);
  });
}

const existing = window.__CAIRN_DEVTOOLS_HOOK__;
if (existing) {
  connect(existing);
} else {
  // Agent may install after the page script runs; poll briefly.
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const hook = window.__CAIRN_DEVTOOLS_HOOK__;
    if (hook) { clearInterval(timer); connect(hook); }
    else if (tries > 40) clearInterval(timer); // ~10s
  }, 250);
}
```

- [ ] **Step 3: Content script (isolated world ↔ runtime port)**

`devtools-extension/src/content.ts`:
```ts
import { SOURCE_PAGE, SOURCE_PANEL, type PageMessage } from './bridge';

// Inject the page-world script.
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();

const port = chrome.runtime.connect({ name: 'cairn-devtools' });

// page -> panel
window.addEventListener('message', (e) => {
  const data = e.data as PageMessage | undefined;
  if (data && data.source === SOURCE_PAGE) port.postMessage(data.event);
});

// panel -> page
port.onMessage.addListener((command) => {
  window.postMessage({ source: SOURCE_PANEL, command }, '*');
});
```

- [ ] **Step 4: DevTools page (creates the panel)**

`devtools-extension/src/devtools.ts`:
```ts
chrome.devtools.panels.create('Cairn', '', 'panel.html');
```

`devtools-extension/src/devtools.html`:
```html
<!doctype html><html><head><meta charset="utf-8" /></head>
<body><script src="devtools.js"></script></body></html>
```

- [ ] **Step 5: Manifest (MV3)**

`devtools-extension/manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Cairn DevTools",
  "version": "0.0.1",
  "description": "Inspector for Cairn canvas apps.",
  "devtools_page": "devtools.html",
  "content_scripts": [
    { "matches": ["<all_urls>"], "js": ["content.js"], "run_at": "document_start" }
  ],
  "web_accessible_resources": [
    { "resources": ["injected.js"], "matches": ["<all_urls>"] }
  ],
  "permissions": []
}
```

- [ ] **Step 6: Build script + package.json**

`devtools-extension/package.json`:
```json
{
  "name": "cairn-devtools-extension",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": { "build": "node build.mjs" },
  "dependencies": { "@cairn/devtools": "workspace:*" },
  "devDependencies": { "esbuild": "^0.23.0", "@types/chrome": "^0.0.270" }
}
```

`devtools-extension/build.mjs`:
```js
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

const outdir = 'dist';
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: {
    injected: 'src/injected.ts',
    content: 'src/content.ts',
    devtools: 'src/devtools.ts',
    panel: 'src/panel/panel.ts',
  },
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outdir,
});

// Static assets
cpSync('manifest.json', `${outdir}/manifest.json`);
cpSync('src/panel/panel.html', `${outdir}/panel.html`);
cpSync('src/panel/panel.css', `${outdir}/panel.css`);
cpSync('src/devtools.html', `${outdir}/devtools.html`);

console.log('Built extension to', outdir);
```

- [ ] **Step 7: Defer the build check**

`build.mjs` references `src/panel/panel.ts` + `panel.html/css` (created in Task 15). Run the build in Task 15, not here.

- [ ] **Step 8: Commit**

```bash
git add devtools-extension/package.json devtools-extension/manifest.json devtools-extension/build.mjs devtools-extension/src/bridge.ts devtools-extension/src/injected.ts devtools-extension/src/content.ts devtools-extension/src/devtools.ts devtools-extension/src/devtools.html
git commit -m "feat(extension): MV3 scaffold — manifest, build, injected/content/devtools bridge"
```

---

## Task 15: Extension panel UI (tree / props / commit log / inspect)

Panel code uses **only** `textContent` / DOM builders — never `innerHTML` — because node names and semantic labels originate from the inspected app and would be an XSS vector.

**Files:**
- Create: `devtools-extension/src/panel/panel.html`
- Create: `devtools-extension/src/panel/panel.css`
- Create: `devtools-extension/src/panel/panel.ts`

- [ ] **Step 1: Panel HTML**

`devtools-extension/src/panel/panel.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><link rel="stylesheet" href="panel.css" /></head>
  <body>
    <div id="toolbar">
      <button id="inspect">Inspect</button>
      <span id="status">Cairn: connecting…</span>
    </div>
    <div id="main">
      <div id="tree"></div>
      <div id="side">
        <div id="props"></div>
        <div id="log"></div>
      </div>
    </div>
    <script src="panel.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Panel CSS**

`devtools-extension/src/panel/panel.css`:
```css
* { box-sizing: border-box; }
body { margin: 0; font: 12px/1.5 -apple-system, sans-serif; color: #202124; }
#toolbar { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-bottom: 1px solid #ddd; }
#status { color: #5f6368; }
#main { display: flex; height: calc(100vh - 33px); }
#tree { flex: 1; overflow: auto; padding: 4px; }
#side { width: 300px; border-left: 1px solid #ddd; overflow: auto; }
#props, #log { padding: 8px; border-bottom: 1px solid #eee; }
.row { white-space: pre; cursor: pointer; padding: 1px 4px; border-radius: 3px; }
.row:hover { background: #eef3ff; }
.row.selected { background: #d7e6ff; }
.row.changed { outline: 1px solid #f9ab00; }
.kv { display: flex; justify-content: space-between; gap: 8px; }
.kv b { color: #5f6368; font-weight: 500; }
.commit { font-variant-numeric: tabular-nums; color: #5f6368; }
```

- [ ] **Step 3: Panel logic (no innerHTML — DOM builders only)**

`devtools-extension/src/panel/panel.ts`:
```ts
import type { AgentEvent, PanelCommand, SnapshotNode, ChangedNode, CommitMeta } from '@cairn/devtools';

const treeEl = document.getElementById('tree') as HTMLDivElement;
const propsEl = document.getElementById('props') as HTMLDivElement;
const logEl = document.getElementById('log') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const inspectBtn = document.getElementById('inspect') as HTMLButtonElement;

let snapshot: SnapshotNode | null = null;
let selectedId: number | null = null;
let changedIds = new Set<number>();
let inspecting = false;

const port = chrome.runtime.connect({ name: 'cairn-panel' });
port.postMessage({ tabId: chrome.devtools.inspectedWindow.tabId });
port.onMessage.addListener((event: AgentEvent) => handleEvent(event));

function send(command: PanelCommand): void { port.postMessage({ command }); }

function handleEvent(event: AgentEvent): void {
  if (event.type === 'hello') {
    statusEl.textContent = `Cairn detected (agent ${event.version})`;
    send({ type: 'get-snapshot' });
  } else if (event.type === 'commit') {
    snapshot = event.snapshot;
    changedIds = new Set(event.changed.map((c: ChangedNode) => c.id));
    renderTree();
    renderProps();
    appendCommit(event.meta);
  } else if (event.type === 'selection') {
    selectedId = event.id;
    renderTree();
    renderProps();
  }
}

function renderTree(): void {
  treeEl.replaceChildren();
  if (snapshot) renderNode(snapshot, 0);
}

function renderNode(node: SnapshotNode, depth: number): void {
  const row = document.createElement('div');
  row.className = 'row'
    + (node.id === selectedId ? ' selected' : '')
    + (changedIds.has(node.id) ? ' changed' : '');
  const dims = `${Math.round(node.rect.w)}x${Math.round(node.rect.h)}`;
  row.textContent = `${'  '.repeat(depth)}${node.name}  ${dims}`;
  row.onclick = () => { selectedId = node.id; send({ type: 'select', id: node.id }); renderTree(); renderProps(); };
  row.onmouseenter = () => send({ type: 'highlight', id: node.id });
  row.onmouseleave = () => send({ type: 'highlight', id: null });
  treeEl.appendChild(row);
  for (const child of node.children) renderNode(child, depth + 1);
}

function findNode(node: SnapshotNode | null, id: number): SnapshotNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children) { const f = findNode(c, id); if (f) return f; }
  return null;
}

function kv(k: string, v: string): void {
  const row = document.createElement('div');
  row.className = 'kv';
  const key = document.createElement('b');
  key.textContent = k;
  const val = document.createElement('span');
  val.textContent = v;
  row.append(key, val);
  propsEl.appendChild(row);
}

function renderProps(): void {
  propsEl.replaceChildren();
  const node = selectedId != null ? findNode(snapshot, selectedId) : null;
  if (!node) { propsEl.textContent = 'Select a node'; return; }
  kv('name', node.name);
  kv('rect', `${r(node.rect.x)}, ${r(node.rect.y)} · ${r(node.rect.w)}x${r(node.rect.h)}`);
  kv('offset', `${r(node.offset.x)}, ${r(node.offset.y)}`);
  kv('flex', String(node.layout.flex));
  kv('zIndex', String(node.layout.zIndex));
  kv('opacity', String(node.flags.opacity));
  kv('clip', String(node.flags.clip));
  kv('transform', String(node.flags.transform));
  kv('focusable', String(node.flags.focusable));
  kv('pointerEvents', node.flags.pointerEvents);
  if (node.semantics) kv('role', node.semantics.role + (node.semantics.label ? ` "${node.semantics.label}"` : ''));
}

function appendCommit(meta: CommitMeta): void {
  const line = document.createElement('div');
  line.className = 'commit';
  line.textContent = `#${meta.frame}  signals:${meta.signalWrites}  effects:${meta.effectRuns}  changed:${changedIds.size}`;
  logEl.prepend(line);
  while (logEl.childElementCount > 50) logEl.lastElementChild?.remove();
}

function r(n: number): number { return Math.round(n); }

inspectBtn.onclick = () => {
  inspecting = !inspecting;
  inspectBtn.style.background = inspecting ? '#d7e6ff' : '';
  send({ type: inspecting ? 'inspect-start' : 'inspect-stop' });
};
```

> The panel↔page relay is written as a direct port here. If Chrome needs a background service worker to route messages between the content-script port and the devtools port for the correct tab, add the background relay in Task 16 (its Step 1 covers this) — do it if the panel shows "connecting…" and never receives `hello`.

- [ ] **Step 4: Build the extension**

Run: `cd devtools-extension && pnpm install && pnpm build`
Expected: `dist/` contains `manifest.json`, `injected.js`, `content.js`, `devtools.js`, `devtools.html`, `panel.js`, `panel.html`, `panel.css` with no esbuild errors.

- [ ] **Step 5: Commit**

```bash
git add devtools-extension/src/panel
git commit -m "feat(extension): panel UI — tree, props, commit log, inspect toggle (DOM-safe)"
```

---

## Task 16: Extension background relay (if needed) + README + manual verify

**Files:**
- Create (conditional): `devtools-extension/src/background.ts`
- Modify (conditional): `devtools-extension/manifest.json`, `devtools-extension/build.mjs`
- Create: `devtools-extension/README.md`

- [ ] **Step 1: Add the background relay if the panel isn't receiving events**

Only if the Task 15 note triggered (panel stuck at "connecting…"). `devtools-extension/src/background.ts`:
```ts
// Relays messages between content-script ports (keyed by tabId) and panel ports.
interface PanelPort { port: chrome.runtime.Port; tabId: number }

const contentPorts = new Map<number, chrome.runtime.Port>();
const panelPorts: PanelPort[] = [];

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'cairn-devtools') {
    const tabId = port.sender?.tab?.id;
    if (tabId == null) return;
    contentPorts.set(tabId, port);
    port.onMessage.addListener((event) => {
      for (const p of panelPorts) if (p.tabId === tabId) p.port.postMessage(event);
    });
    port.onDisconnect.addListener(() => contentPorts.delete(tabId));
  } else if (port.name === 'cairn-panel') {
    const rec: PanelPort = { port, tabId: -1 };
    panelPorts.push(rec);
    port.onMessage.addListener((msg: { tabId?: number; command?: unknown }) => {
      if (typeof msg.tabId === 'number') { rec.tabId = msg.tabId; return; }
      if (msg.command != null) contentPorts.get(rec.tabId)?.postMessage(msg.command);
    });
    port.onDisconnect.addListener(() => {
      const i = panelPorts.indexOf(rec); if (i >= 0) panelPorts.splice(i, 1);
    });
  }
});
```
Then in `manifest.json` add (top level):
```json
  "background": { "service_worker": "background.js" },
```
and in `build.mjs` add `background: 'src/background.ts'` to `entryPoints`.

> If the background relay is added, the content script's `port.onMessage` (which currently expects raw commands) and the panel's `send`/`postMessage` shapes must match what the relay forwards: relay forwards the panel's `msg.command` object straight to the content port, and the content script already re-wraps it as `{ source: SOURCE_PANEL, command }`. This is consistent with Task 14/15 as written — no change needed there.

- [ ] **Step 2: Write the README with load + manual-verify steps**

`devtools-extension/README.md`:
```markdown
# Cairn DevTools (Chrome extension)

Inspector panel for Cairn canvas apps.

## Build

    pnpm install
    pnpm build     # outputs ./dist

## Load in Chrome

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `devtools-extension/dist`.
3. Open a page running a Cairn app that calls `installDevtools()` in dev
   (e.g. `examples/devtools-demo`).
4. Open DevTools (F12) → **Cairn** panel.

## Manual verification checklist

- [ ] Panel status shows "Cairn detected".
- [ ] Tree shows the instance hierarchy with names + dimensions.
- [ ] Clicking a node fills the properties pane (rect/offset/flex/z/flags/role).
- [ ] Hovering a tree row draws a highlight box on the canvas.
- [ ] "Inspect" then hovering the canvas highlights nodes; clicking selects
      the node in the tree.
- [ ] Interacting with the app (e.g. Increment) appends commit-log lines with
      signal/effect counts and marks changed nodes (orange outline).
```

- [ ] **Step 3: Rebuild + reload, run the manual checklist**

Run: `cd devtools-extension && pnpm build`
Then load `dist/` in Chrome against `examples/devtools-demo` and tick every checklist item. Fix issues before committing (most likely the background relay from Step 1).

- [ ] **Step 4: Commit**

```bash
git add devtools-extension/README.md
git add devtools-extension/src/background.ts devtools-extension/manifest.json devtools-extension/build.mjs 2>/dev/null || true
git commit -m "docs(extension): README + load/verify checklist; background relay if needed"
```

---

## Task 17: Playwright integration smoke for the agent

**Files:**
- Create: `packages/devtools/test/integration/agent-browser.spec.ts` (or the repo's existing e2e location)

- [ ] **Step 1: Check for an existing Playwright setup**

Search for `playwright` in the repo (`package.json`, any `playwright.config.*`, existing `*.spec.ts`). If a convention exists, follow it. Otherwise add `@playwright/test` as a root dev dependency, a minimal `playwright.config.ts` with a `webServer` that serves `examples/devtools-demo` and `use.baseURL`, and a `test:e2e` script. Note in the commit that these tests are excluded from the vitest `include` glob (they live under `test/integration/` and use `.spec.ts`; the vitest config matches `test/**/*.test.ts`, so `.spec.ts` is already excluded).

- [ ] **Step 2: Write the browser smoke test**

`packages/devtools/test/integration/agent-browser.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

// Assumes examples/devtools-demo is served at baseURL (see playwright.config webServer).
test('agent hook emits a commit snapshot', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    if (!hook) return { ok: false };
    const events: any[] = [];
    hook.subscribe((e: any) => events.push(e));
    hook.send({ type: 'get-snapshot' });
    const commit = events.find((e) => e.type === 'commit');
    return { ok: true, rootName: commit?.snapshot?.name, hasChildren: (commit?.snapshot?.children?.length ?? 0) > 0 };
  });
  expect(result.ok).toBe(true);
  expect(result.rootName).toBe('Column');
  expect(result.hasChildren).toBe(true);
});

test('pick highlights a node on canvas hover', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => (window as any).__CAIRN_DEVTOOLS_HOOK__.send({ type: 'inspect-start' }));
  await page.mouse.move(60, 60);
  const overlay = page.locator('div[style*="z-index:2147483646"], div[style*="z-index: 2147483646"]');
  await expect(overlay.first()).toBeVisible();
});
```

- [ ] **Step 3: Run the smoke test**

Run: `pnpm exec playwright test packages/devtools/test/integration/agent-browser.spec.ts`
Expected: both tests pass (the web server serving `examples/devtools-demo` starts via the Playwright `webServer` config).

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/test/integration playwright.config.ts package.json pnpm-lock.yaml
git commit -m "test(devtools): Playwright smoke — agent hook emits commit; pick highlights on hover"
```

---

## Task 18: Final verification + docs pointer

**Files:**
- Modify: `docs/superpowers/specs/2026-07-04-dt1-devtools-inspector-design.md` (mark implemented)

- [ ] **Step 1: Full test + typecheck sweep**

Run: `pnpm test`
Expected: all packages green (existing + new devtools/reactivity/runtime tests).
Run: `pnpm typecheck`
Expected: clean (includes `packages/devtools/tsconfig.json`).

- [ ] **Step 2: Mark the spec implemented**

At the top of the spec file, change `**Статус:** дизайн утверждён, ждёт review` to `**Статус:** реализовано (DT1: D1+D2)`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-04-dt1-devtools-inspector-design.md
git commit -m "docs(devtools): mark DT1 spec implemented"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** inspector+props (Tasks 4/12/15), canvas highlight (Task 11) + pick (Tasks 11/12), "what changed" diff+log (Tasks 5/6/12/15), "why frame" counters (Tasks 7/8/12), zero-cost hooks (Tasks 7/9), Chrome extension bridge+panel (Tasks 14/15/16), demo (Task 13) + integration smoke (Task 17). Out-of-scope items (style keys, component names, signal→component attribution) are intentionally deferred to D3 and not tasked.
- **Type consistency:** `SnapshotNode`/`AgentEvent`/`PanelCommand`/`DevtoolsHook`/`ChangedNode`/`CommitMeta` defined once in `protocol.ts` (Task 1) and imported everywhere. `installDevtools`/`uninstallDevtools`, `serialize`, `diffSnapshots`, `hitTest`, `findNode`, `CommitLog`, `WhyFrameTracker`, `Highlighter`, `PickController`, `canvasRectToPage`, `pagePointToCanvas`, `setReactiveDevHooks`, `setRuntimeDevHooks`, `emitCommit`, `runSignalCreateHook` names are stable across tasks.
- **Security:** panel renders app-originated strings with `textContent`/DOM builders only — no `innerHTML` (Task 15).
- **Known adaptation points flagged inline:** fake-host export name (Tasks 9/12), example serving command (Task 13), Chrome background relay necessity (Tasks 15/16), Playwright config presence (Task 17).
```
