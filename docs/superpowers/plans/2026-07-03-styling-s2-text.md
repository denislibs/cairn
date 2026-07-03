# Styling S2 — Text Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Multi-line text with font longhands, letterSpacing, textTransform, textDecoration, wrapping, maxLines+ellipsis.

**Architecture:** `composeFont` in `@cairn/style`; `TextNode` (`@cairn/layout`) owns display-text transform + word-wrapping → `lines[]` + size; `Text` (`@cairn/primitives`) paints each line; renderer gains `letterSpacing` on `TextStyle`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: style, host, platform-web, layout, primitives.

Design reference: `docs/superpowers/specs/2026-07-03-styling-s2-text-design.md`.

---

### Task 1: `composeFont` + font longhands
- Files: `packages/style/src/style.ts` (+`fontFamily/fontSize/fontWeight/fontStyle`), new `packages/style/src/font.ts` (`composeFont`), `packages/style/src/index.ts` (export), `packages/primitives/src/text.ts` (use composeFont for node style + paint), test `packages/style/test/font.test.ts`.
- `composeFont(s)`: longhands → `${fontStyle||'normal'} ${fontWeight||'normal'} ${fontSize||16}px ${fontFamily||'sans-serif'}`; else `s.font ?? '16px sans-serif'`.
- Text: replace `s.font ?? '16px sans-serif'` (both node style bind and paint) with `composeFont(s)`.
- TDD: composeFont cases (longhands, shorthand fallback, weight number/bold, partial defaults). Full suite green.

### Task 2: letterSpacing + textTransform
- Files: `packages/host/src/types.ts` (`TextStyle.letterSpacing?`), `packages/platform-web/src/canvas2d-renderer.ts` (set/reset `ctx.letterSpacing` in `drawText` + `measureText`), `packages/style/src/style.ts` (+`letterSpacing`, `textTransform`), `packages/layout/src/text.ts` (apply transform to display text before measure; carry letterSpacing in style), `packages/primitives/src/text.ts` (pass letterSpacing into node style + paint TextStyle), tests.
- `textTransform` helper (pure): none/uppercase/lowercase/capitalize.
- Renderer: `const prev = this.ctx.letterSpacing; this.ctx.letterSpacing = `${ls||0}px`; …; this.ctx.letterSpacing = prev;` — guard for environments lacking the property (feature-detect / try). In jsdom/mocks the property may be absent — set only if assignable.
- TDD: transform helper; renderer sets letterSpacing; node uses transformed text length.

### Task 3: Multi-line wrapping (core)
- Files: `packages/layout/src/text.ts` (rewrite `layout` → word-wrap to `c.maxW`, `lines[]`, size), `packages/primitives/src/text.ts` (paint each line), tests `packages/layout/test/text-wrap.test.ts` + `packages/primitives/test/text-multiline.test.ts`.
- `TextNode`: add `lines: string[]` field; `layout` splits on `\n`, greedily wraps each paragraph to `maxW` via `ctx.measureText(line, style)`; unbounded `maxW` → one line per paragraph; width=widest line clamped, height=lines.length*lineH.
- `Text.paintSelf`: loop `layout.lines`, draw at `y=i*lineH` (baseline top; center within lineH when `lineHeight` set), `x` per `textAlign` (0 / w/2 / w). textShadow wraps the whole loop.
- TDD: wrap at word boundary (maxW forces 2 lines); `\n` forces break; unbounded → 1 line; size math; paint emits one drawText per line at correct y.

### Task 4: maxLines + ellipsis
- Files: `packages/style/src/style.ts` (+`maxLines`, `ellipsis`), `packages/layout/src/text.ts` (truncate), `packages/primitives/src/text.ts` (pass through), test `packages/layout/test/text-maxlines.test.ts`.
- After wrapping: if `maxLines` and `lines.length > maxLines` → slice; if `ellipsis`, trim last kept line (drop trailing words/chars via measureText) so `line+'…'` fits `maxW`, append `'…'`. height uses truncated count.
- TDD: 5-line text with maxLines 2 → 2 lines; ellipsis appends '…' and fits maxW.

### Task 5: textDecoration
- Files: `packages/style/src/style.ts` (+`textDecoration`), `packages/primitives/src/text.ts` (draw line per text line), test `packages/primitives/test/text-decoration.test.ts`.
- After drawing each line's glyphs, if `underline`/`line-through`, `fillRect` a thin bar (color=text color, thickness=max(1,fontSize/16)) at underline (baseline+~10%) / strike (line vertical center) y, spanning that line's measured width from its aligned x.
- TDD: underline emits a fillRect per line; none emits none.

### Task 6: doc flip + verify
- Flip `docs/styling-and-capabilities.md` §6: fontFamily/Size/Weight/Style ✅, letterSpacing ✅, textDecoration ✅, textTransform ✅, maxLines+ellipsis ✅, multi-line wrapping ✅ (leave wordSpacing, selection ❌). Update BaseStyle snapshot.
- Optional: add a short multi-line/ellipsis demo to an example. Full `pnpm test` + `pnpm typecheck` green.

---

## Self-review
- Spec coverage: font (T1), letterSpacing+transform (T2), wrapping (T3), maxLines/ellipsis (T4), decoration (T5), doc (T6).
- Backward-compat: unbounded maxW → single line; default styles unchanged → existing Text tests green (may need the recording-renderer to expose `letterSpacing`/`measureText`).
- Type consistency: `composeFont(BaseStyle)`, `TextNode.lines`, `TextStyle.letterSpacing`, style fields — consistent across tasks.
