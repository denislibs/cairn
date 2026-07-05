import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useOverlays, Provider } from '@cairn/runtime';
import { createSignal, createEffect, type Accessor } from '@cairn/reactivity';
import { Box, Column, Text, Portal, mergeStyles, type StyleInput } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { ESCAPE } from './native/keys';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface DialogContextValue {
  open: Accessor<boolean>;
  close: () => void;
  setTitle: (title: string) => void;
  /** Dialog.Content registers its body here; it renders ONLY in the portal (not inline). */
  registerContent: (build: () => Instance) => void;
}

export const dialogContext = createCompoundContext<DialogContextValue>('Dialog');

// ─── Dialog root ──────────────────────────────────────────────────────────────

export interface DialogProps {
  open?: boolean | Accessor<boolean>;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: () => Instance;
}

function DialogRoot(props: DialogProps): Instance {
  const overlays = useOverlays();
  const theme = useWidgetTheme();

  const isControlled = props.open !== undefined;
  const resolveOpen = (): boolean =>
    typeof props.open === 'function'
      ? (props.open as Accessor<boolean>)()
      : (props.open as boolean) ?? false;

  const [internalOpen, setInternalOpen] = createSignal(props.defaultOpen ?? false);
  const open = (): boolean => (isControlled ? resolveOpen() : internalOpen());

  const [title, setTitle] = createSignal('');

  const close = (): void => {
    if (isControlled) {
      props.onOpenChange?.(false);
    } else {
      setInternalOpen(false);
      props.onOpenChange?.(false);
    }
  };

  const openDialog = (): void => {
    if (isControlled) {
      props.onOpenChange?.(true);
    } else {
      setInternalOpen(true);
      props.onOpenChange?.(true);
    }
  };

  // Dialog.Content registers its body here; it is rendered ONLY inside the portal,
  // never inline in the app tree.
  let contentBuilder: (() => Instance) | null = null;

  const ctx: DialogContextValue = {
    open,
    close,
    setTitle,
    registerContent: (build) => { contentBuilder = build; },
  };

  // Build a trigger placeholder — the real tree is built by children() which
  // may include Dialog.Trigger, Dialog.Content, etc.
  const triggerPlaceholder = Box({ style: { width: 0, height: 0 } });

  // ── Portal overlay (content) ──
  const portalContent = (): Instance => {
    // Dialog surface
    const surfaceStyle: StyleInput = () => ({
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      boxShadow: { color: 'rgba(0,0,0,0.24)', blur: 24, offsetX: 0, offsetY: 8 },
      padding: theme.spacing.lg,
      minWidth: 320,
    });

    const dialogSemantics: SemanticsNode = {
      role: 'dialog',
      modal: true,
      label: title(),
      focusable: true,
      autoFocus: true,
      onKeyDown: (key) => {
        if (key === ESCAPE) {
          close();
          return true;
        }
        return false;
      },
    };

    // Keep label reactive
    createEffect(() => {
      dialogSemantics.label = title();
    });

    const contentChildren = Provider({
      context: dialogContext.context,
      value: ctx,
      children: () => (contentBuilder ? contentBuilder() : Box({ style: { width: 0, height: 0 } })),
    });

    const contentCol = Column({
      mainAxisSize: 'min',
      children: [contentChildren],
    });

    const surface = Box({
      style: surfaceStyle,
      onClick: (e) => { e.stopPropagation?.(); },
      children: contentCol,
    });

    surface.semantics = dialogSemantics;

    // Full-surface dim backdrop that CENTERS the dialog surface; clicking the
    // backdrop (outside the surface) closes, clicking the surface does not.
    return Portal({
      children: Box({
        style: {
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignX: 'center',
          alignY: 'center',
        },
        focusable: true,
        onClick: (e) => { e.stopPropagation?.(); close(); },
        children: surface,
      }),
    });
  };

  // Attach the trigger's open logic to the context via a special mechanism:
  // Trigger calls openDialog() from the ctx. We make openDialog available
  // by injecting it into the context after creation. (ctx is a plain object,
  // we can patch it before it's used by Trigger.)
  (ctx as any).open = open;
  (ctx as any)._openDialog = openDialog;

  // Build the inline tree FIRST (Provider renders children eagerly → Dialog.Content
  // registers its portal builder). Only then wire the portal effect, so a Dialog that
  // starts open has its content builder available on the first render.
  const inline = Provider({
    context: dialogContext.context,
    value: ctx,
    children: props.children,
  }) as unknown as Instance;

  createEffect(() => {
    if (open()) portalContent();
  });

  inline.debugName = 'Dialog';
  return inline;
}

// ─── Dialog.Trigger ───────────────────────────────────────────────────────────

