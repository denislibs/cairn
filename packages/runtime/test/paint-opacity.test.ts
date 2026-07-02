import { describe, it, expect } from 'vitest';
import { paint, type Instance } from '../src/instance';
import { BoxNode } from '@cairn/layout';

function rec() {
  const calls: any[] = [];
  const r: any = new Proxy({}, { get: (_t, k) => (...a: any[]) => calls.push([k, ...a]) });
  return { r, calls };
}
function node(opacity: number | undefined, children: Instance[] = []): Instance {
  const layout = new BoxNode({}); layout.size = { w: 10, h: 10 };
  return { layout, children, paintOpacity: opacity, paintSelf() {} };
}

describe('paint opacity', () => {
  it('nested opacity multiplies and is set via setGlobalAlpha', () => {
    const { r, calls } = rec();
    paint(node(0.5, [node(0.5)]), r);
    const alphas = calls.filter((c) => c[0] === 'setGlobalAlpha').map((c) => c[1]);
    expect(alphas).toEqual([0.5, 0.25]);
  });
  it('no setGlobalAlpha when opacity is undefined or 1', () => {
    const { r, calls } = rec();
    paint(node(undefined, [node(1)]), r);
    expect(calls.some((c) => c[0] === 'setGlobalAlpha')).toBe(false);
  });
});
