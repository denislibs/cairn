# Styling S5 — Units & Responsive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** CSS length units (`%`/`vw`/`vh`/`rem`/`px`/`auto`/`calc`) on sizing + responsive breakpoints. Backward-compatible (number = px).

Design ref: `docs/superpowers/specs/2026-07-03-styling-s5-units-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: layout, runtime, style, primitives, platform-web.

---

### Task 1: `Length` + `resolveLength`
- Files: new `packages/layout/src/length.ts` (`Length`, `LengthContext`, `resolveLength`), export from `packages/layout/src/index.ts`. Test `packages/layout/test/length.test.ts`.
- `resolveLength(len, {basis, viewportW, viewportH, rootFontSize})`: number→n; ends `px`→parseFloat; `%`→ `isFinite(basis) ? basis*n/100 : 'auto'`; `vw`→viewportW*n/100; `vh`→viewportH*n/100; `rem`→rootFontSize*n; `'auto'`→'auto'; `calc(A op B)`→ regex `/^calc\((.+?)\s*([+\-])\s*(.+?)\)$/`, resolve each side via resolveLength (recursive) then apply op (if either side 'auto'→'auto'); undefined→undefined; unknown→undefined.
- TDD: all forms incl. calc and infinite-basis %.

### Task 2: LayoutContext viewport + rootFontSize; mount wiring
- Files: `packages/layout/src/types.ts` (`LayoutContext` gains `viewport?: {w:number;h:number}` and `rootFontSize?: number` — OPTIONAL to avoid breaking existing test ctx objects), `packages/runtime/src/mount.ts` (populate from `host.metrics`).
- In `mount`'s `renderFrame`, build ctx with `viewport: { w: host.metrics.width, h: host.metrics.height }, rootFontSize: 16`. Keep `measureText`.
- TDD: light — a mount/integration test isn't required; a `resolveLength` default path handles missing viewport. Ensure existing layout tests (ctx without viewport) still compile (fields optional).

### Task 3: BoxNode Length sizing + padding
- Files: `packages/layout/src/box.ts` (fields → `Length`; resolve in `layout`), test `packages/layout/test/box-units.test.ts`.
- Change `width/height/minWidth/maxWidth/minHeight/maxHeight` types to `Length | undefined`; `padding` insets to `Length`. At top of `layout(c, ctx)`, build a `LengthContext` per axis (`basis=c.maxW` for width/padding, `basis=c.maxH` for height; viewport/rootFontSize from ctx with defaults `{w:0,h:0}`/16). Resolve each to number|undefined (`'auto'`→undefined). Resolve padding insets (default 0). Feed resolved numbers into existing `resolveAxis`/logic. Keep behavior identical for numeric inputs.
- TDD: `width:'50%'` of maxW 200 → 100; `'auto'`→content; `padding:'10%'` of maxW 200 → 20; numeric unchanged; infinite maxW + `%` → content.

### Task 4: FlexNode Length sizing
- Files: `packages/layout/src/flex.ts` (width/height → `Length`; resolve in `layout` where `explicitMain`/`explicitCross` are read), test `packages/layout/test/flex-units.test.ts`.
- Resolve `this.width`/`this.height` at the top of `layout` (basis: width→c.maxW, height→c.maxH) into numeric locals used wherever `this.width`/`this.height` currently feed `explicitMain`/`explicitCross`. `'auto'`/undefined → undefined (current behavior).
- TDD: Row `width:'50%'` of maxW 300 → 150; numeric unchanged.

### Task 5: primitives Length passthrough + responsive helpers
- Files: `packages/style/src/style.ts` (widen width/height/min/max/padding to `Length`/`Length` insets — import `Length` from `@cairn/layout`), `packages/primitives/src/box.ts` + `flex.ts` (already assign `layout.width = s.width` — now typed Length, passthrough; ensure padding uses a Length-aware `toEdgeInsets`), new `packages/primitives/src/responsive.ts` (`useViewport`, `pickBreakpoint`, `useBreakpoint`, `responsive`), export from index. Tests `packages/primitives/test/responsive.test.ts`.
- `toEdgeInsets` currently coerces to numbers — for Length insets, the node resolves padding, so primitives should pass the raw Length insets to the node. Adjust: BoxNode.padding stays as raw `Length` insets (resolved in node); primitives set `layout.padding = s.padding` (Length form) WITHOUT numeric coercion. Provide a `toLengthInsets(p)` that normalizes `number | string | Partial<EdgeInsets-of-Length>` into `{top,right,bottom,left}` of Length. (Keep `toEdgeInsets` for numeric internal use.)
- `pickBreakpoint(width, bps: Record<string,number>): string` — pure: return the key with the largest min ≤ width. `useBreakpoint(bps)` = `() => pickBreakpoint(useViewport()().w, bps)`. `useViewport` reads `useHost().metrics` (reactive width/height accessor). `responsive(map, current, order)` picks map[current] falling back down `order`.
- TDD: `pickBreakpoint` deterministic buckets; `responsive` fallback; (useViewport/useBreakpoint reactive — light test via a fake host if easy, else cover the pure pickers).

### Task 6: doc flip + verify
- Flip `docs/styling-and-capabilities.md` §12: `%`, `vw/vh`, `rem`, `auto`, `calc` → ✅ (note: sizing/padding only; gap/margin still px); media-queries/breakpoints → ✅ (via useBreakpoint). Update BaseStyle snapshot. Full `pnpm test` + `pnpm typecheck` green.

---

## Self-review
- Coverage: Length+resolver (T1), ctx+mount (T2), Box (T3), Flex (T4), primitives+responsive (T5), doc (T6).
- Backward-compat: bare numbers resolve to themselves; optional ctx fields → existing tests compile; `'auto'`→content preserves current behavior.
- Risk: padding representation change — keep numeric `toEdgeInsets` for internal callers; add `toLengthInsets` for the style path; nodes resolve padding Lengths in layout.
