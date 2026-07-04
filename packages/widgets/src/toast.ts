import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useOverlays, useHost, Provider } from '@cairn/runtime';
import { createSignal, createEffect, useContext, type Accessor } from '@cairn/reactivity';
import { Box, Column, Row, Text, Portal, mergeStyles, type StyleInput } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { useAnnounce } from './native/announce';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'default' | 'success' | 'error' | 'destructive' | 'warning' | 'info';
export type ToastPlacement = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center' | 'top-center';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: string;
  startTime: number | null;
}

export interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const toastContext = createCompoundContext<ToastContextValue>('Toast');

export function useToast(): ToastContextValue {
  return toastContext.use();
}

// ─── ID generator ─────────────────────────────────────────────────────────────

let toastId = 0;
function nextToastId(): string {
  return `toast-${++toastId}`;
}

// ─── Toast surface ────────────────────────────────────────────────────────────

function isErrorVariant(variant: ToastVariant): boolean {
  return variant === 'error' || variant === 'destructive';
}

function ToastItem(props: {
  entry: ToastEntry;
  onDismiss: () => void;
}): Instance {
  const theme = useWidgetTheme();
  const variant = props.entry.variant ?? 'default';
  const role: SemanticsNode['role'] = isErrorVariant(variant) ? 'alert' : 'status';

  const variantBg = (): string => {
    switch (variant) {
      case 'success': return theme.colors.success;
      case 'error':
      case 'destructive': return theme.colors.danger;
      case 'warning': return theme.colors.warning;
      case 'info': return theme.colors.info;
      default: return theme.colors.surface;
    }
  };

  const isErrorOrDestructive = isErrorVariant(variant);
  const textColor = (isErrorOrDestructive || variant === 'success' || variant === 'info' || variant === 'warning')
    ? theme.colors.onPrimary
    : theme.colors.text;

  const titleText = Text({
    style: () => ({
      color: textColor,
      fontSize: theme.fontSizes.sm,
      fontWeight: theme.fontWeights.semibold,
    }),
    children: props.entry.title,
  });

  const closeSemantics: SemanticsNode = {
    role: 'button',
    label: 'Dismiss',
    focusable: true,
    onActivate: props.onDismiss,
  };

  const closeBtn = Box({
    style: () => ({
      width: 20,
      height: 20,
      alignX: 'center' as const,
      alignY: 'center' as const,
      cursor: 'pointer',
    }),
    focusable: true,
    onClick: props.onDismiss,
    children: Text({
      style: () => ({ color: textColor, fontSize: theme.fontSizes.sm }),
      children: '✕',
    }),
  });
  closeBtn.semantics = closeSemantics;

  const headerRow = Row({
    mainAxisSize: 'min',
    style: () => ({
      alignY: 'center' as const,
      gap: theme.spacing.sm,
    }),
    children: [titleText, closeBtn],
  });

  const contentChildren: Instance[] = [headerRow];

  if (props.entry.description) {
    contentChildren.push(
      Text({
        style: () => ({
          color: textColor,
          fontSize: theme.fontSizes.xs,
          opacity: 0.85,
        }),
        children: props.entry.description!,
      }),
    );
  }

  const surface = Box({
    style: () => ({
      backgroundColor: variantBg(),
      borderRadius: theme.radii.md,
      boxShadow: { color: 'rgba(0,0,0,0.16)', blur: 12, offsetX: 0, offsetY: 4 },
      padding: theme.spacing.md,
      minWidth: 240,
      border: { width: 1, color: theme.colors.border },
    }),
    children: Column({
      mainAxisSize: 'min',
      style: () => ({ gap: theme.spacing.xs }),
      children: contentChildren,
    }),
  });

  const surfaceSemantics: SemanticsNode = {
    role,
    label: props.entry.title,
    focusable: false,
  };
  surface.semantics = surfaceSemantics;

  return surface;
}

// ─── ToastProvider ────────────────────────────────────────────────────────────

export interface ToastProviderProps {
  placement?: ToastPlacement;
  children: () => Instance;
}

export function ToastProvider(props: ToastProviderProps): Instance {
  const overlays = useOverlays();
  const host = useHost();
  const theme = useWidgetTheme();
  const announce = useAnnounce();
  const placement: ToastPlacement = props.placement ?? 'bottom-right';

  const [queue, setQueue] = createSignal<ToastEntry[]>([]);

  const dismiss = (id: string): void => {
    setQueue((q) => q.filter((t) => t.id !== id));
  };

  const toast = (opts: ToastOptions): string => {
    const id = nextToastId();
    const duration = opts.duration ?? 4000;
    const variant = opts.variant ?? 'default';
    const assertive = isErrorVariant(variant);

    const entry: ToastEntry = {
      ...opts,
      id,
      duration,
      startTime: null,
    };

    setQueue((q) => [...q, entry]);

    // Announce immediately
    announce(opts.title, assertive);

    // Schedule auto-dismiss using the host scheduler
    let elapsed = 0;
    const tick = (timeMs: number): void => {
      if (elapsed === 0) {
        // First frame: record start (use timeMs as reference)
        elapsed = 1; // Mark started
        entry.startTime = timeMs;
        host.scheduler.requestFrame(tick);
      } else {
        const started = entry.startTime ?? timeMs;
        const delta = timeMs - started;
        if (delta >= duration) {
          dismiss(id);
        } else {
          host.scheduler.requestFrame(tick);
        }
      }
    };

    host.scheduler.requestFrame(tick);

    return id;
  };

  const ctx: ToastContextValue = { toast, dismiss };

  // Compute placement style for the stack container
  const stackStyle = (): StyleInput => {
    const base: Record<string, any> = {
      position: 'absolute' as any,
      gap: theme.spacing.sm,
    };
    const [vAlign, hAlign] = placement.split('-') as [string, string];
    if (vAlign === 'bottom') {
      base.bottom = theme.spacing.lg;
    } else {
      base.top = theme.spacing.lg;
    }
    if (hAlign === 'right') {
      base.right = theme.spacing.lg;
    } else if (hAlign === 'left') {
      base.left = theme.spacing.lg;
    } else {
      // center
      base.alignX = 'center' as const;
    }
    return () => base;
  };

  // Portal the toast stack only when there are toasts
  createEffect(() => {
    const entries = queue();
    if (entries.length === 0) return;

    const items = entries.map((entry) =>
      ToastItem({ entry, onDismiss: () => dismiss(entry.id) }),
    );

    Portal({
      children: Box({
        style: stackStyle(),
        children: Column({
          mainAxisSize: 'min',
          style: () => ({ gap: theme.spacing.sm }),
          children: items,
        }),
      }),
    });
  });

  // Render children inside the ToastProvider context
  return Provider({
    context: toastContext.context,
    value: ctx,
    children: props.children,
  }) as unknown as Instance;
}
