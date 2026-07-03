# Cairn — Animations v2 + SVG: Roadmap

**Date:** 2026-07-03
**Status:** approved decomposition
**Goal:** Complete the animation system beyond S7 (which shipped easing/interpolation, `animate`, `animateKeyframes`, and declarative `transition` for opacity/color/backgroundColor on Box/Text), and add full SVG-document support.

Each sub-phase is its own spec → plan → subagent execution → PR → merge, and flips its rows in `docs/styling-and-capabilities.md`. Built in order; framework stays green after each.

## Animations v2

### AN1 — Structured interpolation + transition for all props, on all primitives
Extend `interpolateValue` to `Length`, `Transform`, `Shadow`, `Radii`, `EdgeInsets` (and gradients where feasible). Expand `createStyleTransitions`'s animatable set to size/padding/margin/gap/borderRadius/border/boxShadow/transform/letterSpacing/lineHeight (+ the S7 three). Object-aware change detection. Route `Flex`/`Grid`/`Image`/`ScrollView` through `createStyleTransitions` (today only Box/Text). Layout-affecting props animate for free because the animated style flows through each primitive's `bind` into its layout node → relayout on the scheduled frame.

### AN2 — Real spring + interruptible driver
Velocity-based spring (stiffness/damping/mass, duration-less), with velocity carry-over when the target changes mid-flight. `spring` becomes a first-class option for `animate`/`transition` (not just a t-easing). Interruptible transitions keep position AND velocity continuity.

### AN3 — Enter/Exit presence (`AnimatePresence`)
Keep an element mounted through its exit animation, then remove. Integrates with control-flow (`Show`/`For`): on removal, run the exit transition before disposing. `onEnter`/`onExit` hooks.

### AN4 — FLIP list animations
Smooth reorder/add/remove in `For`: capture child positions before reconcile, animate from old→new offset after. Builds on AN1's transform animation.

### AN5 — Rich keyframes + declarative `animation` + orchestration
Multi-property keyframes across %-stops, per-keyframe easing, `iterations`/`loop`, `direction: alternate`, `fillMode`, delay. A declarative `animation` on style. A `useAnimation` controller (play/pause/reverse/seek), `stagger`, sequence/parallel groups, `onTransitionEnd`.

### AN6 — Value drivers + reduced-motion
Progress driven by scroll offset or a gesture value (not only time) — a driver abstraction (time vs value). Respect `prefers-reduced-motion` (skip/shorten).

## SVG

### SV1 — SVG document: parser + shapes + render
Parse an `<svg>` string → a shape tree: `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `g` (nesting + `transform`), `viewBox`; attributes `fill`, `stroke`, `stroke-width`, `opacity`, `transform` (translate/scale/rotate/matrix). Render via the canvas renderer (`fillPath`/`strokePath`, existing `Path`/matrix ops). Component `<Svg src="...">` sized to a box, scaled from viewBox.

### SV2 — SVG defs: gradients, `<use>`, clipPath
`<defs>`, `linearGradient`/`radialGradient` (referenced by `fill="url(#id)"`), `<use href>`, basic `<clipPath>`.

## Order
AN1 → AN2 → AN3 → AN4 → AN5 → AN6 → SV1 → SV2.

## Out of scope (separate phases)
- **Performance:** dirty-region / layer cache — important when many animations run at once (currently the whole frame repaints), but its own phase.
- **SVG full spec:** filters, masks, patterns, `<text>`, SMIL/`animateMotion`.
