import { createEffect, createMemo, createRoot, onCleanup, untrack } from '@cairn/reactivity';
import { runWithDevOwner } from './dev-owner';
import { BoxNode } from '@cairn/layout';
import { type Instance } from './instance';
import { scheduleFrame } from './scheduler';

export interface ShowProps {
  when: () => unknown;
  children: () => Instance;
  fallback?: () => Instance;
}

// Single-slot container. Swaps between children and fallback when when()'s truthiness
// flips, disposing the previous branch's reactive scope.
export function Show(props: ShowProps): Instance {
  const layout = new BoxNode({});
  const instance: Instance = { layout, children: [], paintSelf() {} };
  let scope: (() => void) | null = null;

  const setChild = (child: Instance | null): void => {
    instance.children = child ? [child] : [];
    layout.children = child ? [child.layout] : [];
    scheduleFrame();
  };

  const cond = createMemo(() => !!props.when());
  runWithDevOwner(instance, 'show', () => createEffect(() => {
    const show = cond();
    if (scope) {
      scope();
      scope = null;
    }
    const build = show ? props.children : props.fallback;
    let child: Instance | null = null;
    if (build) {
      untrack(() =>
        createRoot((d) => {
          child = build();
          scope = d;
        }),
      );
    }
    setChild(child);
  }));

  onCleanup(() => {
    if (scope) scope();
  });

  return instance;
}
