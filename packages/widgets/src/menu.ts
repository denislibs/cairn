import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useOverlays, hostContext, Provider } from '@cairn/runtime';
import { createSignal, createEffect, useContext, type Accessor } from '@cairn/reactivity';
import { Box, Stack, Column, Row, Text, Portal, computePlacement, getAbsRect, mergeStyles, type StyleInput, type Side } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { createRoving } from './native/roving';
import { createTypeahead } from './native/typeahead';
import { ESCAPE } from './native/keys';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface MenuContextValue {
  close: () => void;
  active: Accessor<number>;
  setActive: (i: number) => void;
  /** Register an item; returns its index. */
  register: (item: MenuItemRecord) => number;
  /** Handle arrow/Home/End key for roving. Returns true if consumed. */
  handleRovingKey: (key: string) => boolean;
  /** Handle a printable char for typeahead. Returns true if matched. */
  handleTypeaheadChar: (ch: string) => boolean;
}

export interface MenuItemRecord {
  disabled: boolean;
  label?: string;
}

export const menuContext = createCompoundContext<MenuContextValue>('Menu');

function safeViewport(): { w: number; h: number } {
  try {
    const host = useContext(hostContext);
    if (host) return { w: host.metrics.width, h: host.metrics.height };
  } catch {
    // not mounted
  }
  return { w: 0, h: 0 };
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuProps {
  /** The trigger element — returned inline as the root of Menu. */
  trigger: Instance;
  /** A thunk that renders menu items inside Menu context. */
  children: () => Instance;
  side?: Side;
  align?: 'start' | 'center' | 'end';
  offset?: number;
  open?: boolean | Accessor<boolean>;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: StyleInput;
}

export function Menu(props: MenuProps): Instance {
  const trigger = props.trigger;
  const side = props.side ?? 'bottom';
  const align = props.align ?? 'start';
  const offset = props.offset ?? 4;
  const overlays = useOverlays();
  const theme = useWidgetTheme();

  // Controlled / uncontrolled
  const isControlled = props.open !== undefined;
  const resolveOpen = (): boolean =>
    typeof props.open === 'function'
      ? (props.open as Accessor<boolean>)()
      : (props.open as boolean) ?? false;

  const [internalOpen, setInternalOpen] = createSignal(props.defaultOpen ?? false);
  const open = (): boolean => (isControlled ? resolveOpen() : internalOpen());

  const toggle = (): void => {
    const next = !open();
    if (isControlled) {
      props.onOpenChange?.(next);
    } else {
      setInternalOpen(next);
      props.onOpenChange?.(next);
    }
  };

  const close = (): void => {
    if (isControlled) {
      props.onOpenChange?.(false);
    } else {
      setInternalOpen(false);
      props.onOpenChange?.(false);
    }
  };

  // Registered items
  const items: MenuItemRecord[] = [];
  const itemLabels: string[] = [];

  const [itemCount, setItemCount] = createSignal(0);

  // Roving: use createRoving toolkit
  const roving = createRoving({ count: itemCount, orientation: 'vertical', loop: true });

  // Typeahead for items
  const typeahead = createTypeahead({
    getLabels: () => itemLabels,
    onMatch: (idx) => { roving.setActive(idx); },
  });

  const register = (item: MenuItemRecord): number => {
    items.push(item);
    itemLabels.push(item.label ?? '');
    setItemCount(items.length);
    return items.length - 1;
  };

  const ctx: MenuContextValue = {
    close,
    active: roving.active,
    setActive: roving.setActive,
    register,
    handleRovingKey: roving.handleKey,
    handleTypeaheadChar: typeahead.handleChar,
  };

  // Keep trigger expanded semantics in sync
  createEffect(() => {
    const sem = (trigger as any).semantics as SemanticsNode | undefined;
    if (sem) sem.expanded = open();
  });

  // Chain existing onClick on trigger
  const prevClick = trigger.handlers?.onClick;
  trigger.handlers ??= {};
  trigger.handlers.onClick = (e) => {
    prevClick?.(e);
    toggle();
  };

  const portalContent = (): Instance => {
    const appRoot = overlays.appRoot();
    const anchor = appRoot
      ? (getAbsRect(trigger, appRoot) ?? { x: 0, y: 0, width: 0, height: 0 })
      : { x: 0, y: 0, width: 0, height: 0 };
    const vp = safeViewport();
    const estimatedSize = { width: 160, height: 120 };
    const { x, y } = computePlacement(anchor, estimatedSize, vp, { side, align, offset, flip: true });

    // Full-surface transparent catcher — closes on outside click or Escape
    const catcher = Box({
      style: { width: '100%', height: '100%' },
      focusable: true,
      onClick: (e) => {
        e.stopPropagation?.();
        close();
      },
      onKeyDown: (e) => {
        if (e.key === 'Escape') close();
      },
    });

    // Themed surface
    const surfaceStyle: StyleInput = () => ({
      backgroundColor: theme.colors.surface,
      border: { width: 1, color: theme.colors.borderStrong },
      borderRadius: theme.radii.md,
      boxShadow: { color: 'rgba(0,0,0,0.12)', blur: 12, offsetX: 0, offsetY: 4 },
      padding: theme.spacing.xs,
    });

    // Build menu items inside context
    const itemsContent = Provider({
      context: menuContext.context,
      value: ctx,
      children: props.children,
    });

    const itemsList = Column({
      mainAxisSize: 'min',
      children: [itemsContent],
    });

    const contentBox = Box({
      left: x,
      top: y,
      style: mergeStyles(surfaceStyle, props.style),
      children: itemsList,
      onClick: (e) => { e.stopPropagation?.(); },
    });

    return Portal({
      children: Stack({
        children: [catcher, contentBox],
      }),
    });
  };

  createEffect(() => {
    if (open()) portalContent();
  });

  trigger.debugName = 'Menu';
  return trigger;
}

// ─── MenuItem ─────────────────────────────────────────────────────────────────

export interface MenuItemProps {
  onSelect?: () => void;
  disabled?: boolean;
  label?: string;
  children?: Instance;
  style?: StyleInput;
}

export function MenuItem(props: MenuItemProps): Instance {
  const theme = useWidgetTheme();
  const ctx = menuContext.use();

  const myIndex = ctx.register({ disabled: !!props.disabled, label: props.label ?? '' });

  const isDisabled = !!props.disabled;

  const isActive = (): boolean => ctx.active() === myIndex;

  const select = (): void => {
    if (isDisabled) return;
    props.onSelect?.();
    ctx.close();
  };

  const handleKeyDown = (e: any): void => {
    if (e.key === 'Enter') {
      e.preventDefault?.();
      if (!isDisabled) select();
    } else if (e.key === ESCAPE) {
      e.preventDefault?.();
      ctx.close();
    } else if (ctx.handleRovingKey(e.key)) {
      e.preventDefault?.();
    } else if (e.key.length === 1) {
      ctx.handleTypeaheadChar(e.key);
    }
  };

  const rowStyle: StyleInput = () => ({
    paddingLeft: theme.control.padX.sm,
    paddingRight: theme.control.padX.sm,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: isActive()
      ? theme.colors.surfaceAlt
      : 'transparent',
    cursor: isDisabled ? 'default' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
  });

  const content = props.children ?? Text({
    style: () => ({
      color: isDisabled ? theme.colors.textDisabled : theme.colors.text,
      fontSize: theme.fontSizes.sm,
    }),
    children: props.label ?? '',
  });

  const instance = Row({
    mainAxisSize: 'min',
    focusable: !isDisabled,
    style: mergeStyles(rowStyle, props.style),
    onClick: (e) => {
      e.stopPropagation?.();
      select();
    },
    onPointerEnter: () => {
      if (!isDisabled) ctx.setActive(myIndex);
    },
    onKeyDown: handleKeyDown,
    children: [content],
  });

  // ── Semantics ──
  const itemSemantics: SemanticsNode = {
    role: 'menuitem',
    label: props.label,
    disabled: isDisabled,
    focusable: isActive(),
    autoFocus: isActive(),
    onActivate: isDisabled ? undefined : select,
    onKeyDown: (key, _mods) => {
      if (key === ESCAPE) { ctx.close(); return true; }
      if (ctx.handleRovingKey(key)) return true;
      if (key.length === 1) return ctx.handleTypeaheadChar(key);
      return false;
    },
  };

  instance.semantics = itemSemantics;

  // Keep focusable/autoFocus reactive
  createEffect(() => {
    itemSemantics.focusable = isActive();
    itemSemantics.autoFocus = isActive();
  });

  instance.debugName = 'MenuItem';
  return instance;
}
