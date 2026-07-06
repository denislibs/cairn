# DT4c — Effect→Node Attribution + Signal Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute each primitive-created render effect to the instance it drives, so the DevTools can build a static signal→effect→node graph and light up the dep panel ("select a signal → see which nodes it updates").

**Architecture:** A dev-only ambient `runWithDevOwner(inst, label, fn)` in `@cairn/runtime` marks the instance while a primitive creates its bind/Show effect; because the effect's first run is synchronous, the agent's existing `onComputationRun` hook tags the effect→{instanceId,label} via `getDevOwner()`. A `signal-graph` command walks `SignalState.observers` → effect-owner map → node ids; the panel renders the flow and highlights those nodes.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, esbuild (extension), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-05-dt4c-effect-attribution-design.md`

---

## File Structure

**Core:**
- `packages/runtime/src/dev-owner.ts` (new) — `runWithDevOwner`/`getDevOwner`/`activateDevOwner`/`deactivateDevOwner`.
- `packages/runtime/src/index.ts` — export them.
- `packages/primitives/src/{box,text,flex,grid}.ts` + `packages/runtime/src/show.ts` — wrap effect creation in `runWithDevOwner`. (scroll-view deferred — snapshot-id/bind-instance mismatch, same as D4a style-override.)

**`@cairn/devtools`:**
- `effect-owner.ts` (new) — `WeakMap<Computation, {instanceId,label}>`.
- `protocol.ts` — `SignalGraph`, `signal-graph` command + event.
- `agent.ts` — tag effects in `onComputationRun`; `activateDevOwner`/`deactivateDevOwner` in install/uninstall; handle `signal-graph`.

**Extension:** `src/panel/panel.ts` — signal select → `signal-graph` → dep flow + node chips + tree highlight; `README.md` checklist.

**Tests:** unit per new module + Playwright e2e.

---

## Task 1: Ambient dev-owner (runtime)

**Files:**
- Create: `packages/runtime/src/dev-owner.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/dev-owner.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/runtime/test/dev-owner.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import type { Instance } from '../src/instance';
import { runWithDevOwner, getDevOwner, activateDevOwner, deactivateDevOwner } from '../src/dev-owner';

afterEach(() => deactivateDevOwner());

function inst(): Instance {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 } } as any, children: [], paintSelf() {} };
}

