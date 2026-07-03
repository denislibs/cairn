import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps, type EventProps } from '@cairn/primitives';
import { StyleSheet, type Style } from '@cairn/style';
import { useWidgetTheme } from './theme';
import { createControl, type ControlState } from './control';

// Pointer/keyboard handlers are typed via EventProps so consumers (e.g. Material)
// can pass onPointerDown with types. onClick is our own no-arg form.
export interface ButtonProps extends LayoutChildProps, Omit<EventProps, 'onClick'> {
  variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  /** A key in WidgetTheme.colors (the "base" key, e.g. 'primary', 'secondary', 'danger'). Defaults to 'primary'. */
  color?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  style?: StyleInput;
  label?: string;
  children?: Instance | ((state: ControlState) => Instance);
}

// Tiny local helper — keeps widgets independent of @cairn/material.
function withAlpha(hex: string, alpha: number): string {
  // Handle rgba() strings by injecting alpha
  if (hex.startsWith('rgba(') || hex.startsWith('rgb(')) {
    // Strip existing alpha and replace; simpler: convert to rgba with alpha
    const inner = hex.replace(/^rgba?\(/, '').replace(/\)$/, '');
    const parts = inner.split(',').map((p) => p.trim());
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
  }
  // Handle #rrggbb or #rgb hex
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Static default geometry lives in StyleSheet.create (the library idiom: default
// styles are authored here; colours/state come from the theme + variant below).
const STYLES = StyleSheet.create({
  base: { alignX: 'center', alignY: 'center', overflow: 'hidden' },
});

export function Button(props: ButtonProps): Instance {
  const t = useWidgetTheme();

  const disabled = !!props.disabled;

  // The activate action is the canonical way to fire onClick — guards against disabled.
  const activate = () => {
    if (!disabled) props.onClick?.();
  };

  const { state, handlers, setFocusVisible } = createControl({
    disabled: props.disabled,
    onClick: props.onClick,
    onPointerEnter: props.onPointerEnter,
    onPointerLeave: props.onPointerLeave,
    onPointerDown: props.onPointerDown,
    onPointerUp: props.onPointerUp,
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    onKeyDown: props.onKeyDown,
    onKeyUp: props.onKeyUp,
  });

  const semantics: SemanticsNode = {
    role: 'button',
    label: props.label ?? '',
    disabled,
    onActivate: activate,
    onFocus: (keyboard: boolean) => setFocusVisible(keyboard),
    onBlur: () => setFocusVisible(false),
  };

  const size = props.size ?? 'md';
  const colorKey = props.color ?? 'primary';
  const variant = props.variant ?? 'solid';

  // Resolve color tokens from theme. Fall back to primary if the key doesn't exist.
  const baseColor = t.colors[colorKey] ?? t.colors.primary;
  const hoverColor = t.colors[colorKey + 'Hover'] ?? t.colors[colorKey + 'Hover'] ?? t.colors.primaryHover;
  const activeColor = t.colors[colorKey + 'Active'] ?? t.colors.primaryActive;
  const onColor = t.colors['on' + capitalize(colorKey)] ?? t.colors.onPrimary;

  const baseStyle: Style = {
    ...STYLES.base,
    borderRadius: t.radii.md,
    padding: { left: t.control.padX[size], right: t.control.padX[size], top: 0, bottom: 0 },
    height: t.control.height[size],
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };

  let variantStyle: Style;
  switch (variant) {
    case 'solid':
      variantStyle = {
        backgroundColor: baseColor,
        hover: { backgroundColor: hoverColor },
        pressed: { backgroundColor: activeColor },
      };
      break;
    case 'soft':
      variantStyle = {
        backgroundColor: withAlpha(baseColor, 0.12),
        hover: { backgroundColor: withAlpha(baseColor, 0.2) },
        pressed: { backgroundColor: withAlpha(baseColor, 0.28) },
      };
      break;
    case 'outline':
      variantStyle = {
        backgroundColor: 'transparent',
        border: { width: 1, color: t.colors.border },
        hover: { backgroundColor: withAlpha(baseColor, 0.08) },
        pressed: { backgroundColor: withAlpha(baseColor, 0.16) },
      };
      break;
    case 'ghost':
      variantStyle = {
        backgroundColor: 'transparent',
        hover: { backgroundColor: withAlpha(baseColor, 0.08) },
        pressed: { backgroundColor: withAlpha(baseColor, 0.16) },
      };
      break;
    case 'link':
      variantStyle = {
        backgroundColor: 'transparent',
        textDecoration: 'underline',
      };
      break;
    default:
      variantStyle = {};
  }

  // Resolve label text color by variant
  const labelColor = variant === 'solid' ? onColor : baseColor;

  if (typeof props.children === 'function') {
    // Render-fn slot: no default visual — the fn owns the look.
    const child = props.children(state);
    const boxStyle = mergeStyles(
      props.fullWidth ? { width: '100%' as any } : undefined,
      props.style,
    );
    const instance = Box({
      style: boxStyle,
      focusable: true,
      ...handlers,
      children: child,
    });
    instance.semantics = semantics;
    applyLayoutChildProps(instance, props);
    return instance;
  }

  // Default visual path — the focus ring is only painted on keyboard focus.
  // A real outline (stroked OUTSIDE the box with a gap) — the native focus-ring
  // look; renders cleanly on any variant/colour (unlike a same-colour boxShadow).
  const focusRingStyle: Style = {
    outline: { width: 2, color: t.colors.focusRing, offset: 2 },
  };

  const defaultVariantStyle: StyleInput = (_th) => [
    baseStyle,
    variantStyle,
    props.fullWidth ? ({ width: '100%' as any } as Style) : {},
    state.focusVisible() ? focusRingStyle : {},
  ];

  const composedStyle = mergeStyles(defaultVariantStyle, props.style);

  const child: Instance = props.children
    ? props.children
    : Text({
        style: (_th) => ({
          color: labelColor,
          fontWeight: t.fontWeights.medium,
          fontSize: size === 'sm' ? t.fontSizes.sm : t.fontSizes.md,
        }),
        children: props.label ?? '',
      });

  const instance = Box({
    style: composedStyle,
    focusable: true,
    ...handlers,
    children: child,
  });

  instance.semantics = semantics;
  applyLayoutChildProps(instance, props);
  return instance;
}
