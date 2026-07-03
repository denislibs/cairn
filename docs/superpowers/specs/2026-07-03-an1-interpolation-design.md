# AN1 — Structured interpolation + transition for all props — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Animations v2 + SVG roadmap (AN1).

## Goal
Make (nearly) every visual/layout style property animatable via declarative `transition`, on every primitive — by teaching `interpolateValue` to interpolate structured style values and expanding `createStyleTransitions` accordingly.

## Current state
`interpolateValue(a, b, t)` handles `number` (lerp) and color strings (lerpColor); everything else snaps. `createStyleTransitions(resolved)` animates only `opacity`/`backgroundColor`/`color`, and only `Box`/`Text` route through it. Animated style flows through each primitive's `bind` into its layout/paint — so once a prop is in the animatable set and interpolable, layout-affecting props (width/height/padding…) animate for free (the scheduled frame relays out).

## 1. Structured interpolation (`@cairn/style`)
Extend `interpolateValue(a, b, t)` (and add typed helpers) to handle:
- **number** → `lerp` (as now).
- **color string** → `lerpColor` (as now).
- **Length string** (`'50%'`, `'12px'`, `'2rem'`, `'10vw'`): parse `{ value, unit }`; if units match → lerp value, reattach unit; if mismatched (or `auto`/`calc`) → snap at `t≥1`. A bare `number` is px; `'12px'`↔`number` interpolate as px.
- **Transform** (`{translateX?,translateY?,scale?,scaleX?,scaleY?,rotate?,skewX?,skewY?}`): lerp each field with identity defaults (translate 0, scale 1, rotate/skew 0).
- **Shadow** (`{color,blur,offsetX,offsetY,spread?,inset?}`): lerp numbers, lerpColor color, keep `inset`. Array of shadows: interpolate index-wise when lengths match, else snap.
- **Radii** (`number | {tl,tr,br,bl}`): lerp; normalize a number to four corners when the other side is per-corner.
- **EdgeInsets** for padding/margin (`number | {top,right,bottom,left}`): lerp; normalize number↔object.
- **gradient** (`{kind, stops, ...}`): if same `kind` and equal stop count → lerp stop offsets+colors and endpoints; else snap. (Best-effort; document.)
- Fallback: snap at `t≥1` (unchanged).
Dispatch by shape: try number → color → Length-string → then object shape detection (has `translateX`/`scale`/`rotate`… → Transform; `blur`+`offsetX` → Shadow; `tl` → Radii; `top`+`left` → EdgeInsets; `stops` → gradient). Keep helpers pure + individually unit-tested.

## 2. Expanded `createStyleTransitions` (`@cairn/primitives`)
- `ANIMATABLE` grows to: `opacity`, `backgroundColor`, `color`, `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `padding`, `margin`, `gap`, `borderRadius`, `border`, `boxShadow`, `transform`, `letterSpacing`, `lineHeight`. (`backgroundGradient` optional via gradient interp.)
- **Change detection for objects:** `target === current` (reference) fails for objects. Use a value comparison: for object/array props compare via a stable stringify; only start a tween when the target value actually changed. Seed per-prop signals from the initial resolved value.
- **Tween:** unchanged mechanism — `animate({from:0,to:1,duration,easing,delay,onUpdate:(t)=>set(interpolateValue(from,to,t)), onDone:()=>set(to)})`; cancel prior tween on retarget. Non-transitioned props snap.
- Returned accessor overrides only the props with a live signal value (`!== undefined`), spread over `resolved()`.
- Performance guard: the whole thing stays a no-op passthrough when `resolved().transition` is absent (fast path — skip signal/effect machinery when no `transition` ever set). Keep the existing behavior where non-transitioned props snap synchronously.

## 3. Route all primitives
`Flex` (Row/Column), `Grid`, `Image`, `ScrollView` currently `bind(resolved, …)` directly. Change them (like Box/Text in S7) to `bind(createStyleTransitions(resolved), …)`. `Image` has no `createInteractive` resolved — give it a resolved accessor or wrap its style; if `Image`/`ScrollView` don't use `createInteractive`, add minimal style resolution or skip those two for v1 (document). Box/Text already routed. Priority: Flex + Grid (most common animated containers).

## Testing
- `interpolateValue`/helpers: number, color, Length (same-unit lerp, mismatch snap, px↔number), Transform (per-field + identity defaults), Shadow (+array index-wise), Radii (number↔object), EdgeInsets (number↔object), gradient (same-kind lerp / mismatch snap), unknown → snap.
- `createStyleTransitions`: transitioned `width` tweens through intermediate numbers (fake clock); `transform` object tweens per-field; object change detection starts a tween only on real change; non-transitioned snaps; no-transition fast path passes through.
- primitives: Flex/Grid route through transitions (a transitioned prop animates); Box/Text unchanged.
- Full `pnpm test` + `pnpm typecheck` green; no `transition` → identical behavior.

## Exit criteria
- All listed props animate via `transition` on Box/Text/Flex/Grid (Image/ScrollView documented if deferred); structured interpolation tested.
- Live browser check: a box animating width + transform (scale/rotate) + boxShadow + backgroundColor on a toggle.
- Capability doc §8 `transition` row updated to list the full animatable set. One PR merged.

## Out of scope
Spring velocity carry-over (AN2), enter/exit (AN3), keyframes-of-many-props (AN5), animating `filter` string / per-side borders individually (snap for now).
