import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useOverlays, Provider } from '@cairn/runtime';
import { createSignal, createEffect, type Accessor } from '@cairn/reactivity';
import { Box, Column, Text, Portal, mergeStyles, type StyleInput } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { ESCAPE } from './native/keys';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface DrawerContextValue {
  open: Accessor<boolean>;
  close: () => void;
  setTitle: (title: string) => void;
  /** Drawer.Content registers its body here; it renders ONLY in the portal (not inline). */
  registerContent: (build: () => Instance) => void;
}

export const drawerContext = createCompoundContext<DrawerContextValue>('Drawer');

// ─── Drawer root ──────────────────────────────────────────────────────────────

export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

export interface DrawerProps {
  open?: boolean | Accessor<boolean>;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: DrawerSide;
  children: () => Instance;
}

function DrawerRoot(props: DrawerProps): Instance {
  useOverlays(); // ensure we are inside an overlay registry
  const theme = useWidgetTheme();
  const side: DrawerSide = props.side ?? 'right';

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

  const openDrawer = (): void => {
    if (isControlled) {
      props.onOpenChange?.(true);
    } else {
      setInternalOpen(true);
      props.onOpenChange?.(true);
    }
  };

  let contentBuilder: (() => Instance) | null = null;
  const ctx: DrawerContextValue = {
    open,
    close,
    setTitle,
    registerContent: (build) => { contentBuilder = build; },
  };
  (ctx as any)._openDrawer = openDrawer;

  // Panel style based on side — full-height for left/right, full-width for top/bottom
  const panelStyle = (): StyleInput => {
    const base: Record<string, any> = {
      backgroundColor: theme.colors.surface,
      boxShadow: { color: 'rgba(0,0,0,0.24)', blur: 24, offsetX: 0, offsetY: 0 },
      padding: theme.spacing.lg,
    };
    if (side === 'right' || side === 'left') {
      base.width = 320;
      base.height = '100%';
    } else {
      // top / bottom
      base.width = '100%';
      base.minHeight = 200;
    }
    return () => base;
  };

  // Where the panel sits within the full-surface backdrop, per side.
  const containerAlign = (): { alignX: 'start' | 'center' | 'end'; alignY: 'start' | 'center' | 'end' } => {
    if (side === 'right') return { alignX: 'end', alignY: 'start' };
    if (side === 'left') return { alignX: 'start', alignY: 'start' };
    if (side === 'bottom') return { alignX: 'start', alignY: 'end' };
    return { alignX: 'start', alignY: 'start' }; // top
  };

  const portalContent = (): Instance => {
    const drawerSemantics: SemanticsNode = {
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

    createEffect(() => {
      drawerSemantics.label = title();
    });

    const contentChildren = Provider({
      context: drawerContext.context,
      value: ctx,
      children: () => (contentBuilder ? contentBuilder() : Box({ style: { width: 0, height: 0 } })),
    });

    const contentCol = Column({
      mainAxisSize: 'min',
      children: [contentChildren],
    });

    const panel = Box({
      style: mergeStyles(panelStyle(), () => ({})),
      onClick: (e) => { e.stopPropagation?.(); },
      children: contentCol,
    });

    panel.semantics = drawerSemantics;

    // Full-surface dim backdrop that anchors the panel to `side`; backdrop click closes.
    const align = containerAlign();
    return Portal({
      children: Box({
        style: {
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignX: align.alignX,
          alignY: align.alignY,
        },
        focusable: true,
        onClick: (e) => { e.stopPropagation?.(); close(); },
        children: panel,
      }),
    });
  };

  // Build the inline tree first (registers Drawer.Content's portal builder), then
  // wire the portal effect — so a Drawer that starts open renders its content.
  const inline = Provider({
    context: drawerContext.context,
    value: ctx,
    children: props.children,
  }) as unknown as Instance;

  createEffect(() => {
    if (open()) portalContent();
  });

  inline.debugName = 'Drawer';
  return inline;
}

// ─── Drawer.Trigger ───────────────────────────────────────────────────────────

export interface DrawerTriggerProps {
  children: string | Instance;
  style?: StyleInput;
}

function DrawerTrigger(props: DrawerTriggerProps): Instance {
  const ctx = drawerContext.use();
  const theme = useWidgetTheme();

  const triggerSemantics: SemanticsNode = {
    role: 'button',
    label: typeof props.children === 'string' ? props.children : '',
    expanded: false,
    focusable: true,
    onActivate: () => { (ctx as any)._openDrawer?.(); },
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
    onClick: () => { (ctx as any)._openDrawer?.(); },
    children: label,
  });

  trigger.semantics = triggerSemantics;
  trigger.debugName = 'DrawerTrigger';
  return trigger;
}

// ─── Drawer.Content ───────────────────────────────────────────────────────────

export interface DrawerContentProps {
  children: Instance | (() => Instance);
  style?: StyleInput;
}

function DrawerContent(props: DrawerContentProps): Instance {
  const theme = useWidgetTheme();
  const ctx = drawerContext.use();
  ctx.registerContent(() => {
    const child = typeof props.children === 'function' ? props.children() : props.children;
    return Column({
      mainAxisSize: 'min',
      style: mergeStyles(() => ({ gap: theme.spacing.sm }), props.style),
      children: [child],
    });
  });
  const inst = Box({ style: { width: 0, height: 0 } });
  inst.debugName = 'DrawerContent';
  return inst;
}

// ─── Drawer.Title ─────────────────────────────────────────────────────────────

export interface DrawerTitleProps {
  children: string;
  style?: StyleInput;
}

function DrawerTitle(props: DrawerTitleProps): Instance {
  const ctx = drawerContext.use();
  const theme = useWidgetTheme();

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
  inst.debugName = 'DrawerTitle';
  return inst;
}

// ─── Drawer.Close ─────────────────────────────────────────────────────────────

export interface DrawerCloseProps {
  children: string | Instance;
  style?: StyleInput;
}

function DrawerClose(props: DrawerCloseProps): Instance {
  const ctx = drawerContext.use();
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
  btn.debugName = 'DrawerClose';
  return btn;
}

// ─── Drawer (compound) ────────────────────────────────────────────────────────

export const Drawer = Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Content: DrawerContent,
  Title: DrawerTitle,
  Close: DrawerClose,
});

