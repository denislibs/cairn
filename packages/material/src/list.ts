import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Row, Text, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import {
  List as HeadlessList,
  listContext,
  type ListProps as HeadlessListProps,
  type ListItemProps as HeadlessListItemProps,
  type ListInstance,
} from '@cairn/widgets';
import type { MaterialTheme } from './theme';

// ---------------------------------------------------------------------------
// Re-export listContext so callers can set up context in tests / embedding
// ---------------------------------------------------------------------------
export { listContext };

// ---------------------------------------------------------------------------
// Prop interfaces
// ---------------------------------------------------------------------------

export interface ListProps extends LayoutChildProps {
  children: () => Instance;
  /** Dense mode: reduces item height from 48 to 40. */
  dense?: boolean;
  style?: StyleInput;
}

export interface ListItemProps extends LayoutChildProps {
  children: Instance | string;
  leading?: Instance;
  trailing?: Instance;
  onClick?: () => void;
  disabled?: boolean;
  /** Selected state: applies action.selected background */
  selected?: boolean;
  /** Dense mode: reduces min-height to 40 (defaults to parent List dense when passed). */
  dense?: boolean;
  style?: StyleInput;
}

// ---------------------------------------------------------------------------
// Material List (root)
// ---------------------------------------------------------------------------

export interface MaterialListInstance extends ListInstance {
  _ctx: ReturnType<typeof listContext.context extends infer C ? any : any>;
}

export function List(props: ListProps): ListInstance {
  // Pass through to headless — it owns all semantics (role:"list") + context
  const headlessProps: HeadlessListProps = {
    children: props.children,
    style: props.style,
    // spread LayoutChildProps
    ...(props.flex !== undefined ? { flex: props.flex } : {}),
    ...(props.alignSelf !== undefined ? { alignSelf: props.alignSelf } : {}),
  };
  return HeadlessList(headlessProps);
}

// ---------------------------------------------------------------------------
// Material List.Item
// ---------------------------------------------------------------------------

List.Item = function MaterialListItem(props: ListItemProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;

  const isSelected = !!props.selected;
  const isDense = !!props.dense;
  const minHeight = isDense ? 40 : 48;

  // Resolve background: selected wins over default, hover applied via headless hover style
  const bgColor = isSelected ? t.palette.action.selected : 'transparent';

  // Material body1 text style for string children
  const body1 = t.typography.body1;
  const textColor = t.palette.text.primary;

  // Resolve children: wrap string in styled Text
  const contentChild: Instance =
    typeof props.children === 'string'
      ? Text({
          style: {
            color: textColor,
            fontSize: body1.fontSize,
            fontWeight: body1.fontWeight,
            lineHeight: body1.lineHeight,
            letterSpacing: body1.letterSpacing,
          },
          children: props.children,
        })
      : props.children;

  // Build headless List.Item — it owns role:"listitem", click, keyboard, disabled, semantics
  // We pass a Box-wrapped version as the children to get Material surface (selected bg, hover)
  const isDisabled = !!props.disabled;
  const isClickable = !!props.onClick;

  // Build the row content: [leading?, content, trailing?]
  const rowChildren: Instance[] = [];
  if (props.leading) rowChildren.push(props.leading);
  rowChildren.push(contentChild);
  if (props.trailing) rowChildren.push(props.trailing);

  // The painted surface: Box handles backgroundColor (selected/default), min-height
  const surfaceStyle: StyleInput = () => ({
    backgroundColor: bgColor,
    minHeight,
    alignY: 'center' as const,
    hover: isClickable && !isDisabled
      ? { backgroundColor: isSelected
          ? t.palette.action.selected
          : t.palette.action.hover }
      : undefined,
  });

  // Row for the inner layout
  const rowStyle: StyleInput = {
    padding: { left: 16, right: 16, top: 0, bottom: 0 },
    gap: 16,
    alignY: 'center' as const,
    minHeight,
  };

  const rowInner = Row({
    mainAxisSize: 'min',
    style: rowStyle,
    children: rowChildren,
  });

  const surface = Box({
    style: mergeStyles(surfaceStyle, props.style),
    children: rowInner,
  });

  // Delegate ALL behavior + semantics to the headless List.Item by passing our
  // surface as its children. Headless sets role:"listitem", focusable, handlers,
  // semantics.onActivate, semantics.disabled — we never duplicate any of that.
  const headlessProps: HeadlessListItemProps = {
    children: surface,
    onClick: props.onClick,
    disabled: props.disabled,
    // leading/trailing already baked into surface row — don't pass again
    ...(props.flex !== undefined ? { flex: props.flex } : {}),
    ...(props.alignSelf !== undefined ? { alignSelf: props.alignSelf } : {}),
  };

  const inst = HeadlessList.Item(headlessProps);

  // When children was a string, headless would normally derive semantics.label from it,
  // but we converted it to a Text instance before handing it to headless. Restore the label.
  if (typeof props.children === 'string' && inst.semantics) {
    inst.semantics.label = props.children;
  }

  return inst;
};
