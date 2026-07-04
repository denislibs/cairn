# H6 — Data display (Card/List/Avatar/Badge/Chip/Progress/Skeleton/Table) — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD. Born-native (declare `instance.semantics`; reactive fields via `createEffect`). DOM-free — only `@cairn/platform-web` may touch DOM.

Builds on H0–H5. **Reuse:** `useWidgetTheme`, `mergeStyles`, `createCompoundContext`, `applyLayoutChildProps`, `Box/Row/Column/Text`, `createSignal`/`createEffect`, `LayoutChildProps`/`StyleInput`. Reference `divider.ts` (minimal flat), `button.ts` (semantics + 3-layer), `stepper.ts`/`breadcrumbs.ts` (flat + per-child semantics), `tabs.ts`/`accordion.ts` (compound via `createCompoundContext`). `Divider` already ✅.

Foundation already landed on this branch: `SemanticsRole` gains `progressbar`/`table`/`row`/`cell`/`columnheader`; web bridge applies `aria-valuemin/max/now` to `progressbar` too (same block as `slider`).

3-layer customization for every component: (1) theme tokens, (2) `style?: StyleInput` override via `mergeStyles`, (3) where a component wraps content, accept `Instance | string` children and wrap strings in `Text`. Every component spreads `applyLayoutChildProps(instance, props)` and extends `LayoutChildProps`.

**Each task: create `packages/widgets/src/<name>.ts` + `packages/widgets/test/<name>.test.ts` only. DO NOT edit `index.ts` (the controller wires all exports at the end to avoid conflicts).**

---

### Task 1: `Card` (flat surface)
- `Card({ children: Instance | Instance[], padding?, elevation?: 0|1|2|3, interactive?: boolean, onClick?, style? })`. A themed surface `Box`/`Column`: `backgroundColor: t.colors.surface`, `borderRadius: t.radii.lg`, border or `boxShadow` by `elevation`. When `interactive`, add `createControl` (focusable, Enter/Space, `cursor:pointer`) and `role: 'button'`; otherwise `role: 'group'`. Accept an array of children (Column) or a single instance.
- Tests: renders children; `interactive` → role button + onClick via `onActivate`; non-interactive → role group; elevation changes style.
- Commit: `feat(widgets): Card (surface, elevation, optional interactive)`.

### Task 2: `Avatar` (flat)
- `Avatar({ src?: string, alt?: string, initials?: string, size?: number=40, shape?: 'circle'|'square', style? })`. A `Box` sized `size×size`, `borderRadius` = size/2 (circle) or `t.radii.md` (square), `backgroundColor: t.colors.muted`. If `src`, render an `Image` (from `@cairn/primitives`) filling the box; else center `Text` with `initials`. Semantics: `role:'image'`, `label: alt ?? initials`.
- Tests: initials rendered when no src; role image with label from alt/initials; size/shape affect style.
- Commit: `feat(widgets): Avatar (image/initials, circle/square)`.

### Task 3: `Badge` (flat)
- `Badge({ children?: Instance|string, content?: string|number, color?: string='primary', variant?: 'solid'|'soft'='solid', dot?: boolean, max?: number=99, style? })`. Small pill `Box` with themed bg (color base key) + `Text` of `content` (numbers > max render `{max}+`); `dot` renders a tiny circle with no text. If `children` given, this is a wrapper that overlays the badge at top-right of the child (Stack); else standalone pill. Semantics: `role:'status'` with `label` describing count (e.g. `"5 notifications"`), or `role:'none'` when purely decorative dot.
- Tests: numeric content over `max` shows `99+`; dot mode has no text; standalone vs wrapping a child; status role + label.
- Commit: `feat(widgets): Badge (count/dot, overlay or standalone)`.

### Task 4: `Chip` (flat)
- `Chip({ label: string, color?: string='primary', variant?: 'solid'|'soft'|'outline'='soft', size?: 'sm'|'md'='md', onClick?, onDelete?, disabled?, leading?: Instance, style? })`. Rounded-full `Row` (gap) with optional `leading` slot, `Text` label, and — when `onDelete` — a trailing `×` delete affordance (its own focusable control, `role:'button'`, `label:'Remove'`, `onActivate: onDelete`). If `onClick`, the chip itself is `role:'button'` focusable (Enter/Space via `createControl`); else `role:'none'`/decorative. Disabled dims + blocks handlers.
- Tests: label renders; `onClick` → chip role button + activate; `onDelete` → separate remove button fires onDelete; disabled blocks; variants change style.
- Commit: `feat(widgets): Chip (clickable/deletable, variants)`.

