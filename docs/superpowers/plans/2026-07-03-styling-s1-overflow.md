# Styling S1 — Overflow / Clipping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** `overflow: visible|hidden|clip` clips a container's children to its (rounded) content box.

**Architecture:** Add `clipRoundRect` to the renderer; the paint walker clips a subtree when `Instance.clipChildren` is set; `Box`/`Row`/`Column` set it from `style.overflow` (+ borderRadius).

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: host, platform-web, runtime, style, primitives.

---

### Task 1: Renderer `clipRoundRect`

**Files:**
- Modify: `packages/host/src/renderer.ts` (add to `Renderer`)
- Modify: `packages/platform-web/src/canvas2d-renderer.ts` (implement)
- Test: `packages/platform-web/test/canvas2d-renderer.test.ts` (add cases)

- [ ] **Step 1: Failing test** — using the mock ctx pattern already in the file, assert `clipRoundRect({x:0,y:0,width:10,height:10}, 4)` calls `beginPath`, `roundRect` (with the normalized radii), and `clip`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** Add to `Renderer` after `clipRect`: `clipRoundRect(rect: Rect, radii: Radii): void;`
- [ ] **Step 4:** Implement in `canvas2d-renderer.ts` (mirror `clipRect` + `fillRoundRect`):
```ts
  clipRoundRect(rect: Rect, radii: Radii): void {
    this.ctx.beginPath();
    this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, normalizeRadii(radii));
    this.ctx.clip();
  }
```
(`normalizeRadii` already exists at the bottom of the file; `Radii` is already imported.)
- [ ] **Step 5:** Run → PASS. `pnpm typecheck` — adding to `Renderer` requires the no-op renderer in `packages/host/test/conformance.test.ts` (and any recording renderers) to gain `clipRoundRect`; add the trivial method where typecheck/tests complain (`packages/primitives/test/recording-renderer.ts` lists renderer method names — add `'clipRoundRect'`; `packages/widgets/test/recording-renderer.ts` too if present; `packages/*/test/fake*.ts` fakes).
- [ ] **Step 6: Commit** — `feat(host): clipRoundRect renderer op`

---

### Task 2: Paint-walker subtree clip

**Files:**
- Modify: `packages/runtime/src/instance.ts` (add `clipChildren`, apply in `paint`)
- Test: `packages/runtime/test/paint-clip.test.ts` (create)

- [ ] **Step 1: Failing test** — recording renderer (proxy that records calls). Build an instance with a `BoxNode` sized `{w:20,h:20}` and `clipChildren: 8`, one child. Assert `paint` emits a `clipRoundRect` with `[{x:0,y:0,width:20,height:20}, 8]` AFTER `paintSelf` runs and BEFORE the child's `paintSelf`. Second case: `clipChildren` unset → no `clipRoundRect` call. Third: `clipChildren: 0` → a `clipRoundRect` with radii `0`.
```ts
import { describe, it, expect } from 'vitest';
import { paint, type Instance } from '../src/instance';
import { BoxNode } from '@cairn/layout';
function rec() { const calls:any[]=[]; const r:any=new Proxy({},{get:(_t,k)=>(...a:any[])=>calls.push([k,...a])}); return {r,calls}; }
function node(clip: any, children: Instance[] = [], tag = 'self', log: string[] = []): Instance {
  const layout = new BoxNode({}); layout.size = { w: 20, h: 20 };
  return { layout, children, clipChildren: clip, paintSelf(){ log.push(tag); } };
}
it('clips children to rounded box after paintSelf', () => {
  const { r, calls } = rec();
  const child = node(undefined, [], 'child');
  paint(node(8, [child]), r);
  const clipIdx = calls.findIndex((c) => c[0] === 'clipRoundRect');
  expect(clipIdx).toBeGreaterThanOrEqual(0);
  expect(calls[clipIdx].slice(1)).toEqual([{ x:0,y:0,width:20,height:20 }, 8]);
});
it('no clip when clipChildren is undefined', () => {
  const { r, calls } = rec();
  paint(node(undefined, [node(undefined,[],'c')]), r);
  expect(calls.some((c)=>c[0]==='clipRoundRect')).toBe(false);
});
it('clipChildren 0 still clips (square)', () => {
  const { r, calls } = rec();
  paint(node(0, [node(undefined,[],'c')]), r);
  expect(calls.some((c)=>c[0]==='clipRoundRect' && c[2]===0)).toBe(true);
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** Add `clipChildren?: Radii | null;` to the `Instance` interface (import `Radii` from `@cairn/host` as a type). In `paint`, after `inst.paintSelf(r)` and before the children loop:
```ts
  if (inst.clipChildren !== undefined && inst.clipChildren !== null) {
    r.clipRoundRect({ x: 0, y: 0, width: inst.layout.size.w, height: inst.layout.size.h }, inst.clipChildren);
  }
