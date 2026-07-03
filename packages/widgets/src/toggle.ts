import type { Instance } from '@cairn/runtime';
import { createSignal, type Accessor } from '@cairn/reactivity';
import { Box, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl, type ControlState } from './control';

export interface ToggleProps extends LayoutChildProps {
  /** Controlled pressed state — an accessor or plain boolean. */
  pressed?: boolean | Accessor<boolean>;
  /** Initial pressed state for uncontrolled mode. */
  defaultPressed?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  style?: StyleInput;
  /** Render-fn slot receives ControlState + { togglePressed: Accessor<boolean> } so the fn
   *  can read both the interaction state (hovered/pressed/focused) and the toggle state. */
  children?: Instance | ((state: ControlState & { togglePressed: Accessor<boolean> }) => Instance);
  label?: string;
}

/** Tiny hex/rgba alpha helper — same as in button.ts, kept local so widgets don't import material. */
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

export function Toggle(props: ToggleProps): Instance {
  const t = useWidgetTheme();

  // --- Controlled / uncontrolled pressed state ---
  const controlled = props.pressed !== undefined;
  const [internal, setInternal] = createSignal(props.defaultPressed ?? false);

  const read: Accessor<boolean> = (): boolean => {
    if (controlled) {
      const p = props.pressed!;
      return typeof p === 'function' ? (p as Accessor<boolean>)() : (p as boolean);
    }
    return internal();
  };

  const toggle = (): void => {
    if (props.disabled) return;
    const next = !read();
    if (!controlled) setInternal(next);
    props.onChange?.(next);
  };

  const { state, handlers } = createControl({
    disabled: props.disabled,
    onClick: toggle,
  });

  const primary = t.colors.primary;

  // Style: ghost-like base, background driven reactively by read() (the toggle state).
  const composedStyle: StyleInput = mergeStyles(
    (th: any) => ({
      borderRadius: t.radii.md,
      alignX: 'center' as const,
      alignY: 'center' as const,
      padding: { left: t.control.padX.md, right: t.control.padX.md, top: 0, bottom: 0 },
      height: t.control.height.md,
      overflow: 'hidden' as const,
      cursor: props.disabled ? 'default' : 'pointer',
      opacity: props.disabled ? 0.5 : 1,
      backgroundColor: read() ? withAlpha(primary, 0.16) : 'transparent',
      hover: { backgroundColor: read() ? withAlpha(primary, 0.24) : withAlpha(primary, 0.08) },
      pressed: { backgroundColor: withAlpha(primary, 0.28) },
    }),
    props.style,
  );

  if (typeof props.children === 'function') {
    // Render-fn slot: pass both ControlState and the toggle pressed accessor.
    const childState = { ...state, togglePressed: read };
    const child = props.children(childState);
    const boxStyle = mergeStyles(props.style);
    const instance = Box({
      style: boxStyle,
      focusable: true,
      ...handlers,
      children: child,
    });
    applyLayoutChildProps(instance, props);
    return instance;
  }

  const child: Instance = props.children
    ? props.children
    : Text({
        style: (th: any) => ({
          color: read() ? primary : t.colors.text,
          fontWeight: t.fontWeights.medium,
          fontSize: t.fontSizes.md,
        }),
        children: props.label ?? '',
      });

  const instance = Box({
    style: composedStyle,
    focusable: true,
    ...handlers,
    children: child,
  });

  applyLayoutChildProps(instance, props);
  return instance;
}
