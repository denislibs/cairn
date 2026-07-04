import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useOverlays, hostContext, Provider, Show } from '@cairn/runtime';
import { createSignal, createEffect, useContext, type Accessor } from '@cairn/reactivity';
import {
  Box,
  Stack,
  Column,
  Portal,
  computePlacement,
  getAbsRect,
  mergeStyles,
  type StyleInput,
  type Side,
  Input as PrimitiveInput,
} from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { createRoving } from './native/roving';
import { ARROW_DOWN, ARROW_UP, ENTER, ESCAPE } from './native/keys';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface ComboboxContextValue {
  inputText: Accessor<string>;
  value: Accessor<any>;
  setValue: (v: any) => void;
  close: () => void;
  register: (opt: { value: any; label: string }) => number;
  activeIndex: Accessor<number>;
  handleRovingKey: (key: string) => boolean;
  selectOption: (opt: { value: any; label: string }) => void;
}

export const comboboxContext = createCompoundContext<ComboboxContextValue>('Combobox');

function safeViewport(): { w: number; h: number } {
  try {
    const host = useContext(hostContext);
    if (host) return { w: host.metrics.width, h: host.metrics.height };
  } catch {
    // not mounted
  }
  return { w: 0, h: 0 };
}

// ─── ComboboxOption ───────────────────────────────────────────────────────────

export interface ComboboxOptionProps {
  value: any;
  label?: string;
  children?: Instance;
}

export function ComboboxOption(props: ComboboxOptionProps): Instance {
  const theme = useWidgetTheme();
  const ctx = comboboxContext.use();

  const optLabel = props.label ?? String(props.value);

  // Register this option — returns stable index
  const myIndex = ctx.register({ value: props.value, label: optLabel });

  const isSelected = (): boolean => ctx.value() === props.value;
  const isActive = (): boolean => ctx.activeIndex() === myIndex;

  const isVisible = (): boolean => {
    const t = ctx.inputText();
    return t === '' || optLabel.toLowerCase().includes(t.toLowerCase());
  };

  const select = (): void => {
    ctx.selectOption({ value: props.value, label: optLabel });
  };

  // ── Semantics ──
  const optionSemantics: SemanticsNode = {
    role: 'option',
    label: optLabel,
    selected: isSelected(),
    focusable: isActive(),
    autoFocus: isActive(),
    onActivate: select,
  };

  createEffect(() => {
    optionSemantics.selected = ctx.value() === props.value;
    optionSemantics.focusable = isActive();
    optionSemantics.autoFocus = isActive();
  });

  const rowStyle: StyleInput = () => ({
    paddingLeft: theme.control.padX.sm,
    paddingRight: theme.control.padX.sm,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: isSelected() ? theme.colors.surfaceAlt : 'transparent',
    cursor: 'pointer',
  });

  const buildRow = (): Instance => {
    const row = Box({
      style: mergeStyles(rowStyle),
      focusable: false,
      children: props.children,
      onClick: (e) => {
        e.stopPropagation?.();
        select();
      },
    });
    row.semantics = optionSemantics;
    return row;
  };

  const instance = Show({
    when: isVisible,
    children: buildRow,
  });

  // Attach semantics to the Show wrapper so tests can find it
  (instance as any).semantics = optionSemantics;

  return instance;
}

// ─── Combobox ─────────────────────────────────────────────────────────────────

export interface ComboboxProps {
  value?: any | Accessor<any>;
  defaultValue?: any;
  onChange?: (v: any) => void;
  onInputChange?: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  children: () => Instance;
  style?: StyleInput;
}

/** Combobox component type with compound Option sub-component. */
export interface ComboboxComponent {
  (props: ComboboxProps): Instance;
  Option: typeof ComboboxOption;
}