export interface DialogTriggerProps {
  children: string | Instance;
  style?: StyleInput;
}

function DialogTrigger(props: DialogTriggerProps): Instance {
  const ctx = dialogContext.use();
  const theme = useWidgetTheme();

  const triggerSemantics: SemanticsNode = {
    role: 'button',
    label: typeof props.children === 'string' ? props.children : '',
    expanded: false,
    focusable: true,
    onActivate: () => { (ctx as any)._openDialog?.(); },
  };

  createEffect(() => {
    triggerSemantics.expanded = ctx.open();
  });

  const label = typeof props.children === 'string'
    ? Text({
        style: () => ({ color: theme.colors.text, fontSize: theme.fontSizes.md }),
        children: props.children,
      })
    : props.children;

  const trigger = Box({
    style: mergeStyles(
      () => ({
        backgroundColor: theme.colors.surface,
        border: { width: 1, color: theme.colors.borderStrong },
        borderRadius: theme.radii.md,
        paddingLeft: theme.control.padX.md,
        paddingRight: theme.control.padX.md,
        height: theme.control.height.md,
        alignY: 'center' as const,
        cursor: 'pointer',
      }),
      props.style,
    ),
    focusable: true,
    onClick: () => { (ctx as any)._openDialog?.(); },
    children: label,
  });

  trigger.semantics = triggerSemantics;
  trigger.debugName = 'DialogTrigger';
  return trigger;
}

// ─── Dialog.Content ───────────────────────────────────────────────────────────

export interface DialogContentProps {
  children: Instance | (() => Instance);
  style?: StyleInput;
}

function DialogContent(props: DialogContentProps): Instance {
  const theme = useWidgetTheme();
  const ctx = dialogContext.use();
  // Register the body — it is rendered by the root INSIDE the portal (when open),
  // not inline here. Inline we return a zero-size placeholder.
  ctx.registerContent(() => {
    const child = typeof props.children === 'function' ? props.children() : props.children;
    return Column({
      mainAxisSize: 'min',
      style: mergeStyles(() => ({ gap: theme.spacing.sm }), props.style),
      children: [child],
    });
  });
  const inst = Box({ style: { width: 0, height: 0 } });
  inst.debugName = 'DialogContent';
  return inst;
}

// ─── Dialog.Title ─────────────────────────────────────────────────────────────

export interface DialogTitleProps {
  children: string;
  style?: StyleInput;
}

function DialogTitle(props: DialogTitleProps): Instance {
  const ctx = dialogContext.use();
  const theme = useWidgetTheme();

  // Register the title with the dialog context so the surface can use it as label
  createEffect(() => {
    ctx.setTitle(props.children);
  });

  const inst = Text({
    style: mergeStyles(
      () => ({
        color: theme.colors.text,
        fontSize: theme.fontSizes.lg,
        fontWeight: theme.fontWeights.semibold,
      }),
      props.style,
    ),
    children: props.children,
  });
  inst.debugName = 'DialogTitle';
  return inst;
}

// ─── Dialog.Description ───────────────────────────────────────────────────────

export interface DialogDescriptionProps {
  children: string;
  style?: StyleInput;
}

function DialogDescription(props: DialogDescriptionProps): Instance {
  const theme = useWidgetTheme();
  const inst = Text({
    style: mergeStyles(
      () => ({ color: theme.colors.textMuted, fontSize: theme.fontSizes.sm }),
      props.style,
    ),
    children: props.children,
  });
  inst.debugName = 'DialogDescription';
  return inst;
}

// ─── Dialog.Close ─────────────────────────────────────────────────────────────

export interface DialogCloseProps {
  children: string | Instance;
  style?: StyleInput;
}

function DialogClose(props: DialogCloseProps): Instance {
  const ctx = dialogContext.use();
  const theme = useWidgetTheme();

  const closeSemantics: SemanticsNode = {
    role: 'button',
    label: typeof props.children === 'string' ? props.children : 'Close',
    focusable: true,
    onActivate: () => { ctx.close(); },
  };

  const label = typeof props.children === 'string'
    ? Text({
        style: () => ({ color: theme.colors.text, fontSize: theme.fontSizes.md }),
        children: props.children,
      })
    : props.children;

  const btn = Box({
    style: mergeStyles(
      () => ({
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radii.md,
        paddingLeft: theme.control.padX.sm,
        paddingRight: theme.control.padX.sm,
        height: theme.control.height.sm,
        alignY: 'center' as const,
        cursor: 'pointer',
      }),
      props.style,
    ),
    focusable: true,
    onClick: () => { ctx.close(); },
    children: label,
  });

  btn.semantics = closeSemantics;
  btn.debugName = 'DialogClose';
  return btn;
}

// ─── Dialog (compound) ────────────────────────────────────────────────────────

export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});

