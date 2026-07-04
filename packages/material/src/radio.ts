/**
 * Material Radio — wraps headless @cairn/widgets Radio.
 *
 * Radio has NO render-slot (children is a plain Instance, not a function).
 * Strategy: reconstruct ring + dot visuals using Material palette tokens,
 * ripple, and state-layer; pass value/disabled through to headless so all
 * behavior, keyboard navigation, and a11y semantics come from headless.
 *
 * Re-exports RadioGroup (and radioGroupContext) from @cairn/widgets so
 * Material users get the full group without a separate import.
 */
import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Row, Stack, Text } from '@cairn/primitives';
import {
  Radio as HeadlessRadio,
  RadioGroup as HeadlessRadioGroup,
  radioGroupContext,
  type RadioProps as HeadlessRadioProps,
} from '@cairn/widgets';
import { createRipple } from './ripple';
import { stateOverlay } from './state-layer';
import type { MaterialTheme } from './theme';

// Re-export so Material users can import RadioGroup + radioGroupContext from this module.
export { HeadlessRadioGroup as RadioGroup, radioGroupContext };

// ─── Dimensions ──────────────────────────────────────────────────────────────

/** Outer ring diameter — matches headless default */
const RING_SIZE = 20;
/** Outer ring border radius (full circle) */
const RING_RADIUS = 10;
/** Inner dot diameter */
const DOT_SIZE = 10;
/** Inner dot border radius (full circle) */
const DOT_RADIUS = 5;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface RadioProps {
  value: any;
  disabled?: boolean;
  label?: string;
}

// ─── Radio ───────────────────────────────────────────────────────────────────

export function Radio(props: RadioProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const c = t.palette.primary;
  const isDisabled = !!props.disabled;

  // ── Step 1: headless Radio — behavior, keyboard nav, a11y semantics ──────
  // Radio has no render-slot so headless builds its own default visual, which
  // we discard. We keep only handlers + semantics from the returned instance.
  const headlessProps: HeadlessRadioProps = {
    value: props.value,
    disabled: isDisabled,
    label: props.label,
  };
  const headless = HeadlessRadio(headlessProps);

  // ── Step 2: read checked state via headless semantics ────────────────────
  // semantics.checked is updated reactively by the headless via createEffect.
  const isChecked = (): boolean => !!(headless.semantics?.checked);

  // ── Step 3: Ripple (centered on the ring) ────────────────────────────────
  const ripple = createRipple({
    color: c.main,
    radius: RING_RADIUS,
  });

  // ── Step 4: Material visual structure ────────────────────────────────────
  //
  // Layout (centered Stack):
  //   Stack (sizes to ring — ripple is overlay)
  //     ripple.instance  [overlay flag — doesn't drive Stack size]
  //     ring Box (RING_SIZE × RING_SIZE, circular border, color per checked)
  //       dot Box (DOT_SIZE × DOT_SIZE, filled when checked)
  //
  // RULE: Row/Column never paint backgroundColor/border — all painted surfaces
  // must be a Box. Strings must be wrapped in Text. ✓

  // Inner filled dot — visible only when checked
  const dot = Box({
    style: () => ({
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_RADIUS,
      backgroundColor: isChecked() ? c.main : 'transparent',
    }),
  });

  // Outer ring — circular border, color changes on checked
  const ring = Box({
    style: () => ({
      width: RING_SIZE,
      height: RING_SIZE,
      borderRadius: RING_RADIUS,
      backgroundColor: 'transparent',
      border: {
        width: 2,
        color: isChecked() ? c.main : t.palette.text.secondary,
      },
      alignX: 'center' as const,
      alignY: 'center' as const,
      hover: {
        border: {
          width: 2,
          color: isDisabled ? t.palette.text.secondary : c.main,
        },
      },
    }),
    children: dot,
  });

  // Stack layers ripple (overlay) behind the ring (content).
  // Stack sizes to its non-overlay children → sized to the ring.
  const radioStack = Stack({ children: [ripple.instance, ring] });

  // ── Step 5: wire ripple trigger on pointer-down ───────────────────────────
  const origPointerDown = headless.handlers?.onPointerDown;
  const patchedHandlers = {
    ...headless.handlers,
    onPointerDown: (e: any) => {
      if (!isDisabled) ripple.trigger(RING_SIZE / 2, RING_SIZE / 2);
      origPointerDown?.(e);
    },
  };

  // ── Step 6: compose — label or bare ring ──────────────────────────────────
  let visualRoot: Instance;
  if (props.label) {
    visualRoot = Row({
      mainAxisSize: 'min',
      style: {
        gap: 8,
        alignY: 'center' as const,
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.38 : 1,
      },
      children: [
        radioStack,
        Text({
          style: {
            color: isDisabled ? t.palette.text.disabled : t.palette.text.primary,
            fontSize: t.typography.body2.fontSize,
            fontWeight: t.typography.body2.fontWeight,
            lineHeight: t.typography.body2.lineHeight,
          },
          children: props.label,
        }),
      ],
    });
  } else {
    // Wrap the stack in a Box so we can apply hover state-layer via a style
    visualRoot = Box({
      style: () => ({
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.38 : 1,
        hover: {
          backgroundColor: isDisabled ? 'transparent' : stateOverlay(c.main, 'hover'),
        },
        pressed: {
          backgroundColor: isDisabled ? 'transparent' : stateOverlay(c.main, 'pressed'),
        },
      }),
      children: radioStack,
    });
  }

  // ── Step 7: build final Instance — visual tree + headless handlers/semantics
  const inst: Instance = {
    layout: visualRoot.layout,
    children: visualRoot.children,
    paintSelf: visualRoot.paintSelf,
    focusable: headless.focusable,
    handlers: patchedHandlers,
    semantics: headless.semantics,
  };

  return inst;
}
