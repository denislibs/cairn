import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Provider } from '@cairn/runtime';
import { Box, Row, Column, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ListContextValue {
  /** reserved for future selection support */
  ordered: boolean;
}

export const listContext = createCompoundContext<ListContextValue>('List');

// ---------------------------------------------------------------------------
// List (root) — exported interface that carries _ctx
// ---------------------------------------------------------------------------

export interface ListInstance extends Instance {
  _ctx: ListContextValue;
}

export interface ListProps extends LayoutChildProps {
  /** thunk — Cairn compound pattern; called inside the context Provider */
  children: () => Instance;
  /** Semantic hint: ordered list (ol) vs unordered (ul). Default false. */
  ordered?: boolean;
  style?: StyleInput;
}

export interface ListItemProps extends LayoutChildProps {
  /** Main content — Instance or a string (auto-wrapped in Text) */
  children: Instance | string;
  /** Optional leading slot (icon, avatar, …) */
  leading?: Instance;
  /** Optional trailing slot (badge, chevron, …) */
  trailing?: Instance;
  /** When provided the item is interactive: focusable + Enter/Space activate */
  onClick?: () => void;
  /** Blocks activation when true */
  disabled?: boolean;
  style?: StyleInput;
}

// ---------------------------------------------------------------------------
// List root
// ---------------------------------------------------------------------------

export function List(props: ListProps): ListInstance {
  const t = useWidgetTheme();
  const ordered = props.ordered ?? false;

  const ctx: ListContextValue = { ordered };

  const content = Provider({
    context: listContext.context,
    value: ctx,
    children: props.children,
  });

  const container = Column({
    mainAxisSize: 'min',
    style: mergeStyles({}, props.style),
    children: [content],
  });

  const sem: SemanticsNode = { role: 'list' };
  container.semantics = sem;

  applyLayoutChildProps(container, props);

  const instance: ListInstance = {
    layout: container.layout,
    children: container.children,
    paintSelf: container.paintSelf,
    focusable: container.focusable,
    handlers: container.handlers,
    semantics: container.semantics,
    _ctx: ctx,
  };

  return instance;
}

// ---------------------------------------------------------------------------
// List.Item
// ---------------------------------------------------------------------------

List.Item = function ListItem(props: ListItemProps): Instance {
  const t = useWidgetTheme();

  const isDisabled = !!props.disabled;
  const isClickable = !!props.onClick;

  // Resolve children: string → Text; also capture label for semantics
  const labelText = typeof props.children === 'string' ? props.children : undefined;
  const contentChild: Instance =
    typeof props.children === 'string'
      ? Text({ children: props.children })
      : props.children;

  // Build the row children array: [leading?, content, trailing?]
  const rowChildren: Instance[] = [];
  if (props.leading) rowChildren.push(props.leading);
  rowChildren.push(contentChild);
  if (props.trailing) rowChildren.push(props.trailing);

  // Base item style — use function form to satisfy StyleInput typing
  const baseStyle: StyleInput = () => ({
    padding: { left: t.spacing.sm, right: t.spacing.sm, top: t.spacing.xs, bottom: t.spacing.xs },
    cursor: isClickable && !isDisabled ? 'pointer' : 'default',
    opacity: isDisabled ? 0.5 : 1,
  });

  const composedStyle = mergeStyles(baseStyle, props.style);

  if (isClickable) {
    const { handlers, setFocusVisible } = createControl({
      disabled: isDisabled,
      onClick: props.onClick,
    });

    const instance = Row({
      mainAxisSize: 'min',
      style: composedStyle,
      focusable: !isDisabled,
      ...handlers,
      children: rowChildren,
    });

    const sem: SemanticsNode = {
      role: 'listitem',
      label: labelText,
      disabled: isDisabled,
      focusable: !isDisabled,
      onActivate: isDisabled ? undefined : () => props.onClick?.(),
      onFocus: (kb: boolean) => setFocusVisible(kb),
      onBlur: () => setFocusVisible(false),
    };

    instance.semantics = sem;
    applyLayoutChildProps(instance, props);
    return instance;
  }

  // Non-clickable path
  const instance = Row({
    mainAxisSize: 'min',
    style: composedStyle,
    children: rowChildren,
  });

  const sem: SemanticsNode = {
    role: 'listitem',
    label: labelText,
  };

  instance.semantics = sem;
  applyLayoutChildProps(instance, props);
  return instance;
};
