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
  /** textbox: placeholder text shown when the field is empty */
  placeholder?: string;
  /** textbox: called when the native input changes value */
  onInput?: (value: string) => void;
  /** textbox: true if the field is a multi-line textarea */
  multiline?: boolean;
  onActivate?: () => void;
  onFocus?: (keyboard: boolean) => void;
  onBlur?: () => void;
  onKeyDown?: (key: string, mods: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => boolean;
  autoFocus?: boolean;
  /** True if this node is a modal overlay (dialog/drawer) — traps focus. */
  modal?: boolean;
  current?: boolean | 'page' | 'step';
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
  walk(root, 0, 0, undefined, result);
  return result;
}

function walk(
  inst: Instance,
  absX: number,
  absY: number,
  currentModalId: number | undefined,
  out: SemanticsNodeData[],
): void {
  const x = absX + inst.layout.offsetX;
  const y = absY + inst.layout.offsetY;

  const sem = (inst as { semantics?: SemanticsNode }).semantics;
  let nextModalId = currentModalId;

  if (sem && sem.role !== 'none') {
    const id = stableId(inst);

    // If this node is a modal, it becomes the active modal group for itself and
    // all descendants.
    if (sem.modal) nextModalId = id;

    const data: SemanticsNodeData = {
      id,
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
    if (sem.placeholder !== undefined) data.placeholder = sem.placeholder;
    if (sem.onInput !== undefined) data.onInput = sem.onInput;
    if (sem.multiline !== undefined) data.multiline = sem.multiline;
    if (sem.onActivate !== undefined) data.onActivate = sem.onActivate;
    if (sem.onFocus !== undefined) data.onFocus = sem.onFocus;
    if (sem.onBlur !== undefined) data.onBlur = sem.onBlur;
    if (sem.onKeyDown !== undefined) data.onKeyDown = sem.onKeyDown;
    if (sem.autoFocus !== undefined) data.autoFocus = sem.autoFocus;
    if (sem.modal) data.modal = sem.modal;
    if (sem.current !== undefined) data.current = sem.current;
    // Tag with modalGroup if we are inside (or are) a modal node.
    if (nextModalId !== undefined) data.modalGroup = nextModalId;
    out.push(data);
  }

  for (const child of inst.children) {
    walk(child, x, y, nextModalId, out);
  }
}
