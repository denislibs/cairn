import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Text } from '../src/text';
import { recordingRenderer } from './recording-renderer';

function fakeCtx() { return { measureText: (t: string) => ({ width: t.length * 10 }) } as any; }

it('underline draws a fill line per text line', () => {
  createRoot(() => {
    const inst = Text({ style: { textDecoration: 'underline', fontSize: 16 }, children: 'hello' });
    inst.layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, fakeCtx());
    inst.layout.size = { w: 50, h: 16 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    expect(calls.some((c) => c.name === 'fillRect')).toBe(true);
  });
});
it('no decoration → no fillRect', () => {
  createRoot(() => {
    const inst = Text({ style: {}, children: 'hello' });
    inst.layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, fakeCtx());
    inst.layout.size = { w: 50, h: 16 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    expect(calls.some((c) => c.name === 'fillRect')).toBe(false);
  });
});
