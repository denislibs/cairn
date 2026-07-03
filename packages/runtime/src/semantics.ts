import type { SemanticsRole, SemanticsNodeData } from '@cairn/host';
import type { Instance } from './instance';

export type { SemanticsRole };

/** Authoring descriptor placed on an Instance by a component. */
export interface SemanticsNode {
  role: SemanticsRole;
  label?: string;
  value?: string;
  checked?: boolean | 'mixed';
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  level?: number;
  min?: number;
  max?: number;
  now?: number;
  focusable?: boolean;
  onActivate?: () => void;
  onFocus?: (keyboard: boolean) => void;
  onBlur?: () => void;
  onKeyDown?: (key: string, mods: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => boolean;
  autoFocus?: boolean;
}

// Stable id assignment: WeakMap so Instance keys are not retained beyond their
// natural lifetime. Module-level counter increments monotonically.
const idMap = new WeakMap<Instance, number>();
let nextId = 1;

function stableId(inst: Instance): number {
  let id = idMap.get(inst);
  if (id === undefined) {
    id = nextId++;
    idMap.set(inst, id);
  }
  return id;
}

/**
 * DFS pre-order walk of the Instance tree. For every Instance that has
 * `.semantics` with a role other than 'none', emit a SemanticsNodeData with:
 *   - a stable numeric id (consistent across repeated calls)
 *   - an absolute rect (accumulated offsetX/offsetY from all ancestors)
 *   - all authoring fields copied through
 */
export function collectSemantics(root: Instance): SemanticsNodeData[] {
  const result: SemanticsNodeData[] = [];
  walk(root, 0, 0, result);
  return result;
}

function walk(inst: Instance, absX: number, absY: number, out: SemanticsNodeData[]): void {
  const x = absX + inst.layout.offsetX;
  const y = absY + inst.layout.offsetY;

  const sem = (inst as { semantics?: SemanticsNode }).semantics;
  if (sem && sem.role !== 'none') {
    const data: SemanticsNodeData = {
      id: stableId(inst),
      role: sem.role,
      rect: { x, y, width: inst.layout.size.w, height: inst.layout.size.h },
    };
    if (sem.label !== undefined) data.label = sem.label;
    if (sem.value !== undefined) data.value = sem.value;
    if (sem.checked !== undefined) data.checked = sem.checked;
    if (sem.selected !== undefined) data.selected = sem.selected;
    if (sem.expanded !== undefined) data.expanded = sem.expanded;
    if (sem.disabled !== undefined) data.disabled = sem.disabled;
    if (sem.readonly !== undefined) data.readonly = sem.readonly;
    if (sem.level !== undefined) data.level = sem.level;
    if (sem.min !== undefined) data.min = sem.min;
    if (sem.max !== undefined) data.max = sem.max;
    if (sem.now !== undefined) data.now = sem.now;
    if (sem.focusable !== undefined) data.focusable = sem.focusable;
    if (sem.onActivate !== undefined) data.onActivate = sem.onActivate;
    if (sem.onFocus !== undefined) data.onFocus = sem.onFocus;
    if (sem.onBlur !== undefined) data.onBlur = sem.onBlur;
    if (sem.onKeyDown !== undefined) data.onKeyDown = sem.onKeyDown;
    if (sem.autoFocus !== undefined) data.autoFocus = sem.autoFocus;
    out.push(data);
  }

  for (const child of inst.children) {
    walk(child, x, y, out);
  }
}
