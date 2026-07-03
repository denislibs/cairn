import type { Instance } from '@cairn/runtime';
import { useOverlays, hostContext, Provider } from '@cairn/runtime';
import { createSignal, createEffect, useContext, type Accessor } from '@cairn/reactivity';
import { Box, Stack, Column, Row, Text, Icon, Portal, computePlacement, getAbsRect, mergeStyles, type StyleInput, type Side } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';

// Chevron-down path (24x24 viewBox)
const CHEVRON_DOWN = 'M6 9l6 6 6-6';

// Check mark path (24x24 viewBox)
const CHECK = 'M5 13l4 4L19 7';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SelectContextValue {
  value: Accessor<any>;
  setValue: (v: any) => void;
  close: () => void;
  register: (opt: { value: any; label: string }) => void;
  selectedLabel: Accessor<string>;
}

export const selectContext = createCompoundContext<SelectContextValue>('Select');

function safeViewport(): { w: number; h: number } {
  try {
    const host = useContext(hostContext);
    if (host) return { w: host.metrics.width, h: host.metrics.height };
  } catch {
    // not mounted
  }
  return { w: 0, h: 0 };
}

// ─── Select ───────────────────────────────────────────────────────────────────

export interface SelectProps {
  value?: any | Accessor<any>;
  defaultValue?: any;
  onChange?: (v: any) => void;
  placeholder?: string;
  disabled?: boolean;
  children: () => Instance;
  style?: StyleInput;
  side?: Side;
  align?: 'start' | 'center' | 'end';
  offset?: number;
}

export function Select(props: SelectProps): Instance {
  const theme = useWidgetTheme();
  const overlays = useOverlays();
  const side = props.side ?? 'bottom';
  const align = props.align ?? 'start';
  const offset = props.offset ?? 4;

  // Controlled / uncontrolled value
  const isControlled = props.value !== undefined;
  const resolveValue = (): any =>
    typeof props.value === 'function' ? (props.value as Accessor<any>)() : props.value;

  const [internalValue, setInternalValue] = createSignal<any>(props.defaultValue ?? null);
  const value: Accessor<any> = () => (isControlled ? resolveValue() : internalValue());

  // Registry of options so we can look up labels
  const optionRegistry: Array<{ value: any; label: string }> = [];

  const selectedLabel: Accessor<string> = () => {
    const v = value();
    if (v === null || v === undefined) return '';
    const found = optionRegistry.find((o) => o.value === v);
    return found ? found.label : String(v);
  };

  // Open state (always uncontrolled — internal)
  const [open, setOpen] = createSignal(false);

  const toggle = (): void => {
    if (props.disabled) return;
    setOpen((o) => !o);
  };

  const close = (): void => { setOpen(false); };

  const setValue = (v: any): void => {
    if (!isControlled) setInternalValue(v);
    props.onChange?.(v);
  };

  const ctx: SelectContextValue = {
    value,
    setValue,
    close,
    register(opt) {
      if (!optionRegistry.find((o) => o.value === opt.value)) {
        optionRegistry.push(opt);
      }
    },
    selectedLabel,
  };

  // ── Trigger ──
  const triggerFrameStyle: StyleInput = () => ({
    backgroundColor: theme.colors.surface,
    border: { width: 1, color: theme.colors.borderStrong },
    borderRadius: theme.radii.md,
    paddingLeft: theme.control.padX.md,
    paddingRight: theme.control.padX.md,
    height: theme.control.height.md,
    opacity: props.disabled ? 0.5 : 1,
    cursor: props.disabled ? 'default' : 'pointer',
  });

  // The label/placeholder text in the trigger
  const labelText = (): string => {
    const lbl = selectedLabel();
    return lbl !== '' ? lbl : (props.placeholder ?? '');
  };

  const isPlaceholder = (): boolean => selectedLabel() === '';

  const triggerLabel = Text({
    style: () => ({
      color: isPlaceholder() ? theme.colors.textMuted : theme.colors.text,
      fontSize: theme.fontSizes.sm,
      flex: 1,
    }),
    children: labelText,
  });

  const chevron = Icon({
    path: CHEVRON_DOWN,
    size: 16,
    color: theme.colors.textMuted,
  });

  const triggerRow = Row({
    mainAxisSize: 'min',
    style: {
      alignY: 'center' as const,
      gap: theme.spacing.xs,
      width: '100%' as any,
    },
    children: [triggerLabel, chevron],
  });

  const trigger = Box({
    style: mergeStyles(triggerFrameStyle, props.style),
    focusable: !props.disabled,
    children: triggerRow,
    onClick: () => toggle(),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault?.();
        if (!open()) setOpen(true);
      }
    },
  });

  // ── Listbox portal ──
  const [active, setActive] = createSignal(-1);

  const portalContent = (): Instance => {
    const appRoot = overlays.appRoot();
    const anchor = appRoot
      ? (getAbsRect(trigger, appRoot) ?? { x: 0, y: 0, width: 0, height: 0 })
      : { x: 0, y: 0, width: 0, height: 0 };
    const vp = safeViewport();
    const estimatedSize = { width: 160, height: 120 };
    const { x, y } = computePlacement(anchor, estimatedSize, vp, { side, align, offset, flip: true });

    const catcher = Box({
      style: { width: '100%', height: '100%' },
      focusable: true,
      onClick: (e) => {
        e.stopPropagation?.();
        close();
      },
      onKeyDown: (e) => {
        if (e.key === 'Escape') close();
      },
    });

    const surfaceStyle: StyleInput = () => ({
      backgroundColor: theme.colors.surface,
      border: { width: 1, color: theme.colors.borderStrong },
      borderRadius: theme.radii.md,
      boxShadow: { color: 'rgba(0,0,0,0.12)', blur: 12, offsetX: 0, offsetY: 4 },
      padding: theme.spacing.xs,
    });

    // Build Options inside context
    const optionsContent = Provider({
      context: selectContext.context,
      value: ctx,
      children: props.children,
    });

    const optionsList = Column({
      mainAxisSize: 'min',
      children: [optionsContent],
    });

    const contentBox = Box({
      left: x,
      top: y,
      style: surfaceStyle,
      children: optionsList,
      onClick: (e) => { e.stopPropagation?.(); },
    });

    return Portal({
      children: Stack({
        children: [catcher, contentBox],
      }),
    });
  };

  createEffect(() => {
    if (open()) portalContent();
  });

  return trigger;
}

