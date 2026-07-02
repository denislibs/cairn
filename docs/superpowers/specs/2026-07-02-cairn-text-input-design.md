# Cairn Phase 8 — Text Input — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** host, runtime (context, Phase 5), events/focus (7c), primitives+style — all merged to main.
**Milestone:** toward v1; foundation for the Phase 9 todo app.

## Goal

Enable typing text into canvas fields. A `TextInputService` platform seam backed by a hidden
DOM `<input>` proxy captures keystrokes/IME/backspace/selection natively; an `<Input>` primitive
mirrors the proxy's value + caret onto the canvas and exposes a Solid-like value API.

## Architecture

The hidden DOM `<input>` is the real editing buffer; the canvas mirrors it.

```
<Input> Cairn-focused (7c) → useHost().textInput.start(client, initial) → connection
  DOM <input> focused ─ typing / IME / backspace ─▶ client.onChange(value) ─▶ text signal + caret → repaint
  Enter ─▶ client.onSubmit()          Escape ─▶ client.onCancel()
  app updates controlled `value` ─▶ guarded effect ─▶ connection.setValue() (sync the DOM buffer)
  Cairn-blur ─▶ connection.close() (blur + detach the DOM input)
```

## Decisions

| Area | Decision |
|---|---|
| Editing buffer | Hidden DOM `<input>` proxy (native typing/IME/backspace/selection) |
| Seam | `TextInputService` in `@cairn/host`; `Host.textInput`; web impl in platform-web |
| `<Input>` reaches the service | `hostContext` + `useHost()` in runtime, populated by `mount` via `runWithContext` |
| Value model | Both: controlled when `value` given (+`onInput`), else internal uncontrolled signal |
| Caret | Non-blinking vertical line at the caret index when focused (blinking → Phase 13) |
| Proxy position | Offscreen (`opacity:0`); IME candidate-window positioning deferred |
| Text overflow | Clipped to the field width; no horizontal scroll in v1 |
| Submit / cancel | Enter → `onSubmit`; Escape → `onCancel` |

## `TextInputService` seam (`@cairn/host`, new `text-input.ts`)

```ts
export interface TextEditingValue {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface TextInputClient {
  onChange(value: TextEditingValue): void; // proxy → framework (typing/IME/selection)
  onSubmit?(): void;                        // Enter
  onCancel?(): void;                        // Escape
}

export interface TextInputConnection {
  setValue(value: TextEditingValue): void;  // framework → proxy (programmatic set)
  close(): void;                            // end the editing session
}

export interface TextInputService {
  start(client: TextInputClient, initial: TextEditingValue): TextInputConnection;
}
```
`Host` gains `textInput: TextInputService`. Exported from the host barrel.

## Host context (`@cairn/runtime`, new `host-context.ts`)

```ts
export const hostContext: Context<Host | null>; // createContext<Host | null>(null)
export function useHost(): Host; // throws if used outside a mount
```
`mount` builds the tree inside the context so descendants can reach host services:
```ts
root = runWithContext(hostContext, host, () => component());
```
(`runWithContext` returns the component's result and runs it in a child owner scope of the
`createRoot`, so effects are still disposed on unmount.) `useHost()` throws a clear error when
`useContext(hostContext)` is `null` (used outside a mounted tree).

## `<Input>` primitive (`@cairn/primitives`, new `input.ts`)

```ts
export interface InputProps extends EventProps {
  value?: MaybeReactive<string>;      // controlled if provided
  onInput?: (text: string) => void;
  onSubmit?: (text: string) => void;
  placeholder?: MaybeReactive<string>;
  style?: StyleInput;                 // supports the focus: variant
}
export function Input(props?: InputProps): Instance;
```

- Always `focusable: true`.
- **State:** `[text, setText]` is the display source of truth; `[caret, setCaret]` (index). Initial
  `text` seeded from `value` (untracked) or `''`.
- **onChange (both modes, optimistic):** `client.onChange(v)` always does
  `setText(v.text); setCaret(v.selectionEnd); props.onInput?.(v.text)`. Updating the local display
  immediately preserves the caret for mid-string edits and keeps `text` equal to the DOM buffer.
