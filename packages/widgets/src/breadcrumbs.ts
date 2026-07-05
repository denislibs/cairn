import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, Row, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps extends LayoutChildProps {
  items: BreadcrumbItem[];
  separator?: string;
  style?: StyleInput;
}

export function Breadcrumbs(props: BreadcrumbsProps): Instance {
  const t = useWidgetTheme();
  const separator = props.separator ?? '/';
  const items = props.items;

  const allChildren: Instance[] = [];

  items.forEach((item, i) => {
    const isLast = i === items.length - 1;

    if (isLast) {
      // Last item — current page, not a link
      const textNode = Text({
        children: item.label,
        style: () => ({
          fontSize: t.fontSizes.sm,
          color: t.colors.text,
          fontWeight: t.fontWeights.medium,
        }),
      });

      const sem: SemanticsNode = {
        role: 'none',
        label: item.label,
        current: 'page',
      };
      textNode.semantics = sem;
      allChildren.push(textNode);
    } else {
      const { handlers } = createControl({
        onClick: () => item.onClick?.(),
      });

      const linkNode = Text({
        children: item.label,
        style: () => ({
          fontSize: t.fontSizes.sm,
          color: t.colors.primary,
          cursor: item.onClick ? 'pointer' : 'default',
        }),
        focusable: !!item.onClick,
        ...handlers,
      });

      const sem: SemanticsNode = {
        role: 'link',
        label: item.label,
        onActivate: item.onClick,
      };
      linkNode.semantics = sem;
      allChildren.push(linkNode);

      // Separator (not last)
      const sepNode = Text({
        children: separator,
        style: () => ({
          fontSize: t.fontSizes.sm,
          color: t.colors.textMuted,
          paddingLeft: t.spacing.xs,
          paddingRight: t.spacing.xs,
        }),
      });
      const sepSem: SemanticsNode = { role: 'separator' };
      sepNode.semantics = sepSem;
      allChildren.push(sepNode);
    }
  });

  const container = Row({
    mainAxisSize: 'min',
    style: mergeStyles({ gap: 0, alignY: 'center' }, props.style),
    children: allChildren,
  });

  const navSem: SemanticsNode = { role: 'navigation', label: 'Breadcrumb' };
  container.semantics = navSem;
  applyLayoutChildProps(container, props);
  container.debugName = 'Breadcrumbs';
  return container;
}
