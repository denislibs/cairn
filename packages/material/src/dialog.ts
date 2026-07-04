import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Row, Column, Text, mergeStyles, type StyleInput } from '@cairn/primitives';
import {
  Dialog as HeadlessDialog,
  type DialogProps as HeadlessDialogProps,
  type DialogTriggerProps as HeadlessTriggerProps,
  type DialogContentProps as HeadlessContentProps,
  type DialogTitleProps as HeadlessTitleProps,
  type DialogDescriptionProps as HeadlessDescriptionProps,
  type DialogCloseProps as HeadlessCloseProps,
} from '@cairn/widgets';
import type { MaterialTheme } from './theme';
import type { Accessor } from '@cairn/reactivity';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DialogProps {
  open?: boolean | Accessor<boolean>;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: () => Instance;
}

export interface DialogTriggerProps {
  children: string | Instance;
  style?: StyleInput;
}

export interface DialogContentProps {
  children: Instance | (() => Instance);
  style?: StyleInput;
}

export interface DialogTitleProps {
  children: string;
  style?: StyleInput;
}

export interface DialogDescriptionProps {
  children: string;
  style?: StyleInput;
}

export interface DialogActionsProps {
  children: Instance | Instance[];
  style?: StyleInput;
}

export interface DialogCloseProps {
  children: string | Instance;
  style?: StyleInput;
}

// ─── Dialog (root) ─────────────────────────────────────────────────────────────

/**
 * Material Dialog root. Delegates all open/close/modal/a11y behavior to the
 * headless `@cairn/widgets` Dialog. Styling is applied in `Dialog.Content`.
 */
function DialogRoot(props: DialogProps): Instance {
  const headlessProps: HeadlessDialogProps = {
    open: props.open as any,
    defaultOpen: props.defaultOpen,
    onOpenChange: props.onOpenChange,
    children: props.children,
  };
  return HeadlessDialog(headlessProps);
}

// ─── Dialog.Trigger ────────────────────────────────────────────────────────────

/**
 * Material Dialog trigger. Delegates to headless `Dialog.Trigger` — keeps
 * `role:button`, `expanded`, and `onActivate` semantics from headless.
 * The visual styling (no own opinionated style on the trigger; callers pass
 * a Material Button as children for full styling).
 */
function DialogTrigger(props: DialogTriggerProps): Instance {
  const headlessProps: HeadlessTriggerProps = {
    children: props.children,
    style: props.style,
  };
  return HeadlessDialog.Trigger(headlessProps);
}

// ─── Dialog.Content ─────────────────────────────────────────────────────────

/**
 * Material Dialog content. Wraps headless `Dialog.Content` inside a Material
 * paper surface Box:
 *   - backgroundColor: palette.background.paper
 *   - boxShadow: elevation[24]
 *   - borderRadius: shape.borderRadius
 *   - padding: 24
 *   - maxWidth: 560
 */
function DialogContent(props: DialogContentProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;

  // Clamp elevation to valid range [0..24]
  const elevIdx = Math.min(24, t.elevation.length - 1);

  const paperStyle: StyleInput = {
    backgroundColor: t.palette.background.paper,
    boxShadow: t.elevation[elevIdx],
    borderRadius: t.shape.borderRadius,
    padding: 24,
    maxWidth: 560,
  };

  // The headless Dialog.Content only registers a content builder (portal pattern).
  // We inject a wrapper: wrap the caller's children in a Material paper surface Column.
  const headlessProps: HeadlessContentProps = {
    children: () => {
      const child = typeof props.children === 'function' ? props.children() : props.children;
      return Box({
        style: mergeStyles(paperStyle, props.style),
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 8 },
          children: Array.isArray(child) ? child : [child],
        }),
      });
    },
    // No extra style on the headless wrapper itself — all style is on our Box.
  };

  return HeadlessDialog.Content(headlessProps);
}

// ─── Dialog.Title ────────────────────────────────────────────────────────────

/**
 * Material Dialog title. Wraps headless `Dialog.Title`. Applies h6 typography
 * (fontSize 20, fontWeight 500, letterSpacing 0.15) in `palette.text.primary`.
 */
function DialogTitle(props: DialogTitleProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const h6 = t.typography.h6;

  const titleStyle: StyleInput = mergeStyles(
    {
      color: t.palette.text.primary,
      fontSize: h6.fontSize,
      fontWeight: h6.fontWeight,
      lineHeight: h6.lineHeight,
      letterSpacing: h6.letterSpacing,
    },
    props.style,
  );

  // headless Dialog.Title also calls ctx.setTitle for a11y label.
  const headlessProps: HeadlessTitleProps = {
    children: props.children,
    style: titleStyle,
  };
  return HeadlessDialog.Title(headlessProps);
}

// ─── Dialog.Description ──────────────────────────────────────────────────────

/**
 * Material Dialog description. Wraps headless `Dialog.Description`. Renders
 * in body2 typography in `palette.text.secondary`.
 */
function DialogDescription(props: DialogDescriptionProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const body2 = t.typography.body2;

  const descStyle: StyleInput = mergeStyles(
    {
      color: t.palette.text.secondary,
      fontSize: body2.fontSize,
      fontWeight: body2.fontWeight,
      lineHeight: body2.lineHeight,
      letterSpacing: body2.letterSpacing,
    },
    props.style,
  );

  const headlessProps: HeadlessDescriptionProps = {
    children: props.children,
    style: descStyle,
  };
  return HeadlessDialog.Description(headlessProps);
}

// ─── Dialog.Actions ──────────────────────────────────────────────────────────

/**
 * Material Dialog actions area. A right-aligned Row (gap 8) for action buttons.
 * Not a headless part — purely a layout helper composable inside Dialog.Content.
 */
function DialogActions(props: DialogActionsProps): Instance {
  const children = Array.isArray(props.children) ? props.children : [props.children];
  return Row({
    mainAxisSize: 'max',
    style: mergeStyles(
      {
        gap: 8,
        alignX: 'end' as const,
        alignY: 'center' as const,
      },
      props.style,
    ),
    children,
  });
}

// ─── Dialog.Close ────────────────────────────────────────────────────────────

/**
 * Material Dialog close button. Wraps headless `Dialog.Close` — keeps
 * `role:button` and `onActivate → ctx.close()` from headless.
 */
function DialogClose(props: DialogCloseProps): Instance {
  const headlessProps: HeadlessCloseProps = {
    children: props.children,
    style: props.style,
  };
  return HeadlessDialog.Close(headlessProps);
}

// ─── Compound export ─────────────────────────────────────────────────────────

export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Actions: DialogActions,
  Close: DialogClose,
});