// ─── Option ───────────────────────────────────────────────────────────────────

export interface OptionProps {
  value: any;
  disabled?: boolean;
  label?: string;
  children?: Instance;
}

export function Option(props: OptionProps): Instance {
  const theme = useWidgetTheme();
  const ctx = selectContext.use();

  // Register this option so Select can look up labels
  ctx.register({ value: props.value, label: props.label ?? String(props.value) });

  const isDisabled = !!props.disabled;
  const isSelected = (): boolean => ctx.value() === props.value;

  const select = (): void => {
    if (isDisabled) return;
    ctx.setValue(props.value);
    ctx.close();
  };

  const handleKeyDown = (e: any): void => {
    if (isDisabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault?.();
      select();
    }
  };

  const rowStyle: StyleInput = () => ({
    paddingLeft: theme.control.padX.sm,
    paddingRight: theme.control.padX.sm,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: isSelected() ? theme.colors.surfaceAlt : 'transparent',
    cursor: isDisabled ? 'default' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
  });

  const labelContent = props.children ?? Text({
    style: () => ({
      color: isDisabled ? theme.colors.textDisabled : theme.colors.text,
      fontSize: theme.fontSizes.sm,
      flex: 1,
    }),
    children: props.label ?? String(props.value),
  });

  const checkIcon = isSelected()
    ? Icon({ path: CHECK, size: 14, color: theme.colors.primary })
    : Box({ style: { width: 14, height: 14 } });

  const instance = Row({
    mainAxisSize: 'min',
    focusable: !isDisabled,
    style: mergeStyles(rowStyle),
    onClick: (e) => {
      e.stopPropagation?.();
      select();
    },
    onKeyDown: handleKeyDown,
    children: [labelContent, checkIcon],
  });

  return instance;
}
