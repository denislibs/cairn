import { test, expect } from 'vitest';
import { BoxNode } from '@cairn/layout';
import type { Instance } from '../src/index';
import { collectSemantics } from '../src/index';
import type { SemanticsNode } from '../src/index';

// Helper: build an Instance with a BoxNode of fixed size and explicit offsets.
function makeInstance(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  semantics?: SemanticsNode,
  children: Instance[] = [],
): Instance {
  const layout = new BoxNode({ width, height });
  layout.offsetX = offsetX;
  layout.offsetY = offsetY;
  // Run layout so size is populated (BoxNode.layout sets size)
  layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, {
    measureText: () => ({ width: 0 }),
    viewport: { w: 1000, h: 1000 },
    rootFontSize: 16,
  });
  return {
    layout,
    children,
    paintSelf() {},
    ...(semantics !== undefined ? { semantics } : {}),
  };
}

test('collectSemantics returns nodes in DFS pre-order', () => {
  // root (no semantics) → child A (button) → grandchild (no semantics)
  //                      → child B (checkbox)
  const grandchild = makeInstance(0, 0, 10, 10);
  const childA = makeInstance(10, 20, 50, 30, { role: 'button', label: 'A' }, [grandchild]);
  const childB = makeInstance(10, 60, 50, 30, { role: 'checkbox', checked: true, label: 'B' });
  const root = makeInstance(0, 0, 200, 100, undefined, [childA, childB]);

  const nodes = collectSemantics(root);
  expect(nodes).toHaveLength(2);
  expect(nodes[0].role).toBe('button');
  expect(nodes[1].role).toBe('checkbox');
});

test('absolute rects accumulate parent offsets', () => {
  // root at (0,0), childA at offset (10,20), grandchild at offset (5,5)
  const grandchild = makeInstance(5, 5, 20, 15, { role: 'button', label: 'GC' });
  const childA = makeInstance(10, 20, 80, 60, { role: 'group' }, [grandchild]);
  const root = makeInstance(0, 0, 200, 100, undefined, [childA]);

  const nodes = collectSemantics(root);
  // group node: rect = {x:10, y:20, width:80, height:60}
  // button grandchild: rect = {x:10+5=15, y:20+5=25, width:20, height:15}
  expect(nodes).toHaveLength(2);
  const groupNode = nodes.find((n) => n.role === 'group')!;
  const buttonNode = nodes.find((n) => n.role === 'button')!;
  expect(groupNode.rect).toEqual({ x: 10, y: 20, width: 80, height: 60 });
  expect(buttonNode.rect).toEqual({ x: 15, y: 25, width: 20, height: 15 });
});

test('same instance keeps its id across two calls', () => {
  const node = makeInstance(0, 0, 50, 50, { role: 'button', label: 'X' });
  const root = makeInstance(0, 0, 200, 100, undefined, [node]);

  const first = collectSemantics(root);
  const second = collectSemantics(root);
  expect(first[0].id).toBe(second[0].id);
});

test('ids are unique across different instances', () => {
  const a = makeInstance(0, 0, 50, 50, { role: 'button', label: 'A' });
  const b = makeInstance(60, 0, 50, 50, { role: 'button', label: 'B' });
  const root = makeInstance(0, 0, 200, 100, undefined, [a, b]);

  const nodes = collectSemantics(root);
  expect(nodes[0].id).not.toBe(nodes[1].id);
});

test('nodes with no semantics are skipped', () => {
  const withoutSemantics = makeInstance(0, 0, 50, 50);
  const root = makeInstance(0, 0, 200, 100, undefined, [withoutSemantics]);

  const nodes = collectSemantics(root);
  expect(nodes).toHaveLength(0);
});

test('nodes with role "none" are skipped', () => {
  const noneNode = makeInstance(0, 0, 50, 50, { role: 'none', label: 'skip me' });
  const root = makeInstance(0, 0, 200, 100, undefined, [noneNode]);

  const nodes = collectSemantics(root);
  expect(nodes).toHaveLength(0);
});

test('onActivate, onFocus, onBlur are carried through', () => {
  let activated = false;
  let focused: boolean | undefined;
  let blurred = false;
  const sem: SemanticsNode = {
    role: 'button',
    label: 'Clicky',
    onActivate: () => { activated = true; },
    onFocus: (kb) => { focused = kb; },
    onBlur: () => { blurred = true; },
  };
  const inst = makeInstance(0, 0, 50, 50, sem);
  const root = makeInstance(0, 0, 200, 100, undefined, [inst]);

  const nodes = collectSemantics(root);
  expect(nodes).toHaveLength(1);

  nodes[0].onActivate!();
  expect(activated).toBe(true);

  nodes[0].onFocus!(true);
  expect(focused).toBe(true);

  nodes[0].onBlur!();
  expect(blurred).toBe(true);
});

