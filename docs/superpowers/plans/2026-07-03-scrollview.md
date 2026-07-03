# ScrollView — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Clipped, scrollable container (wheel + drag, clamped offset, optional scrollbar, controlled/uncontrolled).

Design ref: `docs/superpowers/specs/2026-07-03-scrollview-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: layout, primitives, style.

---

### Task 1: `ScrollNode` (@cairn/layout)
- Files: new `packages/layout/src/scroll.ts` (`ScrollNode`, `ScrollNodeProps`), export from `packages/layout/src/index.ts`. Test `packages/layout/test/scroll.test.ts`.
- `ScrollNode extends LayoutNode`: props `{ width?: Length; height?: Length; direction?: 'vertical'|'horizontal'|'both'; child?: LayoutNode }`; fields `scrollX=0`, `scrollY=0`; computed `contentW/contentH/viewportW/viewportH/maxScrollX/maxScrollY`.
- `layout(c, ctx)`: resolve viewport (`resolveLength(width, {basis:c.maxW,...}) ?? c.maxW`, same for height with c.maxH; use `ctx.viewport`/`rootFontSize` defaults like Box does); own size = viewport; lay child unbounded on scroll axis (vertical→maxH Infinity, horizontal→maxW Infinity, both→both Infinity), bounded on cross to viewport; set contentW/H from child.size; maxScroll = max(0, content−viewport) per active axis; child.offsetX/Y = −clamp(scroll, 0, maxScroll).
- TDD: tall child (200h) in 100h viewport → child.size.h=200, node.size.h=100, contentH=200, maxScrollY=100; scrollY=30 → child.offsetY=−30; scrollY=999 → clamped to −100; horizontal analog; no child → size=viewport.

### Task 2: `ScrollView` primitive (@cairn/primitives)
- Files: new `packages/primitives/src/scroll-view.ts` (`ScrollView`, `ScrollViewProps`), export from index; `packages/style/src/style.ts` (no new fields strictly needed — width/height already Length; direction/scrollbar are props). Test `packages/primitives/test/scroll-view.test.ts`.
- Owns `scrollX/scrollY` signals; controlled when `scrollTop`/`scrollLeft` provided (value|accessor) + `onScroll`; uncontrolled otherwise. `read()`/`set()` helpers like Checkbox pattern.
- Build `ScrollNode({ child: content.layout, direction })`; instance children `[content]`; `bind(resolved, s => { node.width=s.width; node.height=s.height; instance.clipChildren = s.borderRadius ?? 0; ...transform/opacity/etc as other primitives; })`; a separate `createEffect`/bind sets `node.scrollX = readX(); node.scrollY = readY();` and scheduleFrame.
- Handlers: `onWheel(e)` → `commitY(readY() + e.deltaY)` (+X for horizontal/both), where `commit` clamps to `[0, node.maxScrollY]` (read after layout — node exposes maxScrollY), sets signal (uncontrolled) and/or calls `onScroll`. `onPointerDown/Move/Up/Leave` drag: track last pointer localY and dragging flag; move → `commitY(readY() − (localY − lastY))`; update lastY.
- **Scrollbar wrapping:** if `scrollbar !== false`, return `Stack({ children: [scrollViewInstance, scrollbarInstance] })` with the wheel/drag handlers + focusable on the Stack (or keep on the scroll instance and let the Stack be a passive wrapper — put handlers where hit-testing reaches them; simplest: put handlers on the returned outer instance). If `scrollbar === false`, return the scroll instance directly (handlers on it).
- TDD (no real layout needed for handler logic — set node.maxScrollY manually): wheel deltaY=50 → scrollY signal 50; deltaY beyond max clamps; drag move updates offset; controlled reads scrollTop + calls onScroll; uncontrolled updates internal.

### Task 3: scrollbar (thumb math + overlay)
- Files: `packages/primitives/src/scroll-view.ts` (add `scrollThumb` helper + scrollbar Instance), test `packages/primitives/test/scroll-thumb.test.ts`.
- `scrollThumb(viewport, content, scroll, minSize=24): { size: number; offset: number; visible: boolean }`: `visible = content > viewport`; `size = clamp(viewport*viewport/content, minSize, viewport)`; `maxScroll = content−viewport`; `offset = maxScroll<=0 ? 0 : clamp(scroll,0,maxScroll)/maxScroll * (viewport−size)`.
- Scrollbar Instance: raw `{ layout: BoxNode(viewport size or 0), paintSelf }` that reads `readY()`/`node.contentH`/`node.viewportH` and draws a rounded thumb (width ~6, right edge, `y=offset`, `height=size`, color e.g. `#8884`), only when `visible`. Horizontal analog when direction includes horizontal.
- TDD: `scrollThumb` — size/offset/min-clamp/hidden cases. (Paint presence via recording renderer: thumb draws a fillRoundRect when content>viewport, none otherwise.)

### Task 4: doc flip + example + verify
- Flip `docs/styling-and-capabilities.md` §13: `ScrollView` → ✅ (wheel+drag, clamp, scrollbar; virtualization ❌). Update snapshot (add `ScrollView` to primitives).
- Add a `examples/counter` (or a small new example) scrollable list demo, OR extend an existing example with a ScrollView of many rows. Verify live in a browser (Playwright): wheel scrolls, content clipped to viewport, thumb tracks. Screenshot.
- Full `pnpm test` + `pnpm typecheck` green.

---

## Self-review
- Coverage: ScrollNode (T1), primitive+input (T2), scrollbar (T3), doc+example (T4).
- Deps: ScrollNode uses `resolveLength` (already in layout); primitive uses signals + clipChildren (S1). No cycle.
- Backward-compat: new node/primitive; no change to existing paths.
- Risk: reading `node.maxScrollY` in the wheel handler requires a prior layout pass; on first wheel before layout it may be 0 — acceptable (first frame lays out before interaction). Clamp defensively.
