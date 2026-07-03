import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Provider } from '@cairn/runtime';
import { createSignal, createEffect, onCleanup, type Accessor } from '@cairn/reactivity';
import { Box, Row, Column, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { createControl } from './control';
import { createRoving } from './native/roving';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface RadioGroupContextValue {
  value: Accessor<any>;
  setValue: (v: any) => void;
  disabled: boolean;
  register: (v: any) => void;
  unregister: (v: any) => void;
  /** Returns the current ordered list of registered values (for roving). */
  getValues: () => any[];
  /** Active (focused) index for roving — driven by createRoving. */
  activeIndex: Accessor<number>;
  /**
   * Handle an arrow/Home/End key for roving + selection.
   * Returns true if the key was consumed.
   */
  handleArrow: (key: string) => boolean;
}

export const radioGroupContext = createCompoundContext<RadioGroupContextValue>('RadioGroup');

// ─── RadioGroup ───────────────────────────────────────────────────────────────

export interface RadioGroupProps extends LayoutChildProps {
  value?: any | Accessor<any>;
  defaultValue?: any;
  onChange?: (v: any) => void;
  disabled?: boolean;
  label?: string;
  style?: StyleInput;
  children?: () => Instance;
}

export interface RadioGroupInstance extends Instance {
  /** Exposed for testing — the context value so tests can runWithContext. */
  _ctx: RadioGroupContextValue;
}

export function RadioGroup(props: RadioGroupProps): RadioGroupInstance {
  const t = useWidgetTheme();

  // Ordered list of registered radio values (for roving keyboard navigation)
  const registered: any[] = [];

  // --- Controlled / uncontrolled ---
  const controlled = props.value !== undefined;
  const [internal, setInternal] = createSignal(props.defaultValue ?? null);

  const readValue: Accessor<any> = (): any => {
    if (controlled) {
      const v = props.value;
      return typeof v === 'function' ? (v as Accessor<any>)() : v;
    }
    return internal();
  };

  const setValue = (v: any): void => {
    if (!controlled) setInternal(v);
    props.onChange?.(v);
  };

  // Roving: active index tracks which radio has focus
  const [registeredCount, setRegisteredCount] = createSignal(0);
  const roving = createRoving({
    count: registeredCount,
    orientation: 'both',
    loop: true,
    initial: 0,
  });

  const handleArrow = (key: string): boolean => {
    const handled = roving.handleKey(key);
    if (handled) {
      // Arrow moves active AND selects (radio semantics)
      const values = registered;
      const idx = roving.active();
      if (idx >= 0 && idx < values.length) {
        setValue(values[idx]);
      }
    }
    return handled;
  };

  const ctx: RadioGroupContextValue = {
    value: readValue,
    setValue,
    disabled: !!props.disabled,
    register(v: any) {
      if (!registered.includes(v)) {
        registered.push(v);
        setRegisteredCount(registered.length);
        // If this newly registered value is already selected, sync active index
        const idx = registered.indexOf(v);
        if (readValue() === v) {
          roving.setActive(idx);
        }
      }
    },
    unregister(v: any) {
      const idx = registered.indexOf(v);
      if (idx !== -1) {
        registered.splice(idx, 1);
        setRegisteredCount(registered.length);
      }
    },
    getValues() {
      return registered;
    },
    activeIndex: roving.active,
    handleArrow,
  };

  // --- Semantics for the group container ---
  const groupSemantics: SemanticsNode = {
    role: 'radiogroup',
    label: props.label,
    disabled: !!props.disabled,
  };

  let content: Instance;
  if (props.children) {
    content = Provider({
      context: radioGroupContext.context,
      value: ctx,
      children: () => props.children!(),
    });
  } else {
    content = Column({
      mainAxisSize: 'min',
      style: mergeStyles({ gap: t.spacing.sm }, props.style),
    });
  }

  const instance: RadioGroupInstance = {
    layout: content.layout,
    children: content.children,
    paintSelf: content.paintSelf,
    focusable: content.focusable,
    handlers: content.handlers,
    _ctx: ctx,
  };

  instance.semantics = groupSemantics;
  applyLayoutChildProps(instance, props);
  return instance;
}

// ─── Radio ────────────────────────────────────────────────────────────────────

// Outer ring dimensions
const RING_SIZE = 18;
const RING_RADIUS = 9;
const DOT_SIZE = 8;
const DOT_RADIUS = 4;

export interface RadioProps extends LayoutChildProps {
  value: any;
  disabled?: boolean;
  label?: string;
  style?: StyleInput;
  children?: Instance;
}

export function Radio(props: RadioProps): Instance {
  const t = useWidgetTheme();
  const g = radioGroupContext.use();

  // Register this radio's value for roving keyboard navigation
  g.register(props.value);
  onCleanup(() => g.unregister(props.value));

  // My index in the registered list (stable after registration)
  const myIndex = (): number => g.getValues().indexOf(props.value);

  const isDisabled = g.disabled || !!props.disabled;
  const checked: Accessor<boolean> = () => g.value() === props.value;
  const isActive: Accessor<boolean> = () => g.activeIndex() === myIndex();

  // autoFocus: transient — set to true when roving moves to me via keyboard
  const [autoFocusMe, setAutoFocusMe] = createSignal(false);

  const select = (): void => {
    if (isDisabled) return;
    g.setValue(props.value);
    // When directly activated, sync active index
    const idx = myIndex();
    if (idx !== -1) g.handleArrow; // handled via setValue + roving sync in group
  };

  const { handlers, setFocusVisible } = createControl({
    disabled: isDisabled,
    onClick: select,
    // createControl already calls onClick on Space/Enter so we only handle arrows here
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') rove(1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') rove(-1);
    },
  });

  const rove = (direction: 1 | -1): void => {
    if (isDisabled) return;
    const values = g.getValues();
    const idx = values.indexOf(g.value());
    if (idx === -1) return;
    const next = (idx + direction + values.length) % values.length;
    g.setValue(values[next]);
  };

  // --- Semantics ---
  const semantics: SemanticsNode = {
    role: 'radio',
    label: props.label,
    checked: checked(),
    disabled: isDisabled,
    focusable: isActive(),
    autoFocus: false,
    onActivate: () => {
      if (!isDisabled) {
        g.setValue(props.value);
      }
    },
    onFocus: (keyboard: boolean) => setFocusVisible(keyboard),
    onBlur: () => setFocusVisible(false),
    onKeyDown: (key: string, _mods) => g.handleArrow(key),
  };

  // Sync checked and focusable reactively
  createEffect(() => {
    semantics.checked = checked();
    semantics.focusable = isActive();
  });

  // Sync autoFocus: set transiently when roving.active changes to this radio
  createEffect(() => {
    if (isActive()) {
      // autoFocus is edge-triggered by the bridge — set true briefly
      semantics.autoFocus = autoFocusMe();
    } else {
      semantics.autoFocus = false;
    }
  });

  // Inner dot — shown when checked
  const dotBox = Box({
    style: () => ({
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_RADIUS,
      backgroundColor: checked() ? t.colors.primary : 'transparent',
    }),
  });

  // Outer ring style (function-form so checked() drives it reactively)
  const ringStyle: StyleInput = () => ({
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_RADIUS,
    border: {
      width: 2,
      color: checked() ? t.colors.primary : t.colors.borderStrong,
    },
    backgroundColor: 'transparent',
    alignX: 'center' as const,
    alignY: 'center' as const,
    cursor: isDisabled ? 'default' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    focus: {
      boxShadow: { blur: 4, spread: 2, color: t.colors.focusRing, offsetX: 0, offsetY: 0 },
    },
  });

  let instance: Instance;
  if (props.label) {
    instance = Row({
      mainAxisSize: 'min',
      style: mergeStyles({ gap: t.spacing.sm }, props.style),
      focusable: true,
      ...handlers,
      children: [
        Box({ style: ringStyle, children: dotBox }),
        Text({
          style: () => ({
            color: isDisabled ? t.colors.textDisabled : t.colors.text,
            fontSize: t.fontSizes.sm,
          }),
          children: props.label,
        }),
      ],
    });
  } else {
    instance = Box({
      style: mergeStyles(ringStyle, props.style),
      focusable: true,
      ...handlers,
      children: dotBox,
    });
  }

  instance.semantics = semantics;
  applyLayoutChildProps(instance, props);
  return instance;
}
