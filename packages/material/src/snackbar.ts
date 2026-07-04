import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useHost, Provider } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { createSignal, createEffect } from '@cairn/reactivity';
import { Box, Row, Column, Text, Portal } from '@cairn/primitives';
import {
  toastContext,
  useToast,
  type ToastOptions,
  type ToastContextValue,
  type ToastPlacement,
} from '@cairn/widgets';
import { useAnnounce } from '@cairn/widgets';
import { Button } from './button';
import type { MaterialTheme } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SnackbarOptions extends ToastOptions {
  /** Label for the optional action button (e.g. "UNDO", "RETRY"). */
  actionLabel?: string;
  /** Callback invoked when the action button is clicked. */
  onAction?: () => void;
}

interface SnackbarEntry extends SnackbarOptions {
  id: string;
  startTime: number | null;
}

// ─── useSnackbar ──────────────────────────────────────────────────────────────

/**
 * Thin wrapper over `useToast` — returns the same `{ toast, dismiss }` context.
 * Must be called inside a `SnackbarProvider`.
 */
export function useSnackbar(): ToastContextValue {
  return useToast();
}

// ─── SnackbarItem ─────────────────────────────────────────────────────────────

export interface SnackbarItemProps {
  entry: SnackbarEntry;
  onDismiss: () => void;
}

/**
 * Renders the Material snackbar surface:
 * - Dark #323232 Box, shape.borderRadius, padding {left:16,right:8,top:8,bottom:8}
 * - body2 white text for the title (and optional description)
 * - Optional Material text Button in secondary color for the action
 * - min-height 48
 * - role 'status' (or 'alert' for error/destructive variants)
 */
export function SnackbarItem(props: SnackbarItemProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const { entry, onDismiss } = props;

  const isError = entry.variant === 'error' || entry.variant === 'destructive';
  const role: SemanticsNode['role'] = isError ? 'alert' : 'status';

  const body2 = t.typography.body2;

  // Title text — body2, white
  const titleText = Text({
    style: {
      color: '#ffffff',
      fontSize: body2.fontSize,
      fontWeight: body2.fontWeight,
      letterSpacing: body2.letterSpacing,
    },
    children: entry.title,
  });

  // Right-side children: optional action button + the message content occupies the left
  const rightChildren: Instance[] = [];

  if (entry.actionLabel) {
    const actionBtn = Button({
      variant: 'text',
      color: 'secondary',
      label: entry.actionLabel,
      onClick: () => {
        entry.onAction?.();
        onDismiss();
      },
    });
    rightChildren.push(actionBtn);
  }

  // Build content column: title + optional description
  const contentChildren: Instance[] = [titleText];

  if (entry.description) {
    const descText = Text({
      style: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: body2.fontSize,
        fontWeight: body2.fontWeight,
        letterSpacing: body2.letterSpacing,
      },
      children: entry.description,
    });
    contentChildren.push(descText);
  }

  const contentCol = Column({
    mainAxisSize: 'min',
    style: { gap: 2 },
    children: contentChildren,
  });

  // Row: [content column (flex), ...action buttons]
  const rowChildren: Instance[] = [contentCol, ...rightChildren];

  const innerRow = Row({
    mainAxisSize: 'max',
    style: {
      alignY: 'center',
      gap: 8,
    },
    children: rowChildren,
  });

  const surface = Box({
    style: {
      backgroundColor: '#323232',
      borderRadius: t.shape.borderRadius,
      padding: { left: 16, right: 8, top: 8, bottom: 8 },
      minHeight: 48,
      minWidth: 288,
    },
    children: innerRow,
  });

  const surfaceSemantics: SemanticsNode = {
    role,
    label: entry.title,
    focusable: false,
  };
  surface.semantics = surfaceSemantics;

  return surface;
}

// ─── SnackbarProvider ─────────────────────────────────────────────────────────

export interface SnackbarProviderProps {
  placement?: ToastPlacement;
  children: () => Instance;
}

/** ID counter for snackbars. */
let snackbarId = 0;
function nextSnackbarId(): string {
  return `snackbar-${++snackbarId}`;
}

/**
 * Material Snackbar provider.
 *
 * Provides the headless `toastContext` (same context as `ToastProvider`) so any
 * call to `useSnackbar()` or `useToast()` in the subtree receives the same
 * `{ toast, dismiss }` API. Replaces the headless `ToastItem` with a
 * Material-styled `SnackbarItem` surface. Placement, timeout, and aria-live
 * semantics are preserved from the headless implementation.
 */
export function SnackbarProvider(props: SnackbarProviderProps): Instance {
  const host = useHost();
  const announce = useAnnounce();
  const placement: ToastPlacement = props.placement ?? 'bottom-right';

  const [queue, setQueue] = createSignal<SnackbarEntry[]>([]);

  const dismiss = (id: string): void => {
    setQueue((q) => q.filter((s) => s.id !== id));
  };

  const toast = (opts: ToastOptions): string => {
    const id = nextSnackbarId();
    const duration = opts.duration ?? 4000;
    const variant = opts.variant ?? 'default';
    const assertive = variant === 'error' || variant === 'destructive';

    const entry: SnackbarEntry = {
      ...opts,
      id,
      duration,
      startTime: null,
    };

    setQueue((q) => [...q, entry]);

    // Announce to screen readers — keep same behaviour as headless toast.
    announce(opts.title, assertive);

    // Auto-dismiss via host scheduler (mirrors headless ToastProvider).
    let elapsed = 0;
    const tick = (timeMs: number): void => {
      if (elapsed === 0) {
        elapsed = 1;
        entry.startTime = timeMs;
        host.scheduler.requestFrame(tick);
      } else {
        const started = entry.startTime ?? timeMs;
        if (timeMs - started >= duration) {
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

  // Build placement style for the stack container.
  const stackStyle = (): Record<string, any> => {
    const base: Record<string, any> = {
      position: 'absolute' as any,
      gap: 8,
    };
    const [vAlign, hAlign] = placement.split('-') as [string, string];
    if (vAlign === 'bottom') {
      base.bottom = 24;
    } else {
      base.top = 24;
    }
    if (hAlign === 'right') {
      base.right = 24;
    } else if (hAlign === 'left') {
      base.left = 24;
    } else {
      base.alignX = 'center' as const;
    }
    return base;
  };

  // Portal the snackbar stack whenever there are items in the queue.
  createEffect(() => {
    const entries = queue();
    if (entries.length === 0) return;

    const items = entries.map((entry) =>
      SnackbarItem({ entry, onDismiss: () => dismiss(entry.id) }),
    );

    Portal({
      children: Box({
        style: stackStyle(),
        children: Column({
          mainAxisSize: 'min',
          style: { gap: 8 },
          children: items,
        }),
      }),
    });
  });

  // Render children inside the shared toastContext — `useSnackbar` / `useToast` both work.
  return Provider({
    context: toastContext.context,
    value: ctx,
    children: props.children,
  }) as unknown as Instance;
}
