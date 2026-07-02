import { createEffect, createRoot, createSignal, onCleanup, untrack } from '@cairn/reactivity';
import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type Instance } from './instance';
import { scheduleFrame } from './scheduler';

export interface IndexProps<T> {
  each: () => T[];
  children: (item: () => T, index: number) => Instance;
  fallback?: () => Instance;
  direction?: FlexDirection;
  gap?: number;
}

interface Slot<T> {
  setItem: (v: T) => void;
  instance: Instance;
  dispose: () => void;
}

// Index-keyed list: slots are reused by position; only the item accessor changes.
export function Index<T>(props: IndexProps<T>): Instance {
  const layout = new FlexNode({
    direction: props.direction ?? 'column',
    gap: props.gap ?? 0,
    mainAxisSize: 'min',
  });
  const instance: Instance = { layout, children: [], paintSelf() {} };
  const slots: Slot<T>[] = [];
  let fallback: { instance: Instance; dispose: () => void } | null = null;

  const apply = (children: Instance[]): void => {
    instance.children = children;
    layout.children = children.map((c) => c.layout);
    scheduleFrame();
  };

  createEffect(() => {
    const items = props.each();

    const overlap = Math.min(items.length, slots.length);
    for (let i = 0; i < overlap; i++) slots[i].setItem(items[i]);

    let lengthChanged = false;
    if (items.length > slots.length) {
      for (let i = slots.length; i < items.length; i++) {
        const start = items[i];
        untrack(() =>
          createRoot((d) => {
            const [item, setItem] = createSignal<T>(start);
            const inst = props.children(item, i);
            slots.push({ setItem, instance: inst, dispose: d });
          }),
        );
      }
      lengthChanged = true;
    } else if (items.length < slots.length) {
      const removed = slots.splice(items.length);
      for (const s of removed) s.dispose();
      lengthChanged = true;
    }

    if (items.length === 0 && props.fallback) {
      if (!fallback) {
        untrack(() =>
          createRoot((d) => {
            fallback = { instance: props.fallback!(), dispose: d };
          }),
        );
      }
      apply([fallback!.instance]);
      return;
    }
    if (fallback) {
      fallback.dispose();
      fallback = null;
      lengthChanged = true;
    }
    if (lengthChanged) apply(slots.map((s) => s.instance));
  });

  onCleanup(() => {
    for (const s of slots) s.dispose();
    if (fallback) fallback.dispose();
  });

  return instance;
}
