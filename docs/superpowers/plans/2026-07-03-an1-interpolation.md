# AN1 — Structured interpolation + transition-for-all — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Interpolate structured style values; make (nearly) all props animatable via `transition` on Box/Text/Flex/Grid.

Design ref: `docs/superpowers/specs/2026-07-03-an1-interpolation-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: style, primitives.

---

### Task 1: structured `interpolateValue` (@cairn/style)
- Files: `packages/style/src/interpolate.ts` (extend), test `packages/style/test/interpolate-structured.test.ts`.
- Add helpers: `parseLength(s): {value:number;unit:string}|null`; `lerpLength(a,b,t)` (same unit → lerp; else snap; number treated as px); `lerpTransform(a,b,t)` (per-field, identity defaults translate0/scale1/rotate0/skew0); `lerpShadow(a,b,t)` (numbers + lerpColor + keep inset); `lerpRadii(a,b,t)` (normalize number↔{tl,tr,br,bl}); `lerpInsets(a,b,t)` (normalize number↔{top,right,bottom,left}); `lerpGradient(a,b,t)` (same kind + equal stop count → lerp endpoints+stops, else snap).
- Rewrite `interpolateValue(a,b,t)` to dispatch: number→lerp; both color strings→lerpColor; both Length strings (or number+px-string)→lerpLength; object shape detection: `stops`→gradient, (`translateX`|`translateY`|`scale`|`scaleX`|`rotate`|`skewX`|`skewY` present)→Transform, (`blur` in a && `offsetX` in a)→Shadow OR array of such→shadow array, (`tl` in a)→Radii, (`top` in a && `left` in a)→Insets; else snap at t≥1. Guard null/undefined (snap).
- TDD: each helper + interpolateValue dispatch (see design testing list). Keep existing number/color tests green.

### Task 2: expand `createStyleTransitions` (@cairn/primitives)
- Files: `packages/primitives/src/transitions.ts` (extend), test `packages/primitives/test/transitions-structured.test.ts`.
- Grow `ANIMATABLE` to: `opacity, backgroundColor, color, width, height, minWidth, maxWidth, minHeight, maxHeight, padding, margin, gap, borderRadius, border, boxShadow, transform, letterSpacing, lineHeight`.
- Object-aware change detection: replace `target === current` with `!valuesEqual(target, current)` where `valuesEqual(a,b)` = `a===b || JSON.stringify(a)===JSON.stringify(b)` (handles objects/arrays; undefined-safe).
- Keep the tween mechanism (animate 0→1 + interpolateValue). Seed signals from initial resolved. Non-transitioned → snap. Returned accessor overrides props whose signal `!== undefined`.
- Fast path: if `untrack(resolved).transition` is undefined AND no transition ever appears, the wrapper should behave as passthrough (acceptable: keep current always-wrap but ensure no tween starts without a config — snap path already does this; verify a no-transition Box has zero animate calls).
- TDD (fake manual-clock host, like S7 transitions test): transitioned `width:100→200` yields intermediate numbers; `transform:{scale:1}→{scale:2}` tweens scale; object change detection starts tween only on real change; non-transitioned width snaps; no `transition` → no animate/passthrough.

### Task 3: route Flex + Grid through transitions
- Files: `packages/primitives/src/flex.ts`, `packages/primitives/src/grid.ts` (change `bind(resolved, …)` → `bind(createStyleTransitions(resolved), …)`), tests extend `packages/primitives/test/transitions-structured.test.ts` or new.
- For `Image`/`ScrollView`: if they don't use `createInteractive`/`resolved`, DOCUMENT as deferred (note in the doc); do not force. Box/Text already routed (S7).
- TDD: a `Row`/`Column` with `transition` animates a transitioned prop (e.g. gap or width) — assert via the manual-clock host that the bound layout value passes through an intermediate.

### Task 4: doc + example + verify
- Update `docs/styling-and-capabilities.md` §8: `transition` row now lists the full animatable set (opacity/color/bg + size/padding/margin/gap/borderRadius/border/boxShadow/transform/letterSpacing/lineHeight) on Box/Text/Flex/Grid; note Image/ScrollView deferred if so. Update the "Анимации" snapshot.
- Extend `examples/overlays` or a small new example: a box that, on a button toggle, animates `width` + `transform:{scale,rotate}` + `boxShadow` + `backgroundColor` with a `transition`. Build with vite; verify live in a browser (Playwright): toggling animates smoothly. Screenshot mid-animation.
- Full `pnpm test` + `pnpm typecheck` green.

---

## Self-review
- Coverage: interpolation (T1), transitions expansion (T2), primitive routing (T3), doc+example (T4).
- Backward-compat: no `transition` → snaps as before; existing S7 opacity/color transitions still work (subset of new set).
- Risk: object change detection via JSON.stringify — fine for small style objects; document. Layout props animate via existing bind→scheduleFrame→relayout (no new plumbing).