test('onKeyDown is carried through', () => {
  let lastKey = '';
  let lastMods = { shift: false, ctrl: false, alt: false, meta: false };
  const handler = (key: string, mods: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => {
    lastKey = key;
    lastMods = mods;
    return true;
  };
  const sem: SemanticsNode = { role: 'button', label: 'K', onKeyDown: handler };
  const inst = makeInstance(0, 0, 50, 50, sem);
  const root = makeInstance(0, 0, 200, 100, undefined, [inst]);

  const [node] = collectSemantics(root);
  expect(node.onKeyDown).toBeDefined();
  const result = node.onKeyDown!('Enter', { shift: false, ctrl: true, alt: false, meta: false });
  expect(result).toBe(true);
  expect(lastKey).toBe('Enter');
  expect(lastMods.ctrl).toBe(true);
});

test('autoFocus is carried through', () => {
  const sem: SemanticsNode = { role: 'textbox', label: 'Name', autoFocus: true };
  const inst = makeInstance(0, 0, 50, 50, sem);
  const root = makeInstance(0, 0, 200, 100, undefined, [inst]);

  const [node] = collectSemantics(root);
  expect(node.autoFocus).toBe(true);
});

test('optional fields (checked, selected, expanded, disabled, readonly, level, min, max, now, focusable) are carried through', () => {
  const sem: SemanticsNode = {
    role: 'checkbox',
    label: 'Accept',
    checked: 'mixed',
    selected: true,
    expanded: false,
    disabled: true,
    readonly: false,
    level: 2,
    min: 0,
    max: 100,
    now: 42,
    focusable: false,
  };
  const inst = makeInstance(0, 0, 50, 50, sem);
  const root = makeInstance(0, 0, 200, 100, undefined, [inst]);

  const [node] = collectSemantics(root);
  expect(node.checked).toBe('mixed');
  expect(node.selected).toBe(true);
  expect(node.expanded).toBe(false);
  expect(node.disabled).toBe(true);
  expect(node.readonly).toBe(false);
  expect(node.level).toBe(2);
  expect(node.min).toBe(0);
  expect(node.max).toBe(100);
  expect(node.now).toBe(42);
  expect(node.focusable).toBe(false);
});

test('collectSemantics carries onInput, placeholder, multiline for textbox', () => {
  const onInput = (v: string) => { void v; };
  const sem: SemanticsNode = {
    role: 'textbox',
    label: 'Name',
    value: 'hello',
    placeholder: 'Enter name',
    onInput,
    multiline: true,
  };
  const inst = makeInstance(0, 0, 100, 30, sem);
  const root = makeInstance(0, 0, 200, 100, undefined, [inst]);

  const [node] = collectSemantics(root);
  expect(node.placeholder).toBe('Enter name');
  expect(node.onInput).toBe(onInput);
  expect(node.multiline).toBe(true);
});

// ── H4 Task 1: modal / modalGroup propagation ─────────────────────────────────

test('modal node itself gets modal:true and modalGroup set to its own id', () => {
  const dialogContent = makeInstance(0, 0, 200, 200, { role: 'dialog', label: 'My dialog', modal: true });
  const root = makeInstance(0, 0, 400, 400, undefined, [dialogContent]);

  const nodes = collectSemantics(root);
  expect(nodes).toHaveLength(1);
  expect(nodes[0].modal).toBe(true);
  expect(nodes[0].modalGroup).toBe(nodes[0].id);
});

test('descendants of a modal node inherit modalGroup equal to the modal node id', () => {
  const btn = makeInstance(10, 10, 80, 30, { role: 'button', label: 'Close' });
  const dialogContent = makeInstance(0, 0, 200, 200, { role: 'dialog', label: 'My dialog', modal: true }, [btn]);
  const root = makeInstance(0, 0, 400, 400, undefined, [dialogContent]);

  const nodes = collectSemantics(root);
  expect(nodes).toHaveLength(2);
  const dialogNode = nodes.find((n) => n.role === 'dialog')!;
  const btnNode = nodes.find((n) => n.role === 'button')!;
  expect(btnNode.modalGroup).toBe(dialogNode.id);
  expect(btnNode.modalGroup).toBe(dialogNode.modalGroup);
});

test('siblings outside modal node do NOT get modalGroup', () => {
  const outsideBtn = makeInstance(0, 0, 80, 30, { role: 'button', label: 'Outside' });
  const btn = makeInstance(10, 10, 80, 30, { role: 'button', label: 'Inside' });
  const dialogContent = makeInstance(200, 0, 200, 200, { role: 'dialog', label: 'D', modal: true }, [btn]);
  const root = makeInstance(0, 0, 400, 400, undefined, [outsideBtn, dialogContent]);

  const nodes = collectSemantics(root);
  const outsideNode = nodes.find((n) => n.label === 'Outside')!;
  const insideNode = nodes.find((n) => n.label === 'Inside')!;
  expect(outsideNode.modalGroup).toBeUndefined();
  expect(insideNode.modalGroup).toBeDefined();
});
