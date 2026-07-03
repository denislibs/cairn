import { createEffect, createRoot, onCleanup, untrack } from '@cairn/reactivity';
import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type EasingName, type EasingFn } from '@cairn/style';
import { type Instance } from './instance';
import { scheduleFrame, onNextLayout } from './scheduler';
import { animate } from './animate';

export interface ForProps<T> {
  each: () => T[];
  children: (item: T, index: number) => Instance;
  key?: (item: T, index: number) => unknown;
  fallback?: () => Instance;
  direction?: FlexDirection;
  gap?: number;
  flip?: boolean | { duration?: number; easing?: EasingName | EasingFn };
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
  const flips = new Map<unknown, () => void>();

  const normalizeFlip = (f: NonNullable<ForProps<T>['flip']>) =>
    f === true
      ? { duration: 250, easing: 'ease-out' as const }
      : { duration: 200, ...f };

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
    // Capture the old key set before any mutations, for FLIP snapshot
    const hadKeys = new Set(entries.keys());

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

    // FLIP — First: snapshot offsets of surviving keys before reconcile
    const prev = new Map<unknown, { x: number; y: number }>();
    if (props.flip && hadKeys.size > 0) {
      for (const [k, e] of entries) {
        prev.set(k, { x: e.instance.layout.offsetX, y: e.instance.layout.offsetY });
      }
    }

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

    // FLIP — Last + Invert + Play: after layout, compute deltas and animate
    if (props.flip && prev.size > 0) {
      const opts = normalizeFlip(props.flip);
      onNextLayout(() => {
        // Collect all items that actually moved
        type FlipItem = { key: unknown; inst: Instance; dx: number; dy: number };
        const moving: FlipItem[] = [];
        for (const [k, p] of prev) {
          if (!hadKeys.has(k)) continue;
          const inst = next.get(k)?.instance;
          if (!inst) continue;
          const dx = p.x - inst.layout.offsetX;
          const dy = p.y - inst.layout.offsetY;
          if (dx === 0 && dy === 0) continue;
          // Cancel any prior in-flight animation for this key
          flips.get(k)?.();
          // Invert: place the item at its old position visually
          inst.transform = { translateX: dx, translateY: dy };
          moving.push({ key: k, inst, dx, dy });
        }
        if (moving.length === 0) return;
        // Play: drive all moving items with a single shared animation
        const cancelAll = animate({
          from: 0,
          to: 1,
          duration: opts.duration,
          easing: opts.easing,
          onUpdate: (t) => {
            for (const { inst, dx, dy } of moving) {
              inst.transform = { translateX: dx * (1 - t), translateY: dy * (1 - t) };
            }
            scheduleFrame();
          },
          onDone: () => {
            for (const { key, inst } of moving) {
              inst.transform = undefined;
              flips.delete(key);
            }
          },
        });
        for (const { key } of moving) flips.set(key, cancelAll);
      });
    }
  });

  onCleanup(() => {
    for (const e of entries.values()) e.dispose();
    disposeFallback();
    for (const cancel of flips.values()) cancel();
  });

  return instance;
}
