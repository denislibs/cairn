# H5 — Navigation (Tabs/Accordion/Stepper/Breadcrumbs/Pagination) — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD. Born-native (declare semantics via NF toolkit; reactive fields via createEffect).

Builds on H0-H4 + NF. **Reuse:** `useWidgetTheme`, `mergeStyles`, `createCompoundContext`, `createRoving`/`keys` (widgets/native), `Show`, `Box/Row/Column/Text/Icon`, `createSignal`/`createEffect`. Reference `radio.ts`/`select.ts` (roving + compound + reactive semantics + focus-visible outline). Add missing `SemanticsRole`s to `packages/host/src/accessibility.ts` as needed: `tab`(exists), `tablist`, `tabpanel`, `region`, `navigation`, `list`, `listitem`, `link`(exists), `separator`.

---

### Task 1: `Tabs` (compound, roving)
- New `packages/widgets/src/tabs.ts`. `createCompoundContext('Tabs')` value `{ value, setValue, orientation, activation:'automatic'|'manual', register(v)->index, activeIndex }`. `Tabs({ value?/defaultValue?, onChange?, orientation?='horizontal', activation?='automatic', children })`. Parts: `Tabs.List` (role=tablist), `Tabs.Tab({ value, disabled?, children })` (role=tab, aria-selected = value===current, roving via createRoving: only selected/active tab focusable; ArrowLeft/Right (or Up/Down for vertical) move; on 'automatic' moving also selects, on 'manual' Enter/Space selects; onActivate selects), `Tabs.Panel({ value, children })` (role=tabpanel; rendered only when value===current via Show). Themed underline/pill for the active tab; focus-visible ring.
- Export from index. Tests `tabs.test.ts`: tablist/tab/tabpanel roles; selecting a tab shows its panel + aria-selected; roving arrows move (+select on automatic); only active panel rendered; disabled tab skipped.
- Commit: `feat(widgets): Tabs (tablist/tab/tabpanel, roving, automatic/manual)`.

### Task 2: `Accordion` (compound)
- New `packages/widgets/src/accordion.ts`. `createCompoundContext('Accordion')` value `{ isOpen(value), toggle(value), type:'single'|'multiple' }`. `Accordion({ type?='single', value?/defaultValue?, onChange?, collapsible?, children })`. Parts: `Accordion.Item({ value, children })`, `Accordion.Trigger({ children })` (role=button, aria-expanded, onActivate toggles the item; focus-visible), `Accordion.Content({ children })` (role=region; rendered when open via Show; themed). Single vs multiple open.
- Export. Tests `accordion.test.ts`: trigger toggles content; single-type closes others; multiple keeps several open; aria-expanded reflects; content rendered only when open.
- Commit: `feat(widgets): Accordion (single/multiple, aria-expanded, region)`.

### Task 3: `Stepper`
- New `packages/widgets/src/stepper.ts`. `Stepper({ steps: {label, description?}[], active: number, orientation?='horizontal', style? })` — a row/column of step indicators (circle w/ number or check when completed, connector line, label). Semantics: container role=list (or group), each step role=listitem with `aria-current` on the active step; completed steps labeled done. Themed. Mostly display + `onStepClick?` optional.
- Export. Tests `stepper.test.ts`: renders N steps; active step marked (aria-current); completed vs upcoming state; onStepClick fires.
- Commit: `feat(widgets): Stepper (steps, active/completed, aria-current)`.

### Task 4: `Breadcrumbs` + `Pagination`
- `packages/widgets/src/breadcrumbs.ts`: `Breadcrumbs({ items: {label, onClick?}[], separator?='/', style? })` — role=navigation (aria-label 'Breadcrumb'), a Row of items separated by `separator`; each item a link (role=link, onActivate=onClick) except the last which is `aria-current='page'` (plain text). Themed.
- `packages/widgets/src/pagination.ts`: `Pagination({ page, count, onChange, siblingCount?, style? })` — role=navigation (aria-label 'Pagination'); Prev/Next buttons (disabled at ends) + page number buttons (with ellipsis for large ranges via a small pure `paginationRange(page,count,sibling)` helper); the current page button has `aria-current='page'`. Themed; focus-visible.
- Export both. Tests `breadcrumbs.test.ts` (items render; last is current; onClick fires) + `pagination.test.ts` (range with ellipsis; Prev/Next disabled at ends; onChange fires; current page aria-current).
- Commit: `feat(widgets): Breadcrumbs + Pagination (navigation, aria-current)`.

### Task 5: README + demo + browser verify (controller)
- README catalog: Tabs/Accordion/Stepper/Breadcrumbs/Pagination → ✅.
- Demo (`examples/h5`): Tabs (switch panels), Accordion (expand), Stepper, Breadcrumbs, Pagination. Canvas parent positioned.
- Browser a11y snapshot: `tablist`→`tab [selected]`+`tabpanel`; accordion `button [expanded]`+`region`; `navigation` with links + `aria-current`. Keyboard: Tab arrows switch; accordion Enter toggles. Full test+typecheck green.
- Commit: `docs(widgets): H5 navigation demo + README`.

---

## Self-review
- Born-native; reuse createRoving (Tabs), announce not needed; roles added to host union.
- LESSONS: overlay collection (n/a — these are inline), mainAxisSize is a prop, verify via browser_snapshot, focus events don't fire on .focus() in headless (verify roles/state via snapshot, keyboard via onKeyDown/dispatch).
