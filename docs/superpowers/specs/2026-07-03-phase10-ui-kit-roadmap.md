# Phase 10 — Extended Primitives / Full UI-Kit (M6) — Roadmap

**Date:** 2026-07-03
**Status:** approved decomposition
**Goal (M6):** a complete UI-kit — the requested Button, Image (loading/cache/spinner), ScrollView (virtual viewport, clip, inertia, scrollbar), Checkbox, TextInput, Spacer, TextArea, Form (submit + validation), plus a demo using everything together.

## Already shipped (prior phases)
Button / Checkbox / Switch / Slider / Divider (`@cairn/widgets`); `Input` = TextInput (Phase 8); `Image` (ImageHandle + objectFit); `ScrollView` (clip + wheel/drag + scrollbar, PR #22). Phase 10 fills the gaps + the showcase.

## Sub-phases
- **P10-1 — Spacer + TextInput alias.** `Spacer` (flex filler / fixed gap); export `Input as TextInput`.
- **P10-2 — Image async.** `Image` accepts `src: string` (URL): async load, module-level cache, loading spinner + error fallback (keeps the existing `ImageHandle` path).
- **P10-3 — ScrollView inertia.** Momentum/inertia fling after drag release. (Virtualization DESCOPED — out of scope for the framework for now.)
- **P10-4 — TextArea.** Multi-line text input on the text-input seam + S2 multi-line text engine.
- **P10-5 — Form + validation.** `Form` container, field registration, validation rules, submit handling, per-field errors.
- **P10-6 — M6 showcase demo.** One example app using every primitive/widget together.

## Order
P10-1 → P10-2 → P10-3 → P10-4 → P10-5 → P10-6. Each: spec → plan → subagent execution → PR → merge, flipping `docs/styling-and-capabilities.md` rows where relevant.

## Note
The Animations v2 block (AN5 keyframes/orchestration, AN6 value-drivers/reduced-motion, SV1/SV2 SVG) is paused; resume after Phase 10.

## Out of scope
Rich-text editing / contenteditable-grade TextArea, form schema libraries, async field validation debouncing beyond a simple hook, drag-reorder in ScrollView, image lazy-load-on-scroll (can layer later).