function _Combobox(props: ComboboxProps): Instance {
  const theme = useWidgetTheme();
  const overlays = useOverlays();

  // Controlled / uncontrolled value
  const isControlled = props.value !== undefined;
  const resolveValue = (): any =>
    typeof props.value === 'function' ? (props.value as Accessor<any>)() : props.value;

  const [internalValue, setInternalValue] = createSignal<any>(props.defaultValue ?? null);
  const value: Accessor<any> = () => (isControlled ? resolveValue() : internalValue());

  // Text input state (always uncontrolled — driven by user typing)
  const [inputText, setInputText] = createSignal<string>('');

  // Open state (always uncontrolled — internal)
  const [open, setOpen] = createSignal(false);

  const close = (): void => { setOpen(false); };

  const setValue = (v: any): void => {
    if (!isControlled) setInternalValue(v);
    props.onChange?.(v);
  };

  // Option registry
  const optionRegistry: Array<{ value: any; label: string }> = [];

  // Roving for option navigation
  const [optionCount, setOptionCount] = createSignal(0);
  const roving = createRoving({ count: optionCount, orientation: 'vertical', loop: false });

  const selectOption = (opt: { value: any; label: string }): void => {
    setInputText(opt.label);
    setValue(opt.value);
    close();
  };

  const ctx: ComboboxContextValue = {
    inputText,
    value,
    setValue,
    close,
    register(opt) {
      if (!optionRegistry.find((o) => o.value === opt.value)) {
        optionRegistry.push(opt);
        setOptionCount(optionRegistry.length);
        const idx = optionRegistry.length - 1;
        if (value() === opt.value) roving.setActive(idx);
      }
      return optionRegistry.findIndex((o) => o.value === opt.value);
    },
    activeIndex: roving.active,
    handleRovingKey: roving.handleKey,
    selectOption,
  };

  // ── Shared input handler (avoids double-firing onInputChange) ──
  const handleInput = (text: string): void => {
    setInputText(text);
    props.onInputChange?.(text);
    if (!open()) setOpen(true);
  };

  // ── Trigger / input frame style ──
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
    cursor: props.disabled ? 'default' : 'text',
  });

  const inputFieldStyle: StyleInput = () => ({
    backgroundColor: 'transparent',
    color: theme.colors.text,
    font: `${theme.fontSizes.sm}px sans-serif`,
    width: '100%' as any,
    height: theme.control.height.md,
  });

  // ── Primitive input ──
  const primitiveInput = PrimitiveInput({
    value: inputText,
    onInput: handleInput,
    placeholder: props.placeholder,
    style: inputFieldStyle,
  });

  // ── Wrapper (declared before portalContent so portalContent can close over it) ──
  const wrapper = Box({
    style: mergeStyles(triggerFrameStyle, props.style),
    focusable: !props.disabled,
    children: primitiveInput,
  });

  // ── Semantics on wrapper ──
  const inputSemantics: SemanticsNode = {
    role: 'combobox',
    label: props.placeholder ?? '',
    expanded: false,
    disabled: props.disabled,
    focusable: !props.disabled,
    value: '',
    onInput: handleInput,
    onKeyDown: (key: string, _mods: any) => {
      if (key === ARROW_DOWN) {
        if (!open()) setOpen(true);
        roving.handleKey(key);
        return true;
      }
      if (key === ARROW_UP) {
        roving.handleKey(key);
        return true;
      }
      if (key === ENTER) {
        const idx = roving.active();
        if (open() && idx >= 0 && idx < optionRegistry.length) {
          selectOption(optionRegistry[idx]);
          return true;
        }
        return false;
      }
      if (key === ESCAPE) {
        if (open()) {
          close();
          return true;
        }
        return false;
      }
      return false;
    },
  };

  wrapper.semantics = inputSemantics;

  // Keep expanded/value reactive
  createEffect(() => {
    inputSemantics.expanded = open();
    inputSemantics.value = inputText();
  });

  // ── Listbox portal ──
  const portalContent = (): Instance => {
    const appRoot = overlays.appRoot();
    const anchor = appRoot
      ? (getAbsRect(wrapper, appRoot) ?? { x: 0, y: 0, width: 0, height: 0 })
      : { x: 0, y: 0, width: 0, height: 0 };
    const vp = safeViewport();
    const estimatedSize = { width: 200, height: 160 };
    const { x, y } = computePlacement(
      anchor,
      estimatedSize,
      vp,
      { side: 'bottom' as Side, align: 'start', offset: 4, flip: true },
    );

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
      context: comboboxContext.context,
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

  return wrapper;
}

/** Combobox — autocomplete input with a filtered listbox. */
export const Combobox: ComboboxComponent = Object.assign(_Combobox, {
  Option: ComboboxOption,
});