```
(Keep the existing `orderByZ` child iteration and opacity logic intact.)
- [ ] **Step 4:** Run → PASS. `pnpm typecheck`. `pnpm vitest run packages/runtime` (no regression).
- [ ] **Step 5: Commit** — `feat(runtime): clip subtree to node box via Instance.clipChildren`

---

### Task 3: `overflow` style + Box/Flex wiring + doc flip

**Files:**
- Modify: `packages/style/src/style.ts` (+`overflow`)
- Modify: `packages/primitives/src/box.ts`, `packages/primitives/src/flex.ts` (set `clipChildren`)
- Modify: `docs/styling-and-capabilities.md` (flip rows)
- Test: `packages/primitives/test/overflow.test.ts` (create)

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
import { Row } from '../src/flex';
it('Box overflow hidden sets clipChildren to borderRadius', () => {
  createRoot(() => {
    const a = Box({ style: { overflow: 'hidden', borderRadius: 12 } });
    expect(a.clipChildren).toBe(12);
    const b = Box({ style: { overflow: 'clip' } });
    expect(b.clipChildren).toBe(0);
    const c = Box({ style: { borderRadius: 12 } }); // default visible
    expect(c.clipChildren == null).toBe(true);
  });
});
it('Row overflow hidden clips', () => {
  createRoot(() => {
    const r = Row({ style: { overflow: 'hidden' } });
    expect(r.clipChildren).toBe(0);
  });
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** `style.ts`: add `overflow?: 'visible' | 'hidden' | 'clip';` to `BaseStyle`.
- [ ] **Step 4:** In `box.ts` reactive `bind(resolved, s => {…})`, add:
```ts
    instance.clipChildren = (s.overflow === 'hidden' || s.overflow === 'clip')
      ? (s.borderRadius ?? 0)
      : undefined;
```
(place after the existing `instance.paintOpacity = s.opacity;`). In `flex.ts` `bind`, add the same (Flex has no borderRadius paint, but `s.borderRadius ?? 0` still yields a valid clip radius): `layout` is the FlexNode; set on the `instance`. NOTE: in flex.ts the `instance` is created AFTER the `bind` today — if so, restructure so `instance` exists before `bind` (mirror how box.ts was structured), OR set `clipChildren` via a captured `let`/closure. Simplest: move the `const instance = {…}` above `bind(resolved, …)` in flex.ts (same pattern as box.ts) and reference `instance.clipChildren` inside the bind.
- [ ] **Step 5:** Run → PASS. `pnpm typecheck`. `pnpm test` (full workspace green).
- [ ] **Step 6: Flip the doc** — in `docs/styling-and-capabilities.md`: §1 `overflow` row → ✅ for `hidden`/`clip` (note `scroll` still ❌ → ScrollView phase); §13 "клиппинг / overflow:hidden" → ✅. Update the `BaseStyle` snapshot field list to include `overflow`.
- [ ] **Step 7: Commit** — `feat(primitives): overflow hidden/clip on Box/Row/Column; docs: flip overflow rows`

---

## Self-review
- Spec coverage: renderer clip (T1), walker clip (T2), style+wiring+doc (T3) — all S1 spec items mapped.
- Type consistency: `clipChildren: Radii | null`, `clipRoundRect(rect, radii)`, `overflow` union — consistent across tasks.
- Default `overflow: visible` → `clipChildren` undefined → no behavior change (existing tests stay green).
