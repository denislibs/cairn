import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Row, Text, mergeStyles } from '@cairn/primitives';
import type { StyleInput } from '@cairn/primitives';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

export type AppBarColor = MaterialColor | 'default' | 'transparent';

export interface AppBarProps {
  children?: Instance | Instance[];
  color?: AppBarColor;
  elevation?: number;
  style?: StyleInput;
}

export interface AppBarTitleProps {
  children?: string;
  color?: string;
}

function resolveBackgroundColor(t: MaterialTheme, color: AppBarColor): string {
  if (color === 'default') return t.palette.background.paper;
  if (color === 'transparent') return 'transparent';
  return t.palette[color].main;
}

function resolveContentColor(t: MaterialTheme, color: AppBarColor): string {
  if (color === 'default') return t.palette.text.primary;
  if (color === 'transparent') return t.palette.text.primary;
  return t.palette[color].contrastText;
}

function AppBarTitle(props: AppBarTitleProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const typ = t.typography.h6;
  const color = props.color ?? t.palette.primary.contrastText;

  return Text({
    children: props.children ?? '',
    style: {
      color,
      fontSize: typ.fontSize,
      fontWeight: typ.fontWeight,
      lineHeight: typ.lineHeight,
      letterSpacing: typ.letterSpacing,
    },
  });
}

export function AppBar(props: AppBarProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const color: AppBarColor = props.color ?? 'primary';
  const elevationLevel = Math.min(Math.max(0, props.elevation ?? 4), 24);

  const bgColor = resolveBackgroundColor(t, color);
  const boxShadow = t.elevation[elevationLevel];

  // Normalize children: strings become Text nodes; undefined → empty array
  const rawChildren = props.children;
  const childrenArray: Instance[] =
    rawChildren == null
      ? []
      : Array.isArray(rawChildren)
        ? rawChildren
        : typeof rawChildren === 'string'
          ? [Text({ children: rawChildren, style: { color: resolveContentColor(t, color) } })]
          : [rawChildren];

  const row = Row({
    children: childrenArray,
    mainAxisSize: 'max',
    style: {
      gap: 8,
      alignY: 'center',
      height: '100%' as any,
    },
  });

  const barStyle: StyleInput = mergeStyles(
    {
      backgroundColor: bgColor,
      boxShadow,
      height: 56,
      padding: { left: 16, right: 16, top: 0, bottom: 0 },
      width: '100%' as any,
    },
    props.style,
  );

  const inst = Box({
    style: barStyle,
    children: row,
  });

  inst.semantics = { role: 'navigation', label: 'App bar' };

  return inst;
}

// Static sub-component
AppBar.Title = AppBarTitle;
