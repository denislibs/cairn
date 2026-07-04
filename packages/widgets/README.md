# @cairn/widgets — Headless component library

The **headless standard library** for [Cairn](../../README.md). Ships with the framework: install Cairn and you get `Button`, `Input`, `Select`, `Form`, … ready to drop in — no need to assemble controls out of raw `Box`es.

- **Headless** — components own *behaviour* (focus, keyboard, disabled, open/checked/value state, a11y semantics) and expose their look for you to style. They render with sensible **default styles** out of the box, and **everything is overridable**.
- **Platform-agnostic** — zero DOM. No `window`/`document`. All input flows through the host seam, so the same components run on web canvas, mobile, or any other host. A widget never imports from `@cairn/platform-web`.
- **Compound & extensible** — structured components expose their parts (`Select.Root/Trigger/Content/Item`) so you can rearrange and restyle freely.

`@cairn/material` is one styled reference kit built entirely on top of these widgets — proof the API is flexible enough to reproduce a full design language.

## The 3-layer customization model

Every component supports three levels of styling, cheapest → most powerful:

### 1. Theme tokens (global)
Widgets read a neutral `defaultTheme`. Wrap a subtree in `ThemeProvider` to override tokens; missing tokens fall back to defaults.

```tsx
import { ThemeProvider } from '@cairn/primitives';
import { defaultTheme } from '@cairn/widgets';

ThemeProvider({
  theme: { colors: { primary: '#7c3aed', primaryHover: '#6d28d9' } }, // partial — rest defaults
  children: () => App(),
});
```

`useWidgetTheme()` reads the current theme and deep-merges it over `defaultTheme`, so a partial theme only changes what it sets.

### 2. `style` override per part (local)
Every part accepts `style` (a `Style`, `Style[]`, or `(theme) => Style`), merged **over** the default. State variants live in `hover`/`pressed`/`focus`/`disabled` sub-objects and restyle reactively.

```tsx
Button({ label: 'Danger', style: { backgroundColor: '#e11d48', hover: { backgroundColor: '#be123c' } } });
```

### 3. Slot / full render (max control)
Pass a **render function** as `children` to own the entire look while keeping our behaviour. The function receives the live interaction state.

```tsx
Button({
  onClick: save,
  children: (s) => Box({
    style: () => ({ borderRadius: 999, padding: { left: 20, right: 20, top: 10, bottom: 10 },
      backgroundColor: s.hovered() ? '#db2777' : '#ec4899' }),
    children: Text({ style: { color: '#fff' }, children: 'Custom' }),
  }),
});
```

## Compound convention

Compound **where structure matters**, flat where it doesn't.

- **Compound** (parts share a context via `createCompoundContext`): `Select`, `Tabs`, `Dialog`, `Menu`, `RadioGroup`, `Accordion`, `Form`/`Field`.
- **Flat** (one call + render-fn escape hatch): `Button`, `Input`, `Checkbox`, `Switch`, `Badge`, `Avatar`, `Chip`, `Progress`.

Interaction state exposed to slots and `style` functions is uniform:
`ControlState = { hovered(), pressed(), focused(), disabled }`, plus component extras (`checked`, `open`, `value`, `invalid`, …).

## Authoring helpers

| Export | Purpose |
| --- | --- |
| `defaultTheme` / `useWidgetTheme()` | Neutral token set + theme reader (deep-merges over defaults) |
| `mergeStyles(...inputs)` | Flatten/merge `StyleInput`s (incl. `(theme) => Style` form) — how defaults + overrides combine |
| `createCompoundContext<T>(name)` | Context + `use()` (throws outside `Root`) for compound parts |
| `createControl(props)` | Interaction state (`hovered/pressed/focused/disabled`) + handlers, disabled-aware, Enter/Space → click |

## Component catalog

Status: ✅ stable · 🧪 in progress · ⏳ planned

### Actions
| Component | Kind | Status |
| --- | --- | --- |
| `Button` | flat | ✅ |
| `Toggle` | flat | ✅ |
| `IconButton` | flat | ⏳ |
| `ToggleButton` | flat | ⏳ |
| `ButtonGroup` | compound | ⏳ |
| `Menu` | compound | ⏳ |

### Forms
| Component | Kind | Status |
| --- | --- | --- |
| `Input` | flat | ✅ |
| `TextArea` | flat | ⏳ H1b (needs multiline host seam) |
| `Checkbox` | flat | ✅ |
| `Radio` / `RadioGroup` | compound | ✅ |
| `Switch` | flat | ✅ |
| `Field` | compound | ✅ |
| `Select` / `Option` | compound | ✅ (see Overlays) |
| `Combobox` | compound | ✅ |
| `Slider` | flat | ✅ |
| `Form` | compound | ✅ |

