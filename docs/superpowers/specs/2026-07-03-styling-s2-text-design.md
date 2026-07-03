# Styling S2 — Text Engine — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** production-ready styling roadmap (S2 of S7).

## Goal
Turn `Text` from single-line into a real text engine: font longhands, `letterSpacing`, `textTransform`, `textDecoration`, multi-line word wrapping, per-line alignment/lineHeight, and `maxLines` + `ellipsis` truncation.

## Current state
`TextNode` (`@cairn/layout`) measures one line via `ctx.measureText(text, style)` and sizes to it. `Text` (`@cairn/primitives`) paints a single `drawText`. `BaseStyle` has `font`, `color`, `textAlign`, `lineHeight`, `textShadow`. `TextStyle` (`@cairn/host`) = `{ font, color?, align?, baseline? }`.

## Design

### 1. Font longhands + composition
`BaseStyle` gains `fontFamily?`, `fontSize?` (px number), `fontWeight?` (`number | 'normal' | 'bold'`), `fontStyle?` (`'normal' | 'italic'`). A pure `composeFont(s: BaseStyle): string` in `@cairn/style`:
- If any longhand is set, build `` `${fontStyle||'normal'} ${fontWeight||'normal'} ${fontSize||16}px ${fontFamily||'sans-serif'}` ``.
- Else use `s.font ?? '16px sans-serif'`.
`Text` composes the font once per resolved style and passes it to the `TextNode` style + paint. `fontSize` also becomes the default `lineHeight` source.

### 2. letterSpacing
`BaseStyle.letterSpacing?: number` (px). `TextStyle` gains `letterSpacing?: number`. The renderer sets `ctx.letterSpacing = `${n}px`` around `drawText` and `measureText` (reset to `'0px'` after), so wrapping math and painting agree. (Modern canvas supports `ctx.letterSpacing`.)

### 3. textTransform
`BaseStyle.textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'`. Applied to the string in `TextNode` BEFORE measuring/wrapping (so layout matches paint). `Text` reads the same transformed text from the node for painting (the node owns the display text).

### 4. Multi-line wrapping (core)
`TextNode` becomes multi-line:
- New fields: `maxLines?`, `ellipsis?: boolean`, `transform?`, `letterSpacing?` (carried in `style`). Add `lines: string[]` (computed) and expose it for paint.
- `layout(c, ctx)`:
  1. Apply `textTransform` → display text.
  2. Split on `\n` into paragraphs (explicit breaks).
  3. Word-wrap each paragraph to `c.maxW`: greedily accumulate whitespace-separated words, measuring the candidate line via `ctx.measureText(line, style)`; break when adding a word would exceed `maxW` and the line is non-empty. A single word wider than `maxW` occupies its own line (may overflow — documented; char-breaking deferred).
  4. Concatenate to `lines`.
  5. `width` = max measured line width, clamped to `[minW, maxW]`. `lineH` = `lineHeight ?? fontSize(style.font)`. `height` = `lines.length * lineH`, clamped.
  - When `maxW` is `Infinity` (unbounded), no wrapping happens (single line per paragraph) — preserves current behavior for shrink-wrap containers.
- `Text.paintSelf` iterates `layout.lines`, drawing each at `y = i * lineH` (baseline `top`, or centered within `lineH` if `lineHeight` set), `x` per `textAlign`. `textShadow` wraps the whole draw.

### 5. maxLines + ellipsis
After wrapping, if `maxLines` is set and `lines.length > maxLines`: keep the first `maxLines`. If `ellipsis`, truncate the last kept line so `line + '…'` fits `maxW` (drop trailing chars/words until it fits via `measureText`), then append `'…'`. `height` uses the truncated line count.

### 6. textDecoration
`BaseStyle.textDecoration?: 'none' | 'underline' | 'line-through'`. `Text.paintSelf` draws a line per text line after the glyphs: `underline` at `y ≈ baselineY + fontSize*0.1`, `line-through` at `y ≈ lineTop + lineH/2`, spanning the line's measured width from its aligned `x`. Drawn as a thin `fillRect` (color = text color, thickness ≈ max(1, fontSize/16)).

## Testing
- `composeFont`: longhands compose; shorthand fallback; mix defaults.
- `TextNode` wrapping: wraps to maxW at word boundaries; explicit `\n`; unbounded maxW → one line; width=widest line, height=lineCount*lineH; `maxLines` truncates; `ellipsis` appends `'…'` fitting maxW; `textTransform` changes measured/stored text.
- Renderer: `letterSpacing` set/reset around draw+measure.
- `Text` paint: N `drawText` calls (one per line) at correct y/x per align; `textDecoration` emits a fill line; single-line default path unchanged.
- Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- Multi-line wrapping, font longhands, letterSpacing, textTransform, textDecoration, maxLines+ellipsis all work and tested.
- Capability doc §6 rows flipped to ✅ (fontFamily/Size/Weight/Style, letterSpacing, textDecoration, textTransform, maxLines+ellipsis, multi-line wrapping). Leave `wordSpacing` and text selection ❌.
- One PR merged to `main`.

## Out of scope
Text selection (interaction), `wordSpacing`, bidi/RTL, hyphenation, char-level breaking of long words, rich/inline spans.
