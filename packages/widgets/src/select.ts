import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useOverlays, hostContext, Provider } from '@cairn/runtime';
import { createSignal, createEffect, useContext, type Accessor } from '@cairn/reactivity';
import { Box, Stack, Column, Row, Text, Icon, Portal, computePlacement, getAbsRect, mergeStyles, type StyleInput, type Side } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { createRoving } from './native/roving';
import { createTypeahead } from './native/typeahead';
import { ARROW_DOWN, ARROW_UP, ENTER, SPACE, ESCAPE, HOME, END } from './native/keys';

// Chevron-down path (24x24 viewBox)
const CHEVRON_DOWN = 'M6 9l6 6 6-6';

// Check mark path (24x24 viewBox)
const CHECK = 'M5 13l4 4L19 7';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SelectContextValue {
  value: Accessor<any>;
  setValue: (v: any) => void;
  close: () => void;
  register: (opt: { value: any; label: string }) => number;
  selectedLabel: Accessor<string>;
  /** Active (focused) roving index in the open listbox. */
  activeIndex: Accessor<number>;
  /** Handle roving arrow key — returns true if consumed. */
  handleRovingKey: (key: string) => boolean;
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

  // Roving for option navigation
  const [optionCount, setOptionCount] = createSignal(0);
  const roving = createRoving({ count: optionCount, orientation: 'vertical', loop: false });

  // Typeahead for option jump
  const typeahead = createTypeahead({
    getLabels: () => optionRegistry.map((o) => o.label),
    onMatch: (idx) => { roving.setActive(idx); },
  });

  const ctx: SelectContextValue = {
    value,
    setValue,
    close,
    register(opt) {
      if (!optionRegistry.find((o) => o.value === opt.value)) {
        optionRegistry.push(opt);
        setOptionCount(optionRegistry.length);
        // Sync active to selected option index on registration
        const idx = optionRegistry.length - 1;
        if (value() === opt.value) roving.setActive(idx);
      }
      return optionRegistry.findIndex((o) => o.value === opt.value);
    },
    selectedLabel,
    activeIndex: roving.active,
    handleRovingKey: roving.handleKey,
  };

  // ── Trigger ──
  const triggerFrameStyle: StyleInput = () => ({
    backgroundColor: theme.colors.surface,
    border: { width: 1, color: theme.colors.borderStrong },
    borderRadius: theme.radii.md,
    paddingLeft: theme.control.padX.md,
    paddingRight: theme.control.padX.md,
    height: theme.control.height.md,
    minWidth: 140,
    alignY: 'center' as const,
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

  // ── Semantics on the trigger ──
  const triggerSemantics: SemanticsNode = {
    role: 'combobox',
    label: props.placeholder ?? '',
    expanded: false,
    disabled: props.disabled,
    focusable: !props.disabled,
    onActivate: toggle,
    onKeyDown: (key, _mods) => {
      if (!open()) {
        if (key === ENTER || key === SPACE || key === ARROW_DOWN) {
          setOpen(true);
          return true;
        }
        return false;
      }
      // When open: arrows move active, Enter selects active, Escape closes, printable → typeahead
      if (key === ESCAPE) { close(); return true; }
      if (roving.handleKey(key)) return true;
      if (key === ENTER) {
        const idx = roving.active();
        if (idx >= 0 && idx < optionRegistry.length) {
          setValue(optionRegistry[idx].value);
          close();
        }
        return true;
      }
      if (key.length === 1) return typeahead.handleChar(key);
      return false;
    },
  };

  trigger.semantics = triggerSemantics;

  // Keep expanded/label reactive
  createEffect(() => {
    triggerSemantics.expanded = open();
    const lbl = selectedLabel();
    triggerSemantics.label = lbl !== '' ? lbl : (props.placeholder ?? '');
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

  trigger.debugName = 'Select';
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

  // Register this option so Select can look up labels — returns stable index
  const myIndex = ctx.register({ value: props.value, label: props.label ?? String(props.value) });

  const isDisabled = !!props.disabled;
  const isSelected = (): boolean => ctx.value() === props.value;
  const isActive = (): boolean => ctx.activeIndex() === myIndex;

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

  // ── Semantics ──
  const optionSemantics: SemanticsNode = {
    role: 'option',
    label: props.label ?? String(props.value),
    selected: isSelected(),
    disabled: isDisabled,
    focusable: isActive(),
    autoFocus: isActive(),
    onActivate: select,
  };

  instance.semantics = optionSemantics;

  // Keep selected/focusable/autoFocus reactive
  createEffect(() => {
    optionSemantics.selected = isSelected();
    optionSemantics.focusable = isActive();
    optionSemantics.autoFocus = isActive();
  });

  instance.debugName = 'SelectOption';
  return instance;
}