describe('dev-owner', () => {
  it('is inert until activated (no owner, still runs fn)', () => {
    const a = inst();
    let ran = false;
    const r = runWithDevOwner(a, 'style', () => { ran = true; return getDevOwner(); });
    expect(ran).toBe(true);
    expect(r).toBeNull();          // inactive → no owner tracked
    expect(getDevOwner()).toBeNull();
  });

  it('exposes the owner during fn when active, restores after', () => {
    activateDevOwner();
    const a = inst();
    let during: any = null;
    runWithDevOwner(a, 'style', () => { during = getDevOwner(); });
    expect(during).toEqual({ inst: a, label: 'style' });
    expect(getDevOwner()).toBeNull(); // restored (prev was null)
  });

  it('nests and restores the previous owner', () => {
    activateDevOwner();
    const a = inst(), b = inst();
    let inner: any = null, afterInner: any = null;
    runWithDevOwner(a, 'a', () => {
      runWithDevOwner(b, 'b', () => { inner = getDevOwner(); });
      afterInner = getDevOwner();
    });
    expect(inner).toEqual({ inst: b, label: 'b' });
    expect(afterInner).toEqual({ inst: a, label: 'a' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/runtime/test/dev-owner.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/runtime/src/dev-owner.ts`:
```ts
import type { Instance } from './instance';

export interface DevOwner { inst: Instance; label: string }

let current: DevOwner | null = null;
let active = false;

/** Enable ambient owner tracking (called by installDevtools). Prod stays inert. */
export function activateDevOwner(): void { active = true; }
export function deactivateDevOwner(): void { active = false; current = null; }

/** Run `fn` with `inst`/`label` as the ambient dev owner (restored afterwards).
 *  Inert (direct call) when not activated — zero prod cost. */
export function runWithDevOwner<T>(inst: Instance, label: string, fn: () => T): T {
  if (!active) return fn();
  const prev = current;
  current = { inst, label };
  try { return fn(); } finally { current = prev; }
}

export function getDevOwner(): DevOwner | null { return active ? current : null; }
```

- [ ] **Step 4: Export from runtime index**

In `packages/runtime/src/index.ts`, add:
```ts
export { runWithDevOwner, getDevOwner, activateDevOwner, deactivateDevOwner } from './dev-owner';
export type { DevOwner } from './dev-owner';
```

- [ ] **Step 5: Run + verify**

Run: `pnpm test -- packages/runtime/test/dev-owner.test.ts`
Expected: PASS.
Run: `pnpm test -- packages/runtime`
Expected: existing runtime tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/dev-owner.ts packages/runtime/src/index.ts packages/runtime/test/dev-owner.test.ts
git commit -m "feat(runtime): ambient dev-owner for effect->instance attribution"
```

---

## Task 2: Wrap primitive effect creation in `runWithDevOwner`

**Files:**
- Modify: `packages/primitives/src/box.ts` (~184), `text.ts` (~88 style, ~103 content), `flex.ts` (~39), `grid.ts` (~33)
- Modify: `packages/runtime/src/show.ts` (~26)
- Test: `packages/primitives/test/effect-attribution.test.ts`

**Technique:** wrap the `bind(...)` / `createEffect(...)` call in `runWithDevOwner(instance, '<label>', () => …)`. The bind's first run is synchronous, so the ambient owner is live when the agent's `onComputationRun` fires. Add `runWithDevOwner` to the existing `@cairn/runtime` import in each file (Show already imports from reactivity; import `runWithDevOwner` from `../` runtime — it's the same package `@cairn/runtime`, use a relative import `./dev-owner` since show.ts lives in runtime).

- [ ] **Step 1: Write the failing test**

`packages/primitives/test/effect-attribution.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setReactiveDevHooks } from '@cairn/reactivity';
import { activateDevOwner, deactivateDevOwner, getDevOwner } from '@cairn/runtime';
import { Box } from '../src/box';

afterEach(() => { setReactiveDevHooks(null); deactivateDevOwner(); });

describe('primitive effect attribution', () => {
  it("Box's style effect runs under its own dev owner", () => {
    activateDevOwner();
    const owners: Array<{ inst: unknown; label: string } | null> = [];
    setReactiveDevHooks({
      onComputationRun: (n) => { if ((n as { isEffect?: boolean }).isEffect) owners.push(getDevOwner()); },
    });
    let box: any;
    createRoot(() => { box = Box({ style: { backgroundColor: '#ff0000' } }); });
    // At least one effect ran with the Box instance as owner, label 'style'
    const hit = owners.find((o) => o && o.inst === box && o.label === 'style');
    expect(hit).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/primitives/test/effect-attribution.test.ts`
Expected: FAIL (no `runWithDevOwner` wrapping yet → `getDevOwner()` is null during the effect run).

- [ ] **Step 3: Wrap `box.ts`**

In `packages/primitives/src/box.ts`, add `runWithDevOwner` to the `@cairn/runtime` import, then wrap the style bind:
```ts
  runWithDevOwner(instance, 'style', () => bind(styleSource, (raw) => {
    const s = applyStyleOverride(raw, readStyleOverride(instance));
    current = s;
    instance.debugStyle = s;
    // …rest of the existing body unchanged…
  }));
```
(The whole existing `bind(styleSource, (raw) => {...})` call is now the argument to `runWithDevOwner(instance, 'style', () => …)`.)

- [ ] **Step 4: Wrap `text.ts`, `flex.ts`, `grid.ts`, `show.ts`**

- `text.ts`: wrap the style bind (~88) as `runWithDevOwner(instance, 'style', () => bind(styleSource, (raw) => {...}))` and the content bind (~103) as `runWithDevOwner(instance, 'text', () => bind(content, (v) => {...}))`. Add `runWithDevOwner` to the `@cairn/runtime` import.
- `flex.ts` (~39) and `grid.ts` (~33): wrap the style bind as `runWithDevOwner(instance, 'style', () => bind(styleSource, (raw: BaseStyle) => {...}))`; add the import.
- `show.ts` (~26): wrap the `createEffect(() => {...})` as `runWithDevOwner(instance, 'show', () => createEffect(() => {...}))`; import `runWithDevOwner` from `./dev-owner`.
- Do NOT touch `scroll-view.ts` (deferred — its snapshot id is on a different instance than the bind's `viewportInst`, same reason style-override skipped it).

- [ ] **Step 5: Run + verify no regression**

Run: `pnpm test -- packages/primitives/test/effect-attribution.test.ts`
Expected: PASS.
Run: `pnpm test -- packages/primitives packages/runtime`
Expected: existing tests still pass (`runWithDevOwner` is transparent — inert unless activated, and just a passthrough wrapper otherwise).

- [ ] **Step 6: Commit**

```bash
git add packages/primitives/src/box.ts packages/primitives/src/text.ts packages/primitives/src/flex.ts packages/primitives/src/grid.ts packages/runtime/src/show.ts packages/primitives/test/effect-attribution.test.ts
git commit -m "feat(primitives): tag render effects with their owning instance via runWithDevOwner"
```

---

## Task 3: Effect-owner map + agent tagging

**Files:**
- Create: `packages/devtools/src/effect-owner.ts`
- Modify: `packages/devtools/src/agent.ts`
- Test: `packages/devtools/test/effect-owner.test.ts`, `packages/devtools/test/agent.test.ts` (extend)

- [ ] **Step 1: Write the failing effect-owner test**

`packages/devtools/test/effect-owner.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { tagEffect, effectOwnerOf, resetEffectOwner } from '../src/effect-owner';

describe('effect-owner', () => {
  beforeEach(() => resetEffectOwner());
  it('tags and resolves an effect owner', () => {
    const node = {};
    tagEffect(node, 7, 'style');
    expect(effectOwnerOf(node)).toEqual({ instanceId: 7, label: 'style' });
  });
  it('returns undefined for an untagged effect', () => {
    expect(effectOwnerOf({})).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/effect-owner.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `effect-owner.ts`**

`packages/devtools/src/effect-owner.ts`:
```ts
export interface EffectOwner { instanceId: number; label: string }

let map = new WeakMap<object, EffectOwner>();

export function tagEffect(node: object, instanceId: number, label: string): void {
  map.set(node, { instanceId, label });
}
export function effectOwnerOf(node: object): EffectOwner | undefined {
  return map.get(node);
}
/** Test-only: drop all tags. */
export function resetEffectOwner(): void { map = new WeakMap(); }
```

- [ ] **Step 4: Tag effects in the agent's composite hook + activate dev-owner**

In `packages/devtools/src/agent.ts`:
- Extend imports:
```ts
import { setRuntimeDevHooks, activateStyleOverrides, deactivateStyleOverrides, setStyleProp, toggleStyleProp, removeStyleProp, activateDevOwner, deactivateDevOwner, getDevOwner } from '@cairn/runtime';
import { idOf } from './ids';
import { tagEffect, effectOwnerOf } from './effect-owner';
```
- In the composite `setReactiveDevHooks`, replace the `onComputationRun` line:
```ts
    onComputationRun: (n) => {
      why.noteEffectRun(n as object);
      if ((n as { isEffect?: boolean }).isEffect && !effectOwnerOf(n as object)) {
        const owner = getDevOwner();
        if (owner) tagEffect(n as object, idOf(owner.inst), owner.label);
      }
    },
```
- After `activateStyleOverrides();` add `activateDevOwner();`.
- In `uninstallDevtools`, after `deactivateStyleOverrides();` add `deactivateDevOwner();`.

- [ ] **Step 5: Extend the agent test — effects get tagged after mount**

Add to `packages/devtools/test/agent.test.ts` (uses real primitives via a small app; import `Box`/`Text` from `@cairn/primitives` and `createFakeHost`/`mount` already present):
```ts
  it('tags primitive effects with their owning instance id after mount', async () => {
    installDevtools();
    const { host } = createFakeHost();
    // a real Box so its style effect runs under runWithDevOwner
    const { Box } = await import('@cairn/primitives');
    const app = () => Box({ style: { backgroundColor: '#f00' } });
    const dispose = mount(app, host);
    // The agent's effect-owner map now has the Box's style effect. We can't read the WeakMap by node,
    // but signal-graph (Task 4) exercises it end-to-end. Here we just assert install+mount didn't throw
    // and a commit happened.
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    hook.send({ type: 'get-snapshot' });
    expect(events.some((e) => e.type === 'commit')).toBe(true);
    dispose();
  });
```
> This is a smoke guard (the WeakMap is internal); the real end-to-end tag→graph assertion is the Task 4 `signal-graph` test and the Playwright test.

- [ ] **Step 6: Run + typecheck**

Run: `pnpm test -- packages/devtools`
Expected: all pass.
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/devtools/src/effect-owner.ts packages/devtools/src/agent.ts packages/devtools/test/effect-owner.test.ts packages/devtools/test/agent.test.ts
git commit -m "feat(devtools): tag render effects to instances via onComputationRun + dev-owner"
```

---

## Task 4: `signal-graph` command + event

**Files:**
- Modify: `packages/devtools/src/protocol.ts`
- Modify: `packages/devtools/src/agent.ts`
- Test: `packages/devtools/test/agent.test.ts` (extend)

- [ ] **Step 1: Add protocol types**

In `packages/devtools/src/protocol.ts`:
```ts
export interface SignalGraph { effects: { label: string; nodeId: number }[]; nodeIds: number[] }
```
Add to `AgentEvent`:
```ts
  | { type: 'signal-graph'; id: number; graph: SignalGraph }
```
Add to `PanelCommand`:
```ts
  | { type: 'signal-graph'; id: number }
```

- [ ] **Step 2: Write the failing test**

Add to `packages/devtools/test/agent.test.ts`:
```ts
  it('signal-graph maps a signal to the nodes its effects own', async () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));

    const { Text } = await import('@cairn/primitives');
    const { createSignal } = await import('@cairn/reactivity');
    const { host } = createFakeHost();
    let n = 0;
    // a Text whose content reads a named signal → the text effect observes it and is owned by the Text instance
    const dispose = mount(() => {
      const [c] = createSignal(0, { name: 'count' });
      return Text({ value: () => `count: ${c()}` });
    }, host);

    hook.send({ type: 'get-signals' });
    const sig = [...events].reverse().find((e) => e.type === 'signals');
    const id = sig && sig.type === 'signals' ? sig.list.find((s) => s.name === 'count')!.id : -1;
    hook.send({ type: 'signal-graph', id });
    const g = [...events].reverse().find((e) => e.type === 'signal-graph');
    expect(g && g.type === 'signal-graph').toBe(true);
    if (g && g.type === 'signal-graph') {
      expect(g.graph.nodeIds.length).toBeGreaterThan(0);
      expect(g.graph.effects.some((ef) => ef.label === 'text')).toBe(true);
    }
    void n;
    dispose();
  });
```
> Note: `Text({ value: () => ... })` makes the content reactive → its content bind (label `'text'`) observes the `count` signal and is owned by the Text instance. If `Text`'s reactive-value prop differs, adapt to whatever makes the text reactive (the demo uses `children: () => \`count: ${count()}\``). The assertion is: graph has ≥1 nodeId and a `text`-labelled effect.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/agent.test.ts`
Expected: FAIL (agent doesn't handle `signal-graph`).

- [ ] **Step 4: Handle `signal-graph` in the agent**

In `packages/devtools/src/agent.ts` `handleCommand` switch, add:
```ts
    case 'signal-graph': {
      const node = state.registry.resolve(cmd.id) as { observers?: { isEffect?: boolean }[] } | undefined;
      const effects: { label: string; nodeId: number }[] = [];
      const nodeIds = new Set<number>();
      if (node && node.observers) {
        for (const c of node.observers) {
          if (!c.isEffect) continue;
          const owner = effectOwnerOf(c as object);
          if (owner) { effects.push({ label: owner.label, nodeId: owner.instanceId }); nodeIds.add(owner.instanceId); }
        }
      }
      emit({ type: 'signal-graph', id: cmd.id, graph: { effects, nodeIds: [...nodeIds] } });
      break;
    }
```

- [ ] **Step 5: Run + typecheck**

Run: `pnpm test -- packages/devtools`
Expected: all pass (signal-graph test green).
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/protocol.ts packages/devtools/src/agent.ts packages/devtools/test/agent.test.ts
git commit -m "feat(devtools): signal-graph command resolves signal->effects->node ids"
```

---

## Task 5: Panel dep panel (select signal → graph + highlight)

**Files:**
- Modify: `devtools-extension/src/panel/panel.ts`

XSS rule: `textContent`/DOM builders only.

- [ ] **Step 1: Add selection + graph state; request graph on signal click**

In `panel.ts`, add state:
```ts
let selSignal: number | null = null;
let graphNodeIds = new Set<number>();
import type { SignalGraph } from '@cairn/devtools'; // add SignalGraph to the existing type import
```
(Add `SignalGraph` to the existing `import type { … } from '@cairn/devtools'` line rather than a second import.)

In `renderSignals`, make each signal ROW selectable (click on the row, not the editable value): add to the row element construction:
```ts
    row.classList.toggle('on', s.id === selSignal);
    row.onclick = (ev) => {
      if ((ev.target as HTMLElement).classList.contains('vv')) return; // don't select when editing value
      selSignal = s.id;
      send({ type: 'signal-graph', id: s.id });
      renderSignals();
    };
```

- [ ] **Step 2: Handle the `signal-graph` event → render dep + highlight**

In `handleEvent`, add a branch:
```ts
  } else if (e.type === 'signal-graph') {
    if (e.id === selSignal) { renderDep(e.graph); graphNodeIds = new Set(e.graph.nodeIds); renderTree(); }
  }
```

Add `renderDep`:
```ts
function renderDep(graph: SignalGraph): void {
  const dep = document.getElementById('dep');
  if (!dep) return;
  dep.replaceChildren();
  const h = document.createElement('h4'); h.textContent = 'Dependency graph';
  dep.appendChild(h);
  if (!graph.effects.length) {
    const empty = document.createElement('div'); empty.className = 'empty';
    empty.textContent = 'No attributed nodes (best-effort — dynamic subtrees may be missing).';
    dep.appendChild(empty); return;
  }
  const flow = document.createElement('div'); flow.className = 'flow';
  for (const ef of graph.effects) {
    const line = document.createElement('div'); line.className = 'lvl';
    const branch = document.createElement('span'); branch.className = 'branch'; branch.textContent = '└─ ';
    const effName = document.createElement('span'); effName.className = 'eff'; effName.textContent = `${ef.label}()`;
    line.append(branch, effName);
    const node = findNode(snapshot, ef.nodeId);
    if (node) {
      const chip = document.createElement('span'); chip.className = 'nodechip';
      const t = document.createElement('span'); t.className = 't'; t.textContent = `<${node.name}>`;
      chip.append(t, document.createTextNode(` ${Math.round(node.rect.w)}×${Math.round(node.rect.h)}`));
      chip.onclick = () => {
        selected = ef.nodeId;
        document.querySelector('.subtab[data-tab="styles"]')?.dispatchEvent(new MouseEvent('click'));
        send({ type: 'select', id: ef.nodeId });
        renderTree(); renderStyles(); renderComputed();
      };
      line.append(document.createTextNode(' '), chip);
    }
    flow.appendChild(line);
  }
  dep.appendChild(flow);
}
```

- [ ] **Step 3: Highlight graph nodes in the tree**

In `walkTree`, extend the row class to include graph nodes. Find the line building `row.className` and add `graphNodeIds.has(node.id)`:
```ts
  row.className = 'node'
    + (node.id === selected ? ' sel' : '')
    + (changedIds.has(node.id) || graphNodeIds.has(node.id) ? ' affected' : '');
```

- [ ] **Step 4: Build**

Run: `cd devtools-extension && pnpm build`
Expected: clean; `grep -n "innerHTML" devtools-extension/src/panel/panel.ts` → no matches; `@cairn/devtools` import stays `import type`.

- [ ] **Step 5: Commit**

```bash
git add devtools-extension/src/panel/panel.ts
git commit -m "feat(extension): dep panel — select signal shows effect->node graph + highlights"
```

---

## Task 6: e2e + docs

**Files:**
- Modify: `packages/devtools/test/integration/agent-browser.spec.ts`
- Modify: `devtools-extension/README.md`
- Modify: `docs/superpowers/specs/2026-07-05-dt4c-effect-attribution-design.md`

- [ ] **Step 1: Add the e2e test**

Append to `packages/devtools/test/integration/agent-browser.spec.ts`:
```ts
test('signal-graph attributes the count signal to at least one node', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async () => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: any[] = []; hook.subscribe((e: any) => events.push(e));
    hook.send({ type: 'get-signals' });
    const sig = [...events].reverse().find((e) => e.type === 'signals');
    const count = sig?.list?.find((s: any) => s.name === 'count');
    if (!count) return { ok: false };
    hook.send({ type: 'signal-graph', id: count.id });
    const g = [...events].reverse().find((e) => e.type === 'signal-graph');
    return { ok: true, nodeIds: g?.graph?.nodeIds ?? [], labels: (g?.graph?.effects ?? []).map((e: any) => e.label) };
  });
  expect(res.ok).toBe(true);
  expect(res.nodeIds.length).toBeGreaterThan(0);
});
```
> The demo's `count: ${count()}` Text makes `count` observed by a `text`-labelled effect owned by that Text instance, so the graph has ≥1 nodeId. If it comes back empty (e.g. the demo builds the reactive subtree in a way that misses ambient tagging), adjust the demo `main.tsx` so the count text is a top-level reactive `Text({ children: () => ... })` created during initial mount (not inside a Show/For), then re-run — this is exactly the best-effort limitation the spec documents.

- [ ] **Step 2: Run e2e**

Run: `pnpm test:e2e`
Expected: all prior e2e + this one pass.

- [ ] **Step 3: README checklist + spec status**

In `devtools-extension/README.md` add under the checklist:
```markdown
- [ ] Selecting a signal in the Signals tab shows a dependency flow (signal → effect → node chips).
- [ ] The nodes a signal updates are highlighted in the tree; clicking a node chip opens that node.
```
Change the spec status line to `**Статус:** реализовано (DT4c)`.

- [ ] **Step 4: Full sweep + commit**

Run: `pnpm test` (green), `pnpm typecheck` (clean), `pnpm test:e2e` (green).
```bash
git add packages/devtools/test/integration/agent-browser.spec.ts devtools-extension/README.md docs/superpowers/specs/2026-07-05-dt4c-effect-attribution-design.md
git commit -m "test(devtools): e2e signal-graph; docs DT4c checklist + spec status"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** ambient dev-owner (T1), primitive wrapping (T2, scroll-view deferred), effect-owner + agent tagging (T3), signal-graph command/event (T4), panel dep + highlight (T5), e2e + docs (T6).
- **Type consistency:** `DevOwner {inst,label}` (T1) is read by the agent (T3) via `getDevOwner`. `EffectOwner {instanceId,label}` (T3) produced by `tagEffect`, consumed in the signal-graph handler (T4). `SignalGraph {effects:[{label,nodeId}], nodeIds}` (T4) is emitted by the agent and consumed by the panel (T5). `signal-graph` exists as BOTH a `PanelCommand` (`{type,id}`) and an `AgentEvent` (`{type,id,graph}`) — distinct shapes, intentional.
- **Attribution timing:** effects are tagged on their first (synchronous) run while `getDevOwner()` is set; the `!effectOwnerOf(n)` guard prevents re-tag on later runs. Best-effort: reactively-created subtrees whose first run is deferred outside the ambient won't tag (documented).
- **Prod cost:** `runWithDevOwner` is a direct `fn()` call when not activated; `getDevOwner` returns null; no tagging. Zero cost without an installed agent.
- **XSS:** panel dep uses `textContent`/DOM builders; node chip text via `textContent`.
- **Adaptation points:** scroll-view deferral (T2); the reactive-Text form in the graph tests (T4/T6 — use the form that actually makes content reactive so the text effect observes the signal); node-chip subtab click (T5).
```
