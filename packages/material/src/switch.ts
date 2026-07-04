import type { Instance } from '@cairn/runtime';
import { createSignal } from '@cairn/reactivity';
import type { Accessor } from '@cairn/reactivity';
import { useTheme } from '@cairn/style';
import { Row, Text } from '@cairn/primitives';
import { Switch as HeadlessSwitch, type SwitchProps as HeadlessSwitchProps } from '@cairn/widgets';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

export interface SwitchProps {
  /** Controlled checked state — plain boolean or reactive accessor. */
  checked?: boolean | Accessor<boolean>;
  /** Initial state for uncontrolled mode. */
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  /** Material palette color used for the on-state track. Defaults to 'primary'. */
  color?: MaterialColor;
  disabled?: boolean;
  /** Optional text label rendered to the right of the switch. */
  label?: string;
}

export function Switch(props: SwitchProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const color = props.color ?? 'primary';
  const c = (t.palette as unknown as Record<string, import('./theme').PaletteColor>)[color];
  const disabled = !!props.disabled;

  // -----------------------------------------------------------------------
  // Integration: the headless Switch has no render slot — it builds track +
  // thumb internally. We wrap it and pass a Material `style` override for the
  // track (backgroundColor, borderRadius, opacity, cursor). The track color
  // must be reactive (off = grey, on = primary.main), but we cannot read the
  // headless's internal checked signal from outside. We therefore:
  //   1. Mirror the checked state locally with a parallel signal.
  //   2. Intercept onChange to keep our mirror in sync.
  //   3. Use our mirror to drive a reactive `style` fn passed to headless.
  //
  // Thumb elevation: the headless thumb is a plain Box (no shadow). We add a
  // visually equivalent ring via boxShadow on the track's focus state to keep
  // things simple (no access to internal thumb node).
  // -----------------------------------------------------------------------

  // Mirror checked state (controlled or uncontrolled) so we can drive a
  // reactive style closure without reaching into headless internals.
  const controlled = props.checked !== undefined;
  const [mirror, setMirror] = createSignal<boolean>(props.defaultChecked ?? false);

  // Keep mirror in sync: if controlled, mirror reads from props.checked.
  const readChecked = (): boolean => {
    if (controlled) {
      const ch = props.checked!;
      return typeof ch === 'function' ? (ch as Accessor<boolean>)() : (ch as boolean);
    }
    return mirror();
  };

  // Intercept onChange so we can update our mirror for uncontrolled mode.
  const handleChange = (v: boolean): void => {
    if (!controlled) setMirror(v);
    props.onChange?.(v);
  };

  // Material track colors:
  //   off → action.disabledBg  (neutral grey — Material M2 off-track surface)
  //   on  → palette[color].main
  const trackOnColor = c.main;
  const trackOffColor = t.palette.action.disabledBg;

  // -----------------------------------------------------------------------
  // Build the headless Switch with a Material `style` override.
  // `style` in the headless is passed to mergeStyles as the second argument,
  // so it merges AFTER the headless's own reactive style — the headless's
  // reactive backgroundColor (trackOn/trackOff) overrides ours.
  //
  // To win, we pass `style` as a reactive function: mergeStyles calls it
  // inside a reactive scope, so readChecked() creates a dependency and the
  // track re-paints when checked changes. Our function runs after the headless
  // reactive object, so our backgroundColor wins.
  // -----------------------------------------------------------------------
  const headlessProps: HeadlessSwitchProps = {
    checked: props.checked,
    defaultChecked: props.defaultChecked,
    onChange: handleChange,
    disabled,
    // Pass `style` as a function — this is the StyleInput function form. The
    // headless calls mergeStyles(reactiveStyleFn, props.style) and
    // resolveStyleInput evaluates all entries; later entries overwrite earlier
    // ones for the same key. Our fn is the second item so our backgroundColor
    // takes precedence over the headless's reactive backgroundColor.
    style: () => ({
      backgroundColor: readChecked() ? trackOnColor : trackOffColor,
      borderRadius: 9999,
      opacity: disabled ? 0.38 : 1,
      cursor: disabled ? 'default' : 'pointer',
    }),
  };

  const switchInstance = HeadlessSwitch(headlessProps);

  if (!props.label) {
    return switchInstance;
  }

  // Optional label: Row of [switch, Text]
  const typ = t.typography.body2;
  const labelText = Text({
    style: {
      color: disabled ? t.palette.text.disabled : t.palette.text.primary,
      fontSize: typ.fontSize,
      fontWeight: typ.fontWeight,
      letterSpacing: typ.letterSpacing,
    },
    children: props.label,
  });

  // Give the switch an accessible name from the label (Material renders the
  // label text itself, so it isn't forwarded to the headless Switch).
  if (switchInstance.semantics) switchInstance.semantics.label = props.label;

  // Pure layout wrapper — semantics/focus/handlers stay on `switchInstance`.
  // Copying them onto the row too would emit a DUPLICATE a11y node.
  const row = Row({
    mainAxisSize: 'min',
    style: { gap: 8, alignY: 'center' },
    children: [switchInstance, labelText],
  });
  return row;
}
