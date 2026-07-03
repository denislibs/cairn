import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
import { recordingRenderer } from './recording-renderer';
function paintBox(style: any) {
  return createRoot(() => {
    const inst = Box({ style });
    inst.layout.size = { w: 100, h: 40 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    return calls;
  });
}
describe('Box filter', () => {
  it('sets and resets ctx filter around the box paint', () => {
    const calls = paintBox({ backgroundColor: '#fff', filter: 'blur(4px)' });
    const set = calls.findIndex((c) => c.name === 'setFilter' && c.args[0] === 'blur(4px)');
    const reset = calls.findIndex((c) => c.name === 'setFilter' && (c.args[0] === null || c.args[0] === 'none'));
    expect(set).toBeGreaterThanOrEqual(0);
    expect(reset).toBeGreaterThan(set);
  });
  it('no filter → no setFilter', () => {
    const calls = paintBox({ backgroundColor: '#fff' });
    expect(calls.some((c) => c.name === 'setFilter')).toBe(false);
  });
});
