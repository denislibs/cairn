import { createEffect, createRoot, onCleanup, untrack } from '@cairn/reactivity';
import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type Instance } from './instance';
import { scheduleFrame } from './scheduler';

export interface ForProps<T> {
  each: () => T[];
  children: (item: T, index: number) => Instance;
  key?: (item: T, index: number) => unknown;
  fallback?: () => Instance;
  direction?: FlexDirection;
  gap?: number;
}

interface Entry {
  instance: Instance;
  dispose: () => void;
}

// Keyed list: reuses instances for surviving keys, disposes removed keys' scopes, reorders.
export function For<T>(props: ForProps<T>): Instance {
  const layout = new FlexNode({
    direction: props.direction ?? 'column',
    gap: props.gap ?? 0,
    mainAxisSize: 'min',
  });
  const instance: Instance = { layout, children: [], paintSelf() {} };
  const keyOf = props.key ?? ((item: T) => item as unknown);

  let entries = new Map<unknown, Entry>();
  let fallback: Entry | null = null;

  const apply = (children: Instance[]): void => {
    instance.children = children;
    layout.children = children.map((c) => c.layout);
    scheduleFrame();
  };

  const disposeFallback = (): void => {
    if (fallback) {
      fallback.dispose();
      fallback = null;
    }
  };

  createEffect(() => {
    const items = props.each();

    if (items.length === 0) {
      for (const e of entries.values()) e.dispose();
      entries = new Map();
      if (props.fallback) {
        if (!fallback) {
          untrack(() =>
            createRoot((d) => {
              fallback = { instance: props.fallback!(), dispose: d };
            }),
          );
        }
        apply([fallback!.instance]);
      } else {
        apply([]);
      }
      return;
    }

    disposeFallback();
    const next = new Map<unknown, Entry>();
    const ordered: Instance[] = [];
    items.forEach((item, i) => {
      const k = keyOf(item, i);
      let entry = entries.get(k);
      if (entry) {
        entries.delete(k);
      } else {
        untrack(() =>
          createRoot((d) => {
            entry = { instance: props.children(item, i), dispose: d };
          }),
        );
      }
      next.set(k, entry!);
      ordered.push(entry!.instance);
    });
    for (const e of entries.values()) e.dispose();
    entries = next;
    apply(ordered);
  });

  onCleanup(() => {
    for (const e of entries.values()) e.dispose();
    disposeFallback();
  });

  return instance;
}
