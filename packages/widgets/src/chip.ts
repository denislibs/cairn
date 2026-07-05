import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, Row, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

export interface ChipProps extends LayoutChildProps {
  label: string;
  color?: string;
  variant?: 'solid' | 'soft' | 'outline';
  size?: 'sm' | 'md';
  onClick?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  leading?: Instance;
  style?: StyleInput;
}

// Tiny local helper — keeps alpha math inside the widget.
function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('rgba(') || hex.startsWith('rgb(')) {
    const inner = hex.replace(/^rgba?\(/, '').replace(/\)$/, '');
    const parts = inner.split(',').map((p) => p.trim());
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
  }
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function Chip(props: ChipProps): Instance {
  const t = useWidgetTheme();

  const disabled = !!props.disabled;
  const size = props.size ?? 'md';
  const variant = props.variant ?? 'soft';
  const colorKey = props.color ?? 'primary';

  const baseColor = t.colors[colorKey] ?? t.colors.primary;

  // Padding by size
  const padX = size === 'sm' ? t.spacing.sm : t.spacing.md;
  const padY = size === 'sm' ? 2 : 4;
  const fontSize = size === 'sm' ? t.fontSizes.xs : t.fontSizes.sm;
  const gap = size === 'sm' ? t.spacing.xs : t.spacing.sm;

  // Variant-based background / border
  let variantBg: string;
  let variantBorder: { width: number; color: string } | undefined;
  let labelColor: string;

  switch (variant) {
    case 'solid':
      variantBg = baseColor;
      variantBorder = undefined;
      labelColor = t.colors['on' + colorKey.charAt(0).toUpperCase() + colorKey.slice(1)] ?? t.colors.onPrimary;
      break;
    case 'outline':
      variantBg = 'transparent';
      variantBorder = { width: 1, color: t.colors.border };
      labelColor = baseColor;
      break;
    case 'soft':
    default:
      variantBg = withAlpha(baseColor, 0.12);
      variantBorder = undefined;
      labelColor = baseColor;
      break;
  }

  // ---------------------------------------------------------------------------
  // Delete control (trailing × affordance) — its own semantics node
  // ---------------------------------------------------------------------------
  let deleteInstance: Instance | undefined;
  if (props.onDelete) {
    const onDelete = props.onDelete;
    const deleteActivate = () => {
      if (!disabled) onDelete();
    };

    const { handlers: deleteHandlers } = createControl({
      disabled: props.disabled,
      onClick: deleteActivate,
    });

    const deleteLabel = Text({
      children: '×',
      style: () => ({
        fontSize: fontSize + 2,
        color: labelColor,
        fontWeight: t.fontWeights.medium,
      }),
    });

    const deleteSem: SemanticsNode = {
      role: 'button',
      label: 'Remove',
      disabled,
      onActivate: deleteActivate,
    };

    const deleteBox = Box({
      style: () => ({
        alignX: 'center' as const,
        alignY: 'center' as const,
        width: size === 'sm' ? 14 : 16,
        height: size === 'sm' ? 14 : 16,
        cursor: disabled ? 'default' : 'pointer',
      }),
      focusable: true,
      ...deleteHandlers,
      children: deleteLabel,
    });

    deleteBox.semantics = deleteSem;
    deleteInstance = deleteBox;
  }

  // ---------------------------------------------------------------------------
  // Chip row children: [leading?, label, deleteControl?]
  // ---------------------------------------------------------------------------
  const labelNode = Text({
    children: props.label,
    style: () => ({
      fontSize,
      color: labelColor,
      fontWeight: t.fontWeights.medium,
    }),
  });

  const rowChildren: Instance[] = [];
  if (props.leading) rowChildren.push(props.leading);
  rowChildren.push(labelNode);
  if (deleteInstance) rowChildren.push(deleteInstance);

  // ---------------------------------------------------------------------------
  // Chip pill style — a Box paints the fill/padding/border/radius (FlexNode/Row
  // ignores those); the inner Row only lays out the children (gap + align).
  // ---------------------------------------------------------------------------
  const chipStyle: StyleInput = mergeStyles(
    () => ({
      borderRadius: t.radii.pill,
      backgroundColor: variantBg,
      ...(variantBorder ? { border: variantBorder } : {}),
      padding: { left: padX, right: padX, top: padY, bottom: padY },
      opacity: disabled ? 0.5 : 1,
      cursor: (props.onClick && !disabled) ? 'pointer' : 'default',
    }),
    props.style,
  );

  const innerRow = Row({
    mainAxisSize: 'min',
    style: { gap, alignY: 'center' as const },
    children: rowChildren,
  });

  // ---------------------------------------------------------------------------
  // Main chip control (only when onClick provided)
  // ---------------------------------------------------------------------------
  const isInteractive = !!props.onClick;

  let chipHandlers = {};
  if (isInteractive) {
    const activate = () => {
      if (!disabled) props.onClick!();
    };
    const { handlers } = createControl({
      disabled: props.disabled,
      onClick: activate,
    });
    chipHandlers = handlers;
  }

  const instance = Box({
    style: chipStyle,
    focusable: isInteractive,
    ...chipHandlers,
    children: innerRow,
  });

  // ---------------------------------------------------------------------------
  // Semantics
  // ---------------------------------------------------------------------------
  if (isInteractive) {
    const activate = () => {
      if (!disabled) props.onClick!();
    };
    const chipSem: SemanticsNode = {
      role: 'button',
      label: props.label,
      disabled,
      onActivate: activate,
    };
    instance.semantics = chipSem;
  } else {
    const chipSem: SemanticsNode = {
      role: 'none',
    };
    instance.semantics = chipSem;
  }

  applyLayoutChildProps(instance, props);
  instance.debugName = 'Chip';
  return instance;
}
