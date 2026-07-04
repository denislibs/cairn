import { describe, it, expect, beforeEach } from 'vitest';
import type { Instance } from '@cairn/runtime';
import { serialize } from '../src/serialize';
import { resetIds } from '../src/ids';

function node(ctor: string, opts: {
  x?: number; y?: number; w?: number; h?: number; children?: Instance[];
} = {}): Instance {
  const layout = Object.assign(Object.create({ constructor: { name: ctor } }), {
    offsetX: opts.x ?? 0, offsetY: opts.y ?? 0,
    size: { w: opts.w ?? 0, h: opts.h ?? 0 },
    flex: 0, zIndex: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  return { layout: layout as any, children: opts.children ?? [], paintSelf() {} };
}

describe('serialize', () => {
  beforeEach(() => resetIds());

  it('produces absolute rects by accumulating offsets', () => {
    const child = node('TextNode', { x: 5, y: 7, w: 10, h: 2 });
    const root = node('BoxNode', { x: 3, y: 4, w: 100, h: 50, children: [child] });
    const snap = serialize(root);
    expect(snap.rect).toEqual({ x: 3, y: 4, w: 100, h: 50 });
    expect(snap.children[0].rect).toEqual({ x: 8, y: 11, w: 10, h: 2 });
  });

  it('records name, size, offset and children', () => {
    const snap = serialize(node('FlexNode', { w: 20, h: 20, children: [node('TextNode')] }));
    expect(snap.name).toBe('Row');
    expect(snap.size).toEqual({ w: 20, h: 20 });
    expect(snap.children).toHaveLength(1);
    expect(snap.children[0].name).toBe('Text');
  });

  it('captures flags and semantics', () => {
    const inst = node('BoxNode', { w: 1, h: 1 });
    inst.focusable = true;
    inst.paintOpacity = 0.5;
    inst.semantics = { role: 'button', label: 'OK' } as any;
    const snap = serialize(inst);
    expect(snap.flags.focusable).toBe(true);
    expect(snap.flags.opacity).toBe(0.5);
    expect(snap.semantics).toEqual({ role: 'button', label: 'OK' });
  });

  it('omits semantics when role is none', () => {
    const inst = node('BoxNode');
    inst.semantics = { role: 'none' } as any;
    expect(serialize(inst).semantics).toBeUndefined();
  });
});
