import type { Instance } from '@cairn/runtime';
import { Provider } from '@cairn/runtime';
import { createSignal, onCleanup, type Accessor } from '@cairn/reactivity';
import { Box, Row, Column, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface RadioGroupContextValue {
  value: Accessor<any>;
  setValue: (v: any) => void;
  disabled: boolean;
  register: (v: any) => void;
  unregister: (v: any) => void;
  /** Returns the current ordered list of registered values (for roving). */
  getValues: () => any[];
}

export const radioGroupContext = createCompoundContext<RadioGroupContextValue>('RadioGroup');

// ─── RadioGroup ───────────────────────────────────────────────────────────────

export interface RadioGroupProps extends LayoutChildProps {
  value?: any | Accessor<any>;
  defaultValue?: any;
  onChange?: (v: any) => void;
  disabled?: boolean;
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

  const ctx: RadioGroupContextValue = {
    value: readValue,
    setValue,
    disabled: !!props.disabled,
    register(v: any) {
      if (!registered.includes(v)) registered.push(v);
    },
    unregister(v: any) {
      const idx = registered.indexOf(v);
      if (idx !== -1) registered.splice(idx, 1);
    },
    getValues() {
      return registered;
    },
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

  const isDisabled = g.disabled || !!props.disabled;
  const checked: Accessor<boolean> = () => g.value() === props.value;

  const select = (): void => {
    if (isDisabled) return;
    g.setValue(props.value);
  };

  const rove = (direction: 1 | -1): void => {
    if (isDisabled) return;
    const values = g.getValues();
    const idx = values.indexOf(g.value());
    if (idx === -1) return;
    const next = (idx + direction + values.length) % values.length;
    g.setValue(values[next]);
  };

  const { handlers } = createControl({
    disabled: isDisabled,
    onClick: select,
    // createControl already calls onClick on Space/Enter so we only handle arrows here
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') rove(1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') rove(-1);
    },
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

  applyLayoutChildProps(instance, props);
  return instance;
}
