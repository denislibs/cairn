# ScrollView — Design

**Date:** 2026-07-03
**Status:** approved design
**Context:** First feature of the post-styling infrastructure block. Builds on S1 clipping (`Instance.clipChildren` + renderer `clipRoundRect`) and the events wheel/pointer system.

## Goal
A clipped, scrollable container: content is laid out at its natural (overflowing) size, a scroll offset shifts it, wheel + drag scroll it, offset is clamped, an optional scrollbar shows position.

## Components

### `ScrollNode` (`@cairn/layout`)
A single-child container with a fixed viewport size that lets its child overflow along the scroll axis.
- Fields: `width?`/`height?` (`Length`, viewport size), `direction: 'vertical' | 'horizontal' | 'both'` (default `'vertical'`), `scrollX = 0`, `scrollY = 0` (set by the primitive from signals). Computed (exposed): `contentW`, `contentH`, `viewportW`, `viewportH`.
- `layout(c, ctx)`:
  - Resolve viewport size: `viewportW = resolved width ?? c.maxW`, `viewportH = resolved height ?? c.maxH` (fall back to constraint; if infinite, use content). Own `size = { w: viewportW, h: viewportH }`.
  - Lay the child with the scroll axis **unbounded** and the cross axis bounded to the viewport:
    - vertical → `{ minW:0, maxW: viewportW, minH:0, maxH: Infinity }`
    - horizontal → `{ minW:0, maxW: Infinity, minH:0, maxH: viewportH }`
    - both → `{ minW:0, maxW: Infinity, minH:0, maxH: Infinity }`
  - `contentW = child.size.w`, `contentH = child.size.h`.
  - Clamp offsets: `maxScrollY = max(0, contentH - viewportH)` (0 if not vertical), `maxScrollX = max(0, contentW - viewportW)`; `child.offsetX = -clamp(scrollX, 0, maxScrollX)`, `child.offsetY = -clamp(scrollY, 0, maxScrollY)`.
  - Return own size (viewport).
- Exposes `maxScrollX()`/`maxScrollY()` (or fields) so the primitive can clamp input.

### `ScrollView` primitive (`@cairn/primitives`)
`ScrollView({ style, children, direction?, scrollbar?, scrollTop?, scrollLeft?, onScroll? })`:
- Owns `scrollX`/`scrollY` signals; **controlled** when `scrollTop`/`scrollLeft` (value or accessor) is provided (read those + call `onScroll`), **uncontrolled** otherwise (internal signals). `onScroll?(pos: { x: number; y: number })` fires on change.
- Builds a `ScrollNode` around a single content child (wrap multiple children in a Box/Column upstream — `children` is one Instance). Binds `node.scrollX/scrollY` from the signals and `width/height/direction` from style/props in a reactive `bind` (so scroll + resize relayout).
- `clipChildren` = viewport rounded radius (S1) so overflow is clipped.
- **Wheel:** `onWheel(e)` → `setScrollY(clamp(cur + e.deltaY, 0, node.maxScrollY))` (and X for horizontal/both). Prevents default via the existing wheel plumbing.
- **Drag:** `onPointerDown` records start pointer + start offset + sets a `dragging` flag; `onPointerMove` (while dragging) sets offset = start − delta (clamped); `onPointerUp`/`onPointerLeave` clears. Uses `e.localX/localY` (or absolute deltas tracked across moves).
- Structure with scrollbar: returns a `Stack` whose children are `[ scrollViewport (the ScrollNode-backed instance), scrollbar (raw Instance) ]` so the scrollbar paints **on top** and is **not scrolled**. Without `scrollbar`, returns the ScrollNode-backed instance directly. The wheel/drag handlers live on the outer instance (Stack or the node instance).

### Scrollbar (raw Instance)
A thin vertical (and/or horizontal) thumb. Pure math helper `scrollThumb(viewport, content, scroll): { size: number; offset: number }`:
- `size = viewport * viewport / content` (clamped to a min, e.g. 24); `offset = maxScroll === 0 ? 0 : (scroll / maxScroll) * (viewport - size)`.
- `paintSelf` draws a rounded rect thumb on the right edge (vertical) / bottom (horizontal), reading `scrollY()/contentH/viewportH` reactively. Auto-hides when `content <= viewport`.

## Hit-testing
The viewport clips (S1 `clipChildren`), and `hitTest` v1 already gates descent by the parent box, so scrolled-out content isn't hit. Scrolled content uses shifted child offsets, which `hitTest` accounts for via offset accumulation. The scrollbar overlay (`pointerEvents` default auto) sits on top; fine for v1 (dragging the thumb itself is a later enhancement — wheel/content-drag cover v1).

## Testing
- `ScrollNode`: child laid out unbounded on scroll axis (tall child keeps full height); own size = viewport; `contentH` reported; `scrollY` shifts child offsetY by `-clamp`; over-scroll clamps to `maxScrollY`; horizontal + both directions.
- `scrollThumb`: size/offset math incl. min-size clamp and `maxScroll===0` (offset 0, hidden).
- `ScrollView` primitive: wheel handler increments scrollY clamped to maxScrollY; drag updates offset; controlled mode reads `scrollTop` + fires `onScroll`; uncontrolled updates internal signal; `clipChildren` set.
- Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- Wheel + drag scrolling, clamped offset, clipped content, optional scrollbar, controlled/uncontrolled all work + tested.
- A scrollable-list example verified live in a browser (wheel scrolls, clipped, thumb tracks).
- Capability doc §13 `ScrollView` row → ✅ (virtualization still ❌). One PR merged to `main`.

## Out of scope
Virtualization (separate feature), momentum/inertia, scroll-snap, dragging the scrollbar thumb, nested-scroll chaining, keyboard (PageUp/Down/arrows) scrolling.
