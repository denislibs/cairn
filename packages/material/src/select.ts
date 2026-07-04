import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Row, Column, Text, mergeStyles, type StyleInput } from '@cairn/primitives';
import { createEffect } from '@cairn/reactivity';
import {
  Select as HeadlessSelect,
  Option as HeadlessOption,
  selectContext,
  type SelectProps as HeadlessSelectProps,
} from '@cairn/widgets';
import { stateOverlay } from './state-layer';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectOptionItem {
  value: any;
  label: string;
}

export interface SelectProps {
  value?: any;
  defaultValue?: any;
  onChange?: (v: any) => void;
  label?: string;
  /** Provide either a static options array or a children factory that renders Option components. */
  options?: SelectOptionItem[];
  children?: () => Instance;
  color?: MaterialColor;
  disabled?: boolean;
  fullWidth?: boolean;
}

export interface OptionProps {
  value: any;
  label?: string;
  disabled?: boolean;
  children?: Instance;
}

// ─── Select ───────────────────────────────────────────────────────────────────

export function Select(props: SelectProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const color = props.color ?? 'primary';
  const c = t.palette[color];
  const disabled = !!props.disabled;

  // Material outlined trigger style — resembles a TextField with dropdown caret
  const triggerStyle: StyleInput = {
    backgroundColor: t.palette.background.paper,
    border: { width: 1, color: t.palette.divider },
    borderRadius: t.shape.borderRadius,
    height: 40,
    minWidth: 140,
    padding: { left: 14, right: 10, top: 0, bottom: 0 },
    alignY: 'center' as const,
    opacity: disabled ? 0.38 : 1,
    cursor: disabled ? 'default' : 'pointer',
    ...(props.fullWidth ? { width: '100%' as any } : {}),
  };

  // Children factory: if options array supplied, build Material.Option rows inside;
  // otherwise pass through the user-supplied children factory.
  // Note: Material.Option must be rendered inside the headless Select's context Provider,
  // which the headless Select wraps around children automatically.
  const childrenFactory: () => Instance = props.options
    ? () => {
        const optInstances = props.options!.map((o) =>
          Option({ value: o.value, label: o.label }),
        );
        return Column({ mainAxisSize: 'min', children: optInstances });
      }
    : (props.children ?? (() => Box({ style: { width: 0, height: 0 } })));

  const headlessProps: HeadlessSelectProps = {
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    disabled,
    placeholder: props.label ?? '',
    style: triggerStyle,
    children: childrenFactory,
  };

  return HeadlessSelect(headlessProps);
}

// ─── Option ───────────────────────────────────────────────────────────────────

export function Option(props: OptionProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const ctx = selectContext.use();

  const isDisabled = !!props.disabled;

  // Register this option and capture the stable index (called once)
  const myIndex = ctx.register({ value: props.value, label: props.label ?? String(props.value) });

  const isSelected = (): boolean => ctx.value() === props.value;
  const isActive = (): boolean => ctx.activeIndex() === myIndex;

  const select = (): void => {
    if (isDisabled) return;
    ctx.setValue(props.value);
    ctx.close();
  };

  // Material row style: state-layer on hover/selected
  const rowStyle: StyleInput = () => ({
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: t.shape.borderRadius,
    backgroundColor: isSelected() ? t.palette.action.selected : 'transparent',
    cursor: isDisabled ? 'default' : 'pointer',
    opacity: isDisabled ? 0.38 : 1,
    hover: isDisabled ? undefined : {
      backgroundColor: stateOverlay(t.palette.text.primary, 'hover'),
    },
  });

  const labelText: Instance = props.children ?? Text({
    style: () => ({
      color: isDisabled ? t.palette.text.disabled : t.palette.text.primary,
      fontSize: t.typography.body2.fontSize,
      fontWeight: t.typography.body2.fontWeight,
      flex: 1,
    }),
    children: props.label ?? String(props.value),
  });

  const instance = Row({
    mainAxisSize: 'min',
    focusable: !isDisabled,
    style: mergeStyles(rowStyle),
    onClick: (e: any) => {
      e?.stopPropagation?.();
      select();
    },
    onKeyDown: (e: any) => {
      if (isDisabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault?.();
        select();
      }
    },
    children: [labelText],
  });

  // Semantics — match the headless Option semantics shape
  const optionSemantics: any = {
    role: 'option',
    label: props.label ?? String(props.value),
    selected: isSelected(),
    disabled: isDisabled,
    focusable: isActive(),
    autoFocus: isActive(),
    onActivate: select,
  };

  instance.semantics = optionSemantics;

  // Keep reactive
  createEffect(() => {
    optionSemantics.selected = isSelected();
    optionSemantics.focusable = isActive();
    optionSemantics.autoFocus = isActive();
  });

  return instance;
}
