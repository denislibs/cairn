import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Provider, Show } from '@cairn/runtime';
import { createSignal, createEffect, type Accessor } from '@cairn/reactivity';
import { Box, Row, Column, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

export interface AccordionContextValue {
  isOpen: (value: any) => boolean;
  toggle: (value: any) => void;
  type: 'single' | 'multiple';
}

export const accordionContext = createCompoundContext<AccordionContextValue>('Accordion');

export interface AccordionItemContextValue {
  value: any;
}
export const accordionItemContext = createCompoundContext<AccordionItemContextValue>('AccordionItem');

export interface AccordionProps extends LayoutChildProps {
  type?: 'single' | 'multiple';
  value?: any | any[] | Accessor<any>;
  defaultValue?: any | any[];
  onChange?: (v: any | any[]) => void;
  collapsible?: boolean;
  children: () => Instance;
  style?: StyleInput;
}

export interface AccordionInstance extends Instance {
  _ctx: AccordionContextValue;
}

export function Accordion(props: AccordionProps): AccordionInstance {
  const t = useWidgetTheme();
  const type = props.type ?? 'single';
  const collapsible = props.collapsible ?? false;
  const controlled = props.value !== undefined;

  const initSet = (): Set<any> => {
    const dv = props.defaultValue;
    if (dv === undefined || dv === null) return new Set();
    if (Array.isArray(dv)) return new Set(dv);
    return new Set([dv]);
  };

  const [openSet, setOpenSet] = createSignal<Set<any>>(controlled ? new Set() : initSet());

  const readOpen = (): Set<any> => {
    if (controlled) {
      const v = props.value;
      const val = typeof v === 'function' ? (v as Accessor<any>)() : v;
      if (val === undefined || val === null) return new Set();
      if (Array.isArray(val)) return new Set(val);
      return new Set([val]);
    }
    return openSet();
  };

  const isOpen = (value: any): boolean => readOpen().has(value);

  const toggle = (value: any): void => {
    const current = readOpen();
    let next: Set<any>;
    if (type === 'single') {
      if (current.has(value)) {
        next = collapsible ? new Set() : current;
      } else {
        next = new Set([value]);
      }
    } else {
      next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
    }
    if (!controlled) setOpenSet(next);
    if (type === 'single') {
      props.onChange?.(next.size > 0 ? [...next][0] : null);
    } else {
      props.onChange?.([...next]);
    }
  };

  const ctx: AccordionContextValue = { isOpen, toggle, type };

  const content = Provider({
    context: accordionContext.context,
    value: ctx,
    children: props.children,
  });

  const instance: AccordionInstance = {
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

export interface AccordionItemProps extends LayoutChildProps {
  value: any;
  children: () => Instance;
  style?: StyleInput;
}

export interface AccordionTriggerProps extends LayoutChildProps {
  children: Instance | string;
  style?: StyleInput;
}

export interface AccordionContentProps extends LayoutChildProps {
  children: Instance | (() => Instance);
  style?: StyleInput;
}

Accordion.Item = function AccordionItem(props: AccordionItemProps): Instance {
  const t = useWidgetTheme();
  const accordionCtx = accordionContext.use();
  const itemCtx: AccordionItemContextValue = { value: props.value };

  const innerContent = Provider({
    context: accordionItemContext.context,
    value: itemCtx,
    children: () => Provider({
      context: accordionContext.context,
      value: accordionCtx,
      children: props.children,
    }),
  });

  const container = Column({
    mainAxisSize: 'min',
    style: mergeStyles({ gap: 0 }, props.style),
    children: [innerContent],
  });

  applyLayoutChildProps(container, props);
  return container;
};

Accordion.Trigger = function AccordionTrigger(props: AccordionTriggerProps): Instance {
  const t = useWidgetTheme();
  const ctx = accordionContext.use();
  const itemCtx = accordionItemContext.use();

  const open = () => ctx.isOpen(itemCtx.value);

  const { handlers, setFocusVisible } = createControl({
    onClick: () => ctx.toggle(itemCtx.value),
  });

  const triggerStyle: StyleInput = () => ({
    paddingLeft: t.control.padX.sm,
    paddingRight: t.control.padX.sm,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.sm,
    cursor: 'pointer',
    backgroundColor: 'transparent',
  });

  const labelText = typeof props.children === 'string' ? props.children : undefined;
  const child: Instance = typeof props.children === 'string'
    ? Text({ children: props.children })
    : props.children;

  const instance = Box({
    style: mergeStyles(triggerStyle, props.style),
    focusable: true,
    ...handlers,
    children: child,
  });

  const sem: SemanticsNode = {
    role: 'button',
    label: labelText,
    expanded: open(),
    focusable: true,
    onActivate: () => ctx.toggle(itemCtx.value),
    onFocus: (kb) => setFocusVisible(kb),
    onBlur: () => setFocusVisible(false),
  };

  createEffect(() => {
    sem.expanded = open();
  });

  instance.semantics = sem;
  applyLayoutChildProps(instance, props);
  return instance;
};

Accordion.Content = function AccordionContent(props: AccordionContentProps): Instance {
  const ctx = accordionContext.use();
  const itemCtx = accordionItemContext.use();

  const build = typeof props.children === 'function' ? props.children : () => props.children as Instance;
  const isShown = () => ctx.isOpen(itemCtx.value);
  const shown = Show({
    when: isShown,
    children: build,
  });

  // Only expose the region while the item is open — a collapsed item has no
  // content, so an empty region would be misleading to AT.
  const sem: SemanticsNode = { role: 'region' };
  createEffect(() => { sem.role = isShown() ? 'region' : 'none'; });
  shown.semantics = sem;
  applyLayoutChildProps(shown, props);
  return shown;
};
