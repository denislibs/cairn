import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Column, Stack, Text, mergeStyles, type StyleInput } from '@cairn/primitives';
import {
  Tabs as HeadlessTabs,
  tabsContext,
  type TabsProps as HeadlessTabsProps,
  type TabsListProps as HeadlessTabsListProps,
  type TabProps as HeadlessTabProps,
  type TabsPanelProps as HeadlessTabsPanelProps,
  type TabsInstance,
} from '@cairn/widgets';
import { createEffect } from '@cairn/reactivity';
import { createRipple } from './ripple';
import { stateOverlay } from './state-layer';
import type { MaterialTheme } from './theme';

// ─── Re-exported types ────────────────────────────────────────────────────────

export type {
  TabsProps,
  TabsListProps,
  TabProps,
  TabsPanelProps,
  TabsInstance,
} from '@cairn/widgets';

// ─── Tabs (root) ─────────────────────────────────────────────────────────────
//
// The Material Tabs root simply delegates to the headless Tabs.  All roving,
// selection, controlled/uncontrolled state, and aria context live in there.
// We only add visual chrome here — primarily the active-tab indicator bar
// which is rendered *after* the List in a Column wrapper produced by Tabs.List.

function TabsRoot(props: HeadlessTabsProps): TabsInstance {
  return HeadlessTabs(props);
}

// ─── Tabs.List ────────────────────────────────────────────────────────────────
//
// Renders:
//   Column
//     ├── Box (wraps headless Tabs.List with bottom divider border)
//     └── Box (indicator bar, width = 1/count, positioned by active index)
//
// The indicator width equals (100% / count) and its left offset equals
// (activeIndex / count * 100%).  This is a simple, spring-free approach.

TabsRoot.List = function MaterialTabsList(props: HeadlessTabsListProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const ctx = tabsContext.use();

  // Build the headless list — this owns the tablist semantics and roving.
  const headlessList = HeadlessTabs.List(props);

  // Bottom border wrapping the tab row (divider colour).
  const listWithBorder = Box({
    style: {
      width: '100%' as any,
      borderBottom: { width: 1, color: t.palette.divider } as any,
    },
    children: headlessList,
  });

  // Active-tab indicator: a 2 px coloured Box whose width tracks 1/count of the
  // full row, positioned by index via a reactive style thunk.
  // Layout: the indicator width is (100% / count); offset is achieved by setting
  // the Box's own width reactively.  A simpler approach — chosen here — is to
  // use a percentage width on the Box and rely on the host measuring tabs equally.
  const indicatorStyle = (): object => {
    const count = ctx.count();
    const idx = ctx.activeIndex();
    const tabPct = count > 0 ? 100 / count : 100;
    const leftPct = count > 0 ? idx * tabPct : 0;
    return {
      height: 2,
      width: `${tabPct}%` as any,
      backgroundColor: t.palette.primary.main,
      // marginLeft positions the bar under the active tab.
      marginLeft: `${leftPct}%` as any,
    };
  };

  const indicatorBox = Box({ style: indicatorStyle });

  // Reactive: keep the layout node's width in sync with the style thunk so the
  // layout engine picks up the change each frame without a full rebuild.
  createEffect(() => {
    const count = ctx.count();
    const _idx = ctx.activeIndex();
    const tabPct = count > 0 ? 100 / count : 100;
    (indicatorBox.layout as any).width = `${tabPct}%`;
  });

  // Wrap in a Column: [list row with bottom border, indicator]. mainAxisSize:'min'
  // so the tab strip hugs its height instead of filling the available space.
  const column = Column({
    mainAxisSize: 'min',
    style: { width: '100%' as any },
    children: [listWithBorder, indicatorBox],
  });

  // Move the tablist semantics from the headless list to the column root — and
  // CLEAR it from the inner node so only ONE `tablist` a11y node is emitted
  // (otherwise both the column and the nested list would be collected).
  column.semantics = headlessList.semantics;
  headlessList.semantics = undefined;

  return column;
};

// ─── Tabs.Tab ─────────────────────────────────────────────────────────────────
//
// Wraps the headless Tab, adding:
//   • Uppercase typography.button label (string children → Text)
//   • primary.main text when selected, text.secondary otherwise
//   • Ripple + state-layer on hover/press

TabsRoot.Tab = function MaterialTab(props: HeadlessTabProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const typ = t.typography.button;

  const ripple = createRipple({ color: t.palette.primary.main, radius: 0, duration: 400 });

  // Resolve children: string → styled Text; function → call it; Instance → use as-is.
  const labelColor = (): string =>
    tabsContext.use().value() === props.value
      ? t.palette.primary.main
      : t.palette.text.secondary;

  let labelContent: Instance;
  if (typeof props.children === 'string') {
    labelContent = Text({
      style: () => ({
        color: labelColor(),
        fontSize: typ.fontSize,
        fontWeight: typ.fontWeight,
        letterSpacing: typ.letterSpacing,
        textTransform: typ.textTransform ?? 'uppercase',
      }),
      children: props.children as string,
    });
  } else if (typeof props.children === 'function') {
    labelContent = (props.children as () => Instance)();
  } else {
    labelContent = props.children as Instance;
  }

  const ctx = tabsContext.use();

  const tabStyle: StyleInput = () => ({
    padding: { left: 16, right: 16, top: 12, bottom: 12 },
    cursor: props.disabled ? 'default' : 'pointer',
    overflow: 'hidden' as const,
    hover: props.disabled ? undefined : {
      backgroundColor: stateOverlay(t.palette.primary.main, 'hover'),
    },
    pressed: props.disabled ? undefined : {
      backgroundColor: stateOverlay(t.palette.primary.main, 'pressed'),
    },
  });

  const content = Stack({
    children: [labelContent, ripple.instance],
  });

  // Delegate to headless Tab — it owns roving, semantics, keyboard, click.
  const headlessProps: HeadlessTabProps = {
    ...props,
    children: content,
    style: mergeStyles(tabStyle, props.style),
  };

  const inst = HeadlessTabs.Tab(headlessProps);

  // Wrap the existing onPointerDown (if any) to add ripple triggering.
  // We must not call onPointerDown directly on HeadlessTabProps since TabProps
  // doesn't declare it — instead we patch the returned instance's handlers.
  const existingPointerDown = inst.handlers?.onPointerDown;
  if (inst.handlers) {
    inst.handlers.onPointerDown = (e: any) => {
      if (!props.disabled) ripple.trigger(e.localX ?? 0, e.localY ?? 0);
      existingPointerDown?.(e);
    };
  }

  return inst;
};

// ─── Tabs.Panel ───────────────────────────────────────────────────────────────
//
// Pure pass-through — no visual changes needed; tabpanel semantics live in
// the headless Panel.

TabsRoot.Panel = function MaterialTabsPanel(props: HeadlessTabsPanelProps): Instance {
  return HeadlessTabs.Panel(props);
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const Tabs = TabsRoot;
