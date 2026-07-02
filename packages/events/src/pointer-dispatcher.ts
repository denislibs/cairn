import type { PointerInput, WheelInput } from '@cairn/host';
import type { HitNode } from './event';
import { hitTest } from './hit-test';
import { dispatch, dispatchWheel } from './dispatch';

// Both paths are ordered [target ... root]. The first node of `a` also present in
// `b` is therefore the deepest node they share.
export function nearestCommonAncestor(a: HitNode[], b: HitNode[]): HitNode | null {
  const inB = new Set(b);
  for (const node of a) {
    if (inB.has(node)) return node;
  }
  return null;
}

export interface PointerDispatcher {
  handlePointer(input: PointerInput): void;
  handleWheel(input: WheelInput): void;
}

// Translates raw pointer input into hit-tested bubble dispatch, synthesizing a
// `click` on pointerup at the nearest common ancestor of the down and up paths.
export function createPointerDispatcher(getRoot: () => HitNode): PointerDispatcher {
  let downPath: HitNode[] | null = null;

  return {
    handlePointer(input: PointerInput): void {
      const path = hitTest(getRoot(), input.x, input.y);
      if (path.length === 0) {
        // Missing the surface on release drops any pending down.
        if (input.type === 'pointerup') downPath = null;
        return;
      }

      dispatch(path, {
        type: input.type,
        x: input.x,
        y: input.y,
        button: input.button,
        pointerType: input.pointerType,
      });

      if (input.type === 'pointerdown') {
        downPath = path;
      } else if (input.type === 'pointerup') {
        if (downPath) {
          const nca = nearestCommonAncestor(downPath, path);
          if (nca) {
            const clickPath = path.slice(path.indexOf(nca));
            dispatch(clickPath, {
              type: 'click',
              x: input.x,
              y: input.y,
              button: input.button,
              pointerType: input.pointerType,
            });
          }
        }
        downPath = null;
      }
    },

    handleWheel(input: WheelInput): void {
      const path = hitTest(getRoot(), input.x, input.y);
      if (path.length === 0) return;
      dispatchWheel(path, {
        x: input.x,
        y: input.y,
        deltaX: input.deltaX,
        deltaY: input.deltaY,
      });
    },
  };
}