- **Controlled sync effect (only when `value` is provided):** syncs *external* changes with a guard:
  `const ext = String(value()); if (ext !== untrack(text)) { setText(ext); setCaret(ext.length); conn?.setValue({ text: ext, selectionStart: ext.length, selectionEnd: ext.length }); }`.
  During normal typing `ext === text` (onChange already set it) → no-op, no loop. Only genuine
  app-driven changes (e.g. clearing on submit) fire it, flowing to display + DOM proxy (caret to end,
  acceptable for a programmatic set).
- **Interaction:** reuse `createInteractive(props)` for the resolved style + hover/pressed/focus
  handlers. Wrap its `onFocus`/`onBlur`:
  - focus → `conn = host.textInput.start(client, { text: untrack(text), selectionStart: untrack(caret), selectionEnd: untrack(caret) })`.
  - `client.onSubmit` → `props.onSubmit?.(untrack(text))`.
  - `client.onCancel` → (v1) no-op beyond the DOM blur.
  - blur → `conn?.close(); conn = null`.
- **Layout:** a `BoxNode` sized from the resolved style (`width`/`height`/`padding`), updated
  reactively via `bind(resolved, …)` exactly like `Box`. No child instances.
- **Paint (`paintSelf`):** background + `borderRadius` (if `backgroundColor`); then, clipped to the
  content box, either the display text (`color`) or, when empty, the `placeholder` in a muted color
  (`#9ca3af`); then, when focused, a non-blinking caret — a 1px vertical line at
  `x = padding.left + measureText(text.slice(0, caret), { font }).width` spanning the text height.
  Measurement uses `useHost().renderer.measureText`.

## platform-web `WebTextInputService` (new `web-text-input.ts`)

- Lazily creates one hidden `<input type="text">`, appended to `document.body`, styled offscreen
  (`position:fixed; opacity:0; left:0; top:0; pointerEvents:none` — focusable but invisible).
- `start(client, initial)`: set `input.value = initial.text`; set `selectionStart/End`; `focus()`;
  attach listeners:
  - `input` → `client.onChange({ text: input.value, selectionStart, selectionEnd })`.
  - `keydown` `Enter` → `client.onSubmit?.()` + `preventDefault()`; `Escape` → `client.onCancel?.()`.
  Returns a `TextInputConnection`: `setValue(v)` writes `input.value`/selection; `close()` removes
  the listeners and `blur()`s the input. Guards against concurrent sessions (a new `start` closes
  the previous).
- `createWebHost` adds `textInput: new WebTextInputService()`.

## Testing

- **host:** `TextInputService`/`TextInputClient`/`TextInputConnection` implementable (stub); shapes usable.
- **runtime:** `useHost()` returns the host inside a `mount`ed tree; throws outside. Fake hosts updated with a stub `textInput`.
- **primitives:**
  - focusing an `<Input>` calls `textInput.start` with the current text and caret.
  - `client.onChange` updates the display and calls `onInput`; caret advances to `selectionEnd`.
  - controlled: an external `value` change pushes `connection.setValue` (guarded); normal typing does not loop.
  - `onSubmit` fires with the current text; blur calls `connection.close()`.
  - caret x equals the measured prefix width (fake renderer `measureText` = `len*7`).
  - empty field paints the placeholder (muted); focused field paints the caret.
  (Driven by a fake `TextInputService` provided through `hostContext`/a fake host.)
- **platform-web:** `WebTextInputService` with a fake `document`/`<input>`: `start` seeds value +
  focuses; a synthetic `input` event → `onChange`; `Enter` keydown → `onSubmit` (+preventDefault);
  `close` blurs + detaches; a second `start` closes the first.

## Exit criteria

- Typing into a focused `<Input>` updates the on-canvas text; caret tracks the insertion point.
- Controlled and uncontrolled both work; Enter submits; Escape cancels.
- `pnpm typecheck` + `pnpm vitest run` green across the workspace.
- A manual browser demo: an `<Input>` you can click, type into, and submit (Enter).

## Out of scope (later)

- Selection-highlight rendering, multiline `<textarea>`, blinking caret (Phase 13), horizontal
  scrolling for long text, IME candidate-window positioning, richer clipboard, overlay positioning
  of the proxy, password/number field types.