### Overlays
| Component | Kind | Status |
| --- | --- | --- |
| `Popover` | flat | ✅ |
| `Tooltip` | flat | ✅ |
| `Menu` / `MenuItem` | compound | ✅ |
| `Select` / `Option` | compound | ✅ |
| `Dialog` | compound | ✅ |
| `Drawer` | compound | ✅ |
| `Toast` | compound | ✅ |

### Navigation
| Component | Kind | Status |
| --- | --- | --- |
| `Tabs` | compound | ⏳ |
| `Accordion` | compound | ⏳ |
| `Stepper` | compound | ⏳ |
| `Breadcrumbs` | flat | ⏳ |
| `Pagination` | flat | ⏳ |

### Data display
| Component | Kind | Status |
| --- | --- | --- |
| `Card` | flat | ⏳ |
| `List` / `ListItem` | compound | ⏳ |
| `Table` | compound | ⏳ |
| `Avatar` | flat | ⏳ |
| `Badge` | flat | ⏳ |
| `Chip` | flat | ⏳ |
| `Divider` | flat | ✅ |
| `Progress` | flat | ⏳ |
| `Skeleton` | flat | ⏳ |

## `Button`

```tsx
Button({
  variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'link', // default 'solid'
  size?: 'sm' | 'md' | 'lg',                                   // default 'md'
  color?: string,        // a WidgetTheme.colors base key ('primary','danger',…), default 'primary'
  disabled?, fullWidth?, onClick?,
  style?,                // layer-2 override
  label?: string,
  children?: Instance | ((state: ControlState) => Instance),   // layer-3 slot
});
```

Keyboard (Enter/Space), focus, and disabled handling are built in.

## `Toggle`

A two-state (pressed/unpressed) button — the base for `ToggleButton`/`Switch`.

```tsx
Toggle({
  pressed?: boolean | Accessor<boolean>,  // controlled
  defaultPressed?: boolean,               // uncontrolled
  onChange?: (v: boolean) => void,
  disabled?, style?, label?,
  children?: Instance | ((s: ControlState & { togglePressed: Accessor<boolean> }) => Instance),
});
```

## Form core

```tsx
// Checkbox — controlled/uncontrolled, indeterminate, render-fn slot
Checkbox({ label: 'Accept terms', defaultChecked: true, onChange: (v) => {} });

// Switch — animated track + thumb, built on Toggle
Switch({ label: 'Notifications', checked: on, onChange: setOn });

// Radio + RadioGroup (compound) — arrow-key roving, one selection
RadioGroup({ defaultValue: 'pro', onChange: (v) => {}, children: () =>
  Column({ mainAxisSize: 'min', children: [
    Radio({ value: 'free', label: 'Free' }),
    Radio({ value: 'pro',  label: 'Pro' }),
  ] }),
});

// Field (compound) — label / control / helper / error; Error shows while invalid()
Field({ invalid, children: () =>
  Column({ mainAxisSize: 'min', children: [
    Field.Label({ children: 'Email' }),
    Field.Control({ children: Input({ placeholder: 'you@example.com' }) }),
    Field.Error({ children: 'Email is required' }),   // reads Field.invalid
  ] }),
});

// Input — themed text field over the platform text seam; focus-ring, invalid, sizes
Input({ placeholder: 'Jane Doe', value, onInput: setValue, size: 'md' });
```

> `TextArea` is planned for H1b — a correct multiline field needs a multiline host text-input seam (today the platform proxy is single-line).

## Overlays & selection

All position via the canvas overlay layer (`Portal` + `computePlacement`), close on outside-click / Escape, and are platform-agnostic.

```tsx
// Popover — click trigger to toggle a themed panel
Popover({ trigger: Button({ label: 'Open' }), children: panelInstance, side: 'bottom' });

// Tooltip — hover bubble
Tooltip({ trigger: Button({ label: 'Hover' }), label: 'Helpful hint' });

// Menu (compound) — roving keyboard, close-on-select
Menu({ trigger: Button({ label: 'Actions' }), children: () =>
  Column({ mainAxisSize: 'min', children: [
    MenuItem({ label: 'Cut',  onSelect: cut }),
    MenuItem({ label: 'Copy', onSelect: copy }),
    MenuItem({ label: 'Paste', disabled: true }),
  ] }),
});

// Select (compound) — listbox, controlled/uncontrolled, keyboard
Select({ placeholder: 'Choose…', value, onChange: setValue, children: () =>
  Column({ mainAxisSize: 'min', children: [
    Option({ value: 'a', label: 'Apple' }),
    Option({ value: 'b', label: 'Banana' }),
  ] }),
});
```
