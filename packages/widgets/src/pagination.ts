import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, Row, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

export function paginationRange(page: number, count: number, siblingCount: number = 1): (number | '...')[] {
  // Always show all pages if count <= 2*siblingCount + 5 (first + last + siblings*2 + current + 2 ellipsis slots)
  const totalShown = 2 * siblingCount + 5;
  if (count <= totalShown) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  const left = Math.max(page - siblingCount, 2);
  const right = Math.min(page + siblingCount, count - 1);

  const hasLeftEllipsis = left > 2;
  const hasRightEllipsis = right < count - 1;

  const result: (number | '...')[] = [1];

  if (hasLeftEllipsis) {
    result.push('...');
  }

  for (let i = left; i <= right; i++) {
    result.push(i);
  }

  if (hasRightEllipsis) {
    result.push('...');
  }

  result.push(count);

  return result;
}

export interface PaginationProps extends LayoutChildProps {
  page: number; // 1-based
  count: number; // total pages
  onChange: (page: number) => void;
  siblingCount?: number; // default 1
  style?: StyleInput;
}

export function Pagination(props: PaginationProps): Instance {
  const t = useWidgetTheme();
  const { page, count, onChange, siblingCount = 1 } = props;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= count;

  const makePrevNext = (label: string, disabled: boolean, targetPage: number): Instance => {
    const { handlers } = createControl({
      disabled,
      onClick: () => { if (!disabled) onChange(targetPage); },
    });

    const btn = Box({
      style: () => ({
        paddingLeft: t.control.padX.sm,
        paddingRight: t.control.padX.sm,
        paddingTop: t.spacing.xs,
        paddingBottom: t.spacing.xs,
        borderRadius: t.radii.sm,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        backgroundColor: t.colors.surface,
      }),
      focusable: !disabled,
      ...(disabled ? {} : handlers),
      children: Text({ children: label }),
    });

    const sem: SemanticsNode = {
      role: 'button',
      label,
      disabled,
      onActivate: disabled ? undefined : () => onChange(targetPage),
    };
    btn.semantics = sem;
    return btn;
  };

  const makePageBtn = (p: number): Instance => {
    const isCurrent = p === page;
    const { handlers } = createControl({
      onClick: () => onChange(p),
    });

    const btn = Box({
      style: () => ({
        paddingLeft: t.control.padX.sm,
        paddingRight: t.control.padX.sm,
        paddingTop: t.spacing.xs,
        paddingBottom: t.spacing.xs,
        borderRadius: t.radii.sm,
        cursor: 'pointer',
        backgroundColor: isCurrent ? t.colors.primary : t.colors.surface,
      }),
      focusable: true,
      ...handlers,
      children: Text({ children: String(p) }),
    });

    const sem: SemanticsNode = {
      role: 'button',
      label: String(p),
      current: isCurrent ? 'page' : undefined,
      onActivate: () => onChange(p),
    };
    btn.semantics = sem;
    return btn;
  };

  const makeEllipsis = (): Instance => {
    const el = Text({ children: '…', style: (() => ({ paddingLeft: t.spacing.xs, paddingRight: t.spacing.xs })) as StyleInput });
    const sem: SemanticsNode = { role: 'separator' };
    el.semantics = sem;
    return el;
  };

  const range = paginationRange(page, count, siblingCount);

  const pageButtons = range.map((item) =>
    item === '...' ? makeEllipsis() : makePageBtn(item)
  );

  const prevBtn = makePrevNext('Prev', prevDisabled, page - 1);
  const nextBtn = makePrevNext('Next', nextDisabled, page + 1);

  const allChildren = [prevBtn, ...pageButtons, nextBtn];

  const container = Row({
    mainAxisSize: 'min',
    style: mergeStyles({ gap: t.spacing.xs, alignY: 'center' }, props.style),
    children: allChildren,
  });

  const navSem: SemanticsNode = { role: 'navigation', label: 'Pagination' };
  container.semantics = navSem;
  applyLayoutChildProps(container, props);
  return container;
}
