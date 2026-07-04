import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Provider, Show } from '@cairn/runtime';
import { createSignal, createEffect, type Accessor } from '@cairn/reactivity';
import { Box, Row, Column, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { createControl } from './control';
import { createRoving } from './native/roving';
import { ARROW_LEFT, ARROW_RIGHT, ARROW_UP, ARROW_DOWN, ENTER, SPACE } from './native/keys';

export interface TabsContextValue {
  value: Accessor<any>;
  setValue: (v: any) => void;
  orientation: 'horizontal' | 'vertical';
  activation: 'automatic' | 'manual';
  register: (v: any) => number; // returns index
  activeIndex: Accessor<number>;
  setActiveIndex: (i: number) => void;
  count: Accessor<number>;
}

export const tabsContext = createCompoundContext<TabsContextValue>('Tabs');

export interface TabsProps extends LayoutChildProps {
  value?: any | Accessor<any>;
  defaultValue?: any;
  onChange?: (v: any) => void;
  orientation?: 'horizontal' | 'vertical';
  activation?: 'automatic' | 'manual';
  children: () => Instance;
  style?: StyleInput;
}

export interface TabsInstance extends Instance {
  _ctx: TabsContextValue;
}

export function Tabs(props: TabsProps): TabsInstance {
  const t = useWidgetTheme();
  const orientation = props.orientation ?? 'horizontal';
  const activation = props.activation ?? 'automatic';

  const controlled = props.value !== undefined;
  const [internal, setInternal] = createSignal(props.defaultValue ?? null);
  const readValue: Accessor<any> = () => {
    if (controlled) {
      const v = props.value;
      return typeof v === 'function' ? (v as Accessor<any>)() : v;
    }
    return internal();
  };
  const setValue = (v: any) => {
    if (!controlled) setInternal(v);
    props.onChange?.(v);
  };

  const registered: any[] = [];
  const [count, setCount] = createSignal(0);

  const roving = createRoving({
    count,
    orientation: orientation === 'horizontal' ? 'horizontal' : 'vertical',
    loop: false,
    initial: 0,
  });

  const register = (v: any): number => {
    if (!registered.includes(v)) {
      registered.push(v);
      setCount(registered.length);
      const idx = registered.indexOf(v);
      if (readValue() === v) roving.setActive(idx);
    }
    return registered.indexOf(v);
  };

  const ctx: TabsContextValue = {
    value: readValue,
    setValue,
    orientation,
    activation,
    register,
    activeIndex: roving.active,
    setActiveIndex: roving.setActive,
    count,
  };

  // Store roving.handleKey and registered list on ctx for Tab component access
  (ctx as any)._handleKey = roving.handleKey;
  (ctx as any)._registered = registered;

  const content = Provider({
    context: tabsContext.context,
    value: ctx,
    children: props.children,
  });

  const instance: TabsInstance = {
    layout: content.layout,
    children: content.children,
    paintSelf: content.paintSelf,
    focusable: content.focusable,
    handlers: content.handlers,
    _ctx: ctx,
  };

  applyLayoutChildProps(instance, props);
  return instance;
}

export interface TabsListProps extends LayoutChildProps {
  children: () => Instance;
  style?: StyleInput;
}

export interface TabProps extends LayoutChildProps {
  value: any;
  disabled?: boolean;
  children: Instance | string | (() => Instance);
  style?: StyleInput;
}

export interface TabsPanelProps extends LayoutChildProps {
  value: any;
  children: Instance | (() => Instance);
  style?: StyleInput;
}

Tabs.List = function TabsList(props: TabsListProps): Instance {
  const t = useWidgetTheme();
  const ctx = tabsContext.use();

  const innerContent = Provider({
    context: tabsContext.context,
    value: ctx,
    children: props.children,
  });

  const container = ctx.orientation === 'horizontal'
    ? Row({ mainAxisSize: 'min', style: mergeStyles({ gap: t.spacing.xs }, props.style), children: [innerContent] })
    : Column({ mainAxisSize: 'min', style: mergeStyles({ gap: t.spacing.xs }, props.style), children: [innerContent] });

  const sem: SemanticsNode = { role: 'tablist' };
  container.semantics = sem;
  applyLayoutChildProps(container, props);
  return container;
};

Tabs.Tab = function Tab(props: TabProps): Instance {
  const t = useWidgetTheme();
  const ctx = tabsContext.use();
  const myIndex = ctx.register(props.value);
  const isSelected = () => ctx.value() === props.value;
  const isActive = () => ctx.activeIndex() === myIndex;
  const isDisabled = !!props.disabled;

  const handleKey = (key: string): boolean => {
    const hk = (ctx as any)._handleKey as (k: string) => boolean;
    const handled = hk(key);
    if (handled && ctx.activation === 'automatic') {
      const reg = (ctx as any)._registered as any[];
      const idx = ctx.activeIndex();
      if (idx >= 0 && idx < reg.length) ctx.setValue(reg[idx]);
    }
    if ((key === ENTER || key === SPACE) && !isDisabled) {
      ctx.setValue(props.value);
      return true;
    }
    return handled;
  };

  const { handlers, setFocusVisible } = createControl({
    disabled: isDisabled,
    onClick: () => { if (!isDisabled) ctx.setValue(props.value); },
  });

  const tabStyle: StyleInput = () => ({
    paddingLeft: t.control.padX.sm,
    paddingRight: t.control.padX.sm,
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.xs,
    borderRadius: t.radii.sm,
    cursor: isDisabled ? 'default' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    backgroundColor: isSelected() ? t.colors.surface : 'transparent',
  });

  const labelText = typeof props.children === 'string' ? props.children : undefined;
  const child: Instance = typeof props.children === 'string'
    ? Text({ children: props.children })
    : typeof props.children === 'function'
      ? props.children()
      : props.children;

  const instance = Box({
    style: mergeStyles(tabStyle, props.style),
    focusable: !isDisabled,
    ...handlers,
    children: child,
  });

  const sem: SemanticsNode = {
    role: 'tab',
    label: labelText,
    selected: isSelected(),
    disabled: isDisabled,
    focusable: isActive(),
    autoFocus: false,
    onActivate: () => { if (!isDisabled) ctx.setValue(props.value); },
    onFocus: (kb) => setFocusVisible(kb),
    onBlur: () => setFocusVisible(false),
    onKeyDown: (key, _mods) => handleKey(key),
  };

  createEffect(() => {
    sem.selected = isSelected();
    sem.focusable = isActive();
  });

  instance.semantics = sem;
  applyLayoutChildProps(instance, props);
  return instance;
};

Tabs.Panel = function TabsPanel(props: TabsPanelProps): Instance {
  const ctx = tabsContext.use();

  const build = typeof props.children === 'function' ? props.children : () => props.children as Instance;
  const isShown = () => ctx.value() === props.value;
  const shown = Show({
    when: isShown,
    children: build,
  });

  // Only emit the tabpanel node while visible — hidden panels contribute no
  // content, so exposing an empty tabpanel to AT would be misleading.
  const sem: SemanticsNode = { role: 'tabpanel' };
  createEffect(() => { sem.role = isShown() ? 'tabpanel' : 'none'; });
  shown.semantics = sem;
  applyLayoutChildProps(shown, props);
  return shown;
};