### Task 5: `Progress` (flat)
- `Progress({ value?: number, max?: number=100, indeterminate?: boolean, size?: number=6, color?: string='primary', style? })`. Track `Box` (`t.colors.muted`, `borderRadius: size/2`, height `size`) with a fill `Box` whose width % = `value/max` (themed color). `indeterminate` → no defined now (animation optional/omitted; static partial bar acceptable). Semantics: `role:'progressbar'`, `min:0`, `max`, `now: indeterminate ? undefined : value`; reactive `now` via `createEffect` if `value` is an accessor. Support `value` as `number | Accessor<number>`.
- Tests: fill width reflects value/max; role progressbar with min/max/now; indeterminate omits now; reactive value updates now.
- Commit: `feat(widgets): Progress (determinate/indeterminate, progressbar)`.

### Task 6: `Skeleton` (flat)
- `Skeleton({ width?: number|string, height?: number=16, radius?: number, variant?: 'text'|'rect'|'circle', style? })`. A placeholder `Box` with `backgroundColor: t.colors.muted`, `borderRadius` by variant (circle → height/2, text → `t.radii.sm`, rect → `radius ?? t.radii.md`). Decorative: `role:'none'`. (No shimmer animation required — a solid placeholder is fine; note as future AN work.)
- Tests: dimensions applied; variant sets radius; role none (decorative).
- Commit: `feat(widgets): Skeleton (text/rect/circle placeholder)`.

### Task 7: `List` / `ListItem` (compound)
- `packages/widgets/src/list.ts`. `List({ children: () => Instance, ordered?: boolean, style? })` — a `Column` with `role:'list'`, provides a `createCompoundContext('List')` (empty/minimal value, mainly for future selection). `List.Item({ children: Instance|string, leading?: Instance, trailing?: Instance, onClick?, disabled?, style? })` — a `Row` (leading / content / trailing) with `role:'listitem'`; when `onClick`, focusable + `createControl` (Enter/Space) and `onActivate`. Divider between items optional (leave to consumer).
- Tests: list role; N items → N listitems; leading/trailing slots render; onClick item activates; disabled blocks.
- Commit: `feat(widgets): List + ListItem (compound, listitem, optional click)`.

### Task 8: `Table` (compound)
- `packages/widgets/src/table.ts`. Data-driven: `Table({ columns: { key: string; header: string; width?: number; align?: 'left'|'right'|'center' }[]; rows: Record<string, any>[]; getRowKey?: (row, i) => any; style? })`. Render a `Column`: a header `Row` (`role:'row'`) of `columnheader` cells (Text of `header`), then one `Row` per data row (`role:'row'`) of `cell`s (Text of `row[col.key]`, respecting `align`). Container `role:'table'`. Themed: header bold + border-bottom, row separators, cell padding. Keep it display-only (no sorting/selection this phase — note as future).
- Tests: renders header + N rows × M cells; roles table/row/columnheader/cell; align applied; empty rows renders just the header.
- Commit: `feat(widgets): Table (data-driven, table/row/cell/columnheader)`.

### Task 9 (controller): exports + README + demo + browser verify
- Wire all H6 exports (+ types) into `packages/widgets/src/index.ts`.
- README data-display table: Card/List/Table/Avatar/Badge/Chip/Progress/Skeleton → ✅.
- Demo `examples/h6`: Card wrapping a List (with Avatars + Badges), a Chip row (deletable), Progress bars, a Skeleton block, and a Table. Positioned canvas parent.
- Browser + a11y snapshot: `table`→`row`/`columnheader`/`cell`; `list`→`listitem`; `progressbar` with aria-value*; `image` avatars with labels; interactive Card/Chip as `button`. Full test + typecheck green.
- Commit: `docs(widgets): H6 data-display demo + README`.

---

## Self-review
- Born-native; roles added to host union + progressbar range wired in bridge (foundation already on branch).
- LESSONS (from H5): string children must be wrapped in `Text` AND surfaced as `aria-label` (raw strings in `children` crash paint/semantics); container roles (tabpanel/region) should be emitted only when visible — here every H6 node is always visible so no toggling needed; `<a>` needs explicit `role='link'`; verify via `browser_snapshot`; focus events don't fire on `.focus()` in headless (verify roles/state via snapshot, activation via clicking the mirror element / `onActivate`).
- YAGNI: no Table sorting/selection, no Skeleton shimmer, no Badge animation this phase.
