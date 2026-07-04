import { describe, it, expect } from 'vitest';
import type { Instance } from '@cairn/runtime';
import { inferName } from '../src/name';

function withLayout(ctor: string, extra: Record<string, unknown> = {}): Instance {
  const layout = Object.assign(Object.create({ constructor: { name: ctor } }), {
    offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, ...extra,
  });
  return { layout: layout as any, children: [], paintSelf() {} };
}

describe('inferName', () => {
  it('prefers explicit debugName', () => {
    const inst = withLayout('BoxNode');
    (inst as { debugName?: string }).debugName = 'Button';
    expect(inferName(inst)).toBe('Button');
  });
  it('maps BoxNode to Box', () => expect(inferName(withLayout('BoxNode'))).toBe('Box'));
  it('maps TextNode to Text', () => expect(inferName(withLayout('TextNode'))).toBe('Text'));
  it('maps FlexNode row to Row', () => expect(inferName(withLayout('FlexNode', { direction: 'row' }))).toBe('Row'));
  it('maps FlexNode column to Column', () => expect(inferName(withLayout('FlexNode', { direction: 'column' }))).toBe('Column'));
  it('maps StackNode to Stack', () => expect(inferName(withLayout('StackNode'))).toBe('Stack'));
  it('falls back to the class name', () => expect(inferName(withLayout('WeirdNode'))).toBe('WeirdNode'));
});
