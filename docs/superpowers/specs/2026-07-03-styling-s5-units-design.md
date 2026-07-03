# Styling S5 — Units & Responsive — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** production-ready styling roadmap (S5 of S7).

## Goal
CSS length units (`%`, `vw`, `vh`, `rem`, `px`, `auto`, basic `calc()`) for sizing/spacing, plus responsive breakpoints. Backward-compatible: a bare `number` is still px.

## Length model
```ts
export type Length = number | string; // number = px; strings: '50%','10vw','8vh','1.5rem','12px','auto','calc(100% - 20px)'
export interface LengthContext { basis: number; viewportW: number; viewportH: number; rootFontSize: number }
// Returns resolved px, or 'auto' (sentinel) when unresolvable/auto.
export function resolveLength(len: Length | undefined, ctx: LengthContext): number | 'auto' | undefined;
```
Resolution: number → px; `Npx` → N; `N%` → `basis*N/100` (if `basis` not finite → `'auto'`); `Nvw`/`Nvh` → viewport*N/100; `Nrem` → rootFontSize*N; `auto` → `'auto'`; `calc(A op B)` → resolve each operand length against the same ctx and `+`/`-` (single binary op for v1; whitespace-delimited). Undefined → undefined. Pure + unit-tested. Lives in `@cairn/layout` (`length.ts`).

## Layout context
`LayoutContext` gains `viewport: { w: number; h: number }` and `rootFontSize: number` (default 16). `mount` populates them from `host.metrics` (width/height) each frame — already reactive via `onResize`. Existing `LayoutContext` consumers (tests) pass a viewport (default `{w:0,h:0}`) — provide a small helper/default so existing tests need minimal change (make the fields optional on the context and default inside `resolveLength` callers).

## Node integration
`BoxNode` / `FlexNode` accept `Length` for `width`/`height`/`minWidth`/`maxWidth`/`minHeight`/`maxHeight` and `padding` insets. At the top of `layout(c, ctx)`:
- Resolve width against `basis = c.maxW`, height against `basis = c.maxH` (finite → %; infinite → `'auto'`→undefined→content sizing).
- Resolve padding insets against `basis = c.maxW` (CSS: padding % is relative to inline size).
- `'auto'` → treat as "no explicit size" (content sizing), i.e. undefined for that axis.
- Feed resolved numbers into the existing `resolveAxis`/sizing logic unchanged.
`GridNode` tracks already model px/fr/auto; leave track units as-is (S4). Gap/margin `Length` deferred (stay px) — documented.

## Primitives
`BaseStyle` widens `width`/`height`/`minWidth`/`maxWidth`/`minHeight`/`maxHeight`/`padding` to `Length`(or `Length` insets). Primitives pass them through to nodes unchanged (nodes now resolve). No bind-time resolution (basis unknown at bind time).

## Responsive / breakpoints
`@cairn/primitives` (or a small `@cairn/style` addition) provides reactive helpers reading `SurfaceMetrics` via the host context:
- `useViewport(): () => { w: number; h: number }` — reactive accessor from `useHost().metrics`.
- `useBreakpoint(breakpoints: Record<string, number>): () => string` — returns the largest breakpoint whose min-width ≤ current viewport width (e.g. `{ sm:0, md:768, lg:1024 }` → `'md'`).
- `responsive<T>(byBreakpoint: Record<string, T>, current: string, order: string[]): T` — pick the value for the active breakpoint, falling back down the order.
These are reactive because `metrics.width` is reactive (SurfaceMetrics), so a `createMemo`/accessor recomputes on resize. Usage: `Box({ style: () => ({ width: useBreakpoint(bp)() === 'lg' ? 400 : '100%' }) })`.

## Testing
- `resolveLength`: px/number, `%` (with/without finite basis), vw/vh, rem, auto, `calc(100% - 20px)`, undefined.
- `BoxNode`: `width:'50%'` of maxW 200 → 100; `width:'auto'` → content; `padding:'10%'` of maxW; `vw`/`rem` via ctx; infinite basis `%` → content.
- `FlexNode`: `width:'50%'`.
- `useBreakpoint`: picks correct bucket for sample widths; reactive on metrics change (can test the pure picker `pickBreakpoint(width, bps)` deterministically).
- Full `pnpm test` + `pnpm typecheck` green; bare-number usage unchanged.

## Exit criteria
- Length units on width/height/min/max/padding for Box/Flex; viewport+rem context wired via mount; breakpoint helpers.
- Capability doc §12 rows flipped to ✅ (%, vw/vh, rem, auto, calc; media-queries/breakpoints). Leave gap/margin-% and full calc (nested/multi-op) noted.
- One PR merged to `main`.

## Out of scope
Length for gap/margin/borderRadius (stay px), multi-operand/nested `calc`, `ch`/`em`/`%`-of-height edge cases, container queries, `min()`/`max()`/`clamp()` CSS funcs.
