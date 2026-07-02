import { createEffect, createMemo, createRoot, onCleanup, untrack } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { type Instance } from './instance';
import { scheduleFrame } from './scheduler';

export interface MatchDescriptor {
  when: () => unknown;
  children: () => Instance;
}

export type MatchProps = MatchDescriptor;

// Match is a descriptor consumed by Switch — not an Instance itself.
export function Match(props: MatchProps): MatchDescriptor {
  return { when: props.when, children: props.children };
}

export interface SwitchProps {
  children: MatchDescriptor | MatchDescriptor[];
  fallback?: () => Instance;
}

// Renders the first Match whose when() is truthy; fallback when none match.
export function Switch(props: SwitchProps): Instance {
  const matches = Array.isArray(props.children) ? props.children : [props.children];
  const layout = new BoxNode({});
  const instance: Instance = { layout, children: [], paintSelf() {} };
  let scope: (() => void) | null = null;

  const setChild = (child: Instance | null): void => {
    instance.children = child ? [child] : [];
    layout.children = child ? [child.layout] : [];
    scheduleFrame();
  };

  const chosen = createMemo(() => {
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].when()) return i;
    }
    return -1;
  });

  createEffect(() => {
    const idx = chosen();
    if (scope) {
      scope();
      scope = null;
    }
    const build = idx >= 0 ? matches[idx].children : props.fallback;
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
  });

  onCleanup(() => {
    if (scope) scope();
  });

  return instance;
}
