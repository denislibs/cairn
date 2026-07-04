# H4 — Dialog + Drawer + Toast — Design

**Date:** 2026-07-04. Born-native. Lands the **modal focus-trap** (deferred from NF1).

## Goal
`Dialog` (modal), `Drawer` (edge sheet), `Toast` (transient notifications) in `@cairn/widgets`.

## Focus-trap infra (the hard part)
- `SemanticsNode.modal?: boolean` (on a Dialog/Drawer content node). `SemanticsNodeData` gains `modal?` + `modalGroup?: number`.
- `collectSemantics` propagates: while walking a subtree under a node with `modal:true`, every descendant `SemanticsNodeData` is tagged `modalGroup = <the modal node's id>` (and the modal node itself). This encodes "these nodes are inside the modal" from the flat list.
- Bridge: when any node has `modal:true` (a modal is open) → (a) set `tabindex=-1` + `aria-hidden`ish on all elements whose `modalGroup !== activeModalId` (background inert), (b) **trap focus**: on `focusin` landing outside the active modal group, redirect focus to the first focusable element of the group. `autoFocus` handles the initial focus into the dialog. When no modal node present, restore normal tabindex.

## Dialog (compound)
`Dialog({ open?, defaultOpen?, onOpenChange?, children })` + parts `Dialog.Trigger`, `Dialog.Content` (role=dialog, modal:true, aria-modal), `Dialog.Title`, `Dialog.Description`, `Dialog.Close`. Portal + dim backdrop (click closes), Escape closes (via content onKeyDown), focus-trap (infra above), focus returns to the trigger on close (trigger autoFocus). Themed surface, 3-layer style. Enter/exit via `Presence` (optional).

## Drawer
`Drawer({ open?, side?='right', children })` — same modal machinery as Dialog but the content slides in from an edge (`side`), full-height/width panel. Reuse Dialog internals where possible (a shared modal-overlay helper).

## Toast (queue + announce)
`ToastProvider` (context + a queue) + `useToast()` → `toast({ title, description?, variant?, duration? })`. Renders a stack of toast surfaces in a corner (Portal, non-modal), each auto-dismisses after `duration` (host scheduler timer), dismissible. Each toast **announced** via `useAnnounce` (assertive for errors, polite otherwise). role=status/alert (aria-live). No focus-trap (non-modal).

## Verification
Unit tests (open/close, focus-trap infra: modalGroup propagation + bridge inert/trap, toast queue/dismiss/announce). Browser a11y snapshot: `dialog [modal]` with trapped focus (Tab stays inside; background inert); Escape/backdrop close; Toast announced + auto-dismisses.

## Out of scope
Nested dialogs, drag-to-dismiss drawer, toast swipe, alertdialog role variant (add later), scroll-lock of the background page.
