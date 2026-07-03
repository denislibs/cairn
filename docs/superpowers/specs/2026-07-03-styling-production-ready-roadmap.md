# Cairn — Production-Ready Styling: Roadmap (S1–S7)

**Date:** 2026-07-03
**Status:** approved decomposition
**Goal:** Bring Cairn's styling/layout to a production-ready, "web-parity" level. Everything below is styling/layout; non-styling infrastructure (scroll, overlays, gestures, a11y, perf, routing, i18n) follows this block.

Each sub-phase is its own spec → plan → subagent execution → PR → merge, and flips its rows in `docs/styling-and-capabilities.md` to ✅ when it lands. Built in order; the framework stays green after each.

## Sub-phases

### S1 — Overflow / clipping
`overflow: visible | hidden | clip` on containers; children clipped to the (rounded) content box via a new renderer `clipRoundRect`. Foundational — unblocks ellipsis, image cropping, and later scroll. (`overflow: scroll` deferred to the ScrollView infra phase.)

### S2 — Text engine
Split `font` shorthand into `fontFamily` / `fontSize` / `fontWeight` / `fontStyle` (shorthand still supported, composed to a canvas font string). `letterSpacing`, `textDecoration` (underline / line-through), `textTransform` (upper / lower / capitalize). Multi-line: word-wrapping in `TextNode` via `measureText`, per-line layout honoring `textAlign` + `lineHeight`, `maxLines` + `ellipsis` truncation. (Text selection deferred — interaction-heavy.)

### S3 — Transforms + effects
Renderer: affine `transform(a,b,c,d,e,f)` (or `rotate`), applied around a `transformOrigin`. Style: `transform` (translate / scale / rotate / skew), `transformOrigin`. Shadows: multiple shadows, `spread`, `inset`; `elevation` presets. `filter` (blur / brightness / contrast / …) and `backdropFilter` via canvas `ctx.filter`. `backgroundImage` on `Box` (+ size / position / repeat subset).

### S4 — CSS Grid
New `GridNode` in `@cairn/layout`: `gridTemplateColumns` / `gridTemplateRows` (px, `fr`, `repeat()`, `auto`, `minmax` subset), row/column gaps, item placement (`gridColumn` / `gridRow` with line/`span`), `gridTemplateAreas`, and `justifyItems` / `alignItems` / `justifyContent` / `alignContent`. New `Grid` primitive.

### S5 — Units & responsive
Introduce a `Length` value type (`number` px, `'50%'`, `'10vw'` / `'vh'`, `'1.5rem'`, `'auto'`, and a small `calc()` subset) replacing bare numbers where sizing/spacing apply. Resolve against a context (parent extent, viewport = `SurfaceMetrics`, root font size). Media-queries / breakpoints: reactive to `SurfaceMetrics` via a `useBreakpoint()` hook and responsive style selection. Deep but high-value refactor of the style→layout path.

### S6 — Theme, tokens, variants, cursor
Live light/dark theme switching (reactive theme; currently theme isn't reactive on change). Design tokens (spacing / typography / palette / radius scales) as first-class theme structure. Component `variant` system (`variant="primary"`). Interaction styling: `cursor` (per-node, surfaced to the platform canvas), `pointerEvents: none` (skip hit-testing), `userSelect`.

### S7 — Animations & transitions
`transition` (property / duration / easing / delay) animating style changes over frames via the scheduler. Keyframe animations; spring physics; list enter/leave + FLIP reordering. Sits on top of the reactive style + frame scheduler.

## After S7 (out of this block — the non-styling remainder)
ScrollView + virtualization; Portal / Modal / Tooltip / Popover; gestures (drag / swipe / long-press / pinch / pointer-capture); forms (validation / groups / submit); a11y (ARIA mirror / focus-ring / live-regions); performance (dirty-region / layer cache); routing; i18n / RTL; text selection; full SVG document parser; drag-n-drop / clipboard.

## Sequencing
S1 → S2 → S3 → S4 → S5 → S6 → S7. Rationale: S1 is foundational and cheap; S2 (text) is the biggest visible gap; S3 rounds out visual effects; S4 (Grid) is independent; S5 (units) is a deep refactor best done once the visual features exist to exercise it; S6 ties theme/variants together; S7 (animation) sits on everything else.
