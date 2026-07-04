# H4 — Dialog + Drawer + Toast — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD. Born-native.

Design: `docs/superpowers/specs/2026-07-04-h4-dialog-drawer-toast-design.md`. Builds on H0-H3 + NF.

**Reuse:** `Portal`/`computePlacement`/`getAbsRect`/`Presence` (primitives), `useOverlays` (runtime), `createCompoundContext`, `useWidgetTheme`, `mergeStyles`, `useAnnounce`, `keys` (widgets). Reference `select.ts`/`combobox.ts` (Portal overlay + catcher + createEffect drive), `popover.ts`. `SemanticsNode`/`collectSemantics` in runtime; bridge in platform-web.

---

### Task 1: focus-trap infra (host + runtime + bridge)
- `@cairn/host` `accessibility.ts`: add `modal?: boolean` + `modalGroup?: number` to `SemanticsNodeData`.
- `@cairn/runtime` `semantics.ts`: add `modal?: boolean` to `SemanticsNode`; in `collectSemantics` propagate a `modalGroup`: pass a `currentModalId` down the walk — when entering a node with `modal===true`, set `currentModalId = that node's id`; tag every emitted `SemanticsNodeData` (the modal node + all descendants) with `modalGroup = currentModalId` when set. (Nodes outside any modal have no modalGroup.)
- `@cairn/platform-web` `web-accessibility.ts` `sync`: after reconciling, determine the active modal id = the id of the (last) node with `modal===true`, if any.
  - If a modal is active: for every element whose node.modalGroup !== activeModalId → set `tabindex=-1` and `aria-hidden=true` (background inert); for elements in the group leave tabindex as computed.
  - Focus containment: add a document `focusin` listener (lazy, active only while a modal exists) — if focus lands on an element NOT in the active modal group (or outside the container), redirect to the first focusable element of the group (`.focus()`).
  - When no modal is active: remove aria-hidden and the focusin trap; restore normal tabindex (updateAttributes already sets tabindex each sync, so just don't force -1).
- Tests: `collectSemantics` tags descendants of a modal node with modalGroup (build a tree: modal content with nested button → button.modalGroup === content.id; a sibling outside → no modalGroup). Bridge (jsdom): with a modal node present, a non-group element gets tabindex -1 + aria-hidden; focusin on a non-group element redirects into the group; removing the modal restores.
- Commit: `feat(host/runtime/platform-web): modal focus-trap infra (modal/modalGroup + bridge inert+trap)`.

### Task 2: `Dialog` (compound, modal)
- New `packages/widgets/src/dialog.ts`. `createCompoundContext('Dialog')`. `Dialog({ open?, defaultOpen?, onOpenChange?, children })` controlled/uncontrolled. Parts: `Dialog.Trigger` (chains onClick to open; carries expanded), `Dialog.Content` (Portal → dim backdrop Box (click→close) + a themed surface with `semantics={ role:'dialog', modal:true, label from Title }`, `autoFocus:true` on first focusable / the content, Escape via onKeyDown→close), `Dialog.Title`, `Dialog.Description`, `Dialog.Close` (button→close). On close, return focus to the trigger (trigger `autoFocus` on close, or store nothing and set trigger focusable). Themed surface + 3-layer. Optional Presence enter/exit.
- Export from index. Tests `packages/widgets/test/dialog.test.ts`: open/close (trigger/controlled/Escape/backdrop/Close); Content has role dialog + modal; Title sets the dialog label.
- Commit: `feat(widgets): Dialog (modal, focus-trap, backdrop, Escape)`.

### Task 3: `Drawer` (edge sheet, modal)
- New `packages/widgets/src/drawer.ts`. Reuse Dialog's modal machinery (factor a shared internal helper if clean, else mirror). `Drawer({ open?, side?='right', onOpenChange?, children })` + `Drawer.Trigger/Content/Close`. Content is a full-height (left/right) or full-width (top/bottom) panel anchored to `side`, role=dialog + modal, backdrop, Escape, focus-trap. Slide transition via `transition`/Presence (optional).
- Export. Tests `packages/widgets/test/drawer.test.ts`: open/close; side positioning; role dialog + modal.
- Commit: `feat(widgets): Drawer (edge sheet, modal, focus-trap)`.

### Task 4: `Toast` (queue + announce)
- New `packages/widgets/src/toast.ts`. `ToastProvider({ children, placement?='bottom-right' })` — a context with a queue signal; renders a Portal stack of toast surfaces in the corner. `useToast()` → `{ toast(opts), dismiss(id) }`. `toast({ title, description?, variant?='default', duration?=4000 })` pushes; auto-dismiss after `duration` via `useHost().scheduler` (or a timer) — remove from queue; each toast dismissible (Close). Announce each via `useAnnounce` (assertive for variant 'error'/'destructive', else polite). Each surface `semantics={ role:'status' }` (or 'alert' for error) with the title/description as label. Themed.
- Export. Tests `packages/widgets/test/toast.test.ts`: toast() enqueues; dismiss removes; auto-dismiss after duration (fake clock/scheduler); announce called with correct assertiveness; useToast throws outside provider.
- Commit: `feat(widgets): Toast (queue, auto-dismiss, announcements)`.

### Task 5: README + demo + browser verify (controller)
- README catalog: Dialog/Drawer/Toast → ✅.
- Demo (`examples/h4` or extend): a Dialog (open→trapped focus, Escape closes), a Drawer, a Toast trigger. Canvas parent positioned.
- Browser: a11y snapshot `dialog [modal]`; Tab stays inside dialog + background inert; Escape/backdrop close; Toast appears + announced + auto-dismisses. Full `pnpm test` + `pnpm typecheck` green.
- Commit: `docs(widgets): H4 demo + README (Dialog/Drawer/Toast)`.

---

## Self-review
- Focus-trap uses NF1 primitives (autoFocus/focus) + new modal/modalGroup propagation + bridge inert/containment.
- Toast reuses NF1 announce; non-modal.
- LESSONS: overlay content is collected (NF3 mount fix) so dialog/toast semantics reach the a11y tree; verify via browser_snapshot; `mainAxisSize` is a prop; avoid greedy fill.
