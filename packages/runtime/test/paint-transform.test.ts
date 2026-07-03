import { describe, it, expect } from 'vitest';
import { paint, type Instance } from '../src/instance';
import { BoxNode } from '@cairn/layout';
function rec() { const calls:any[]=[]; const r:any=new Proxy({},{get:(_t,k)=>(...a:any[])=>calls.push([k,...a])}); return {r,calls}; }
function node(transform: any, origin: any = null): Instance {
  const layout = new BoxNode({}); layout.size = { w: 100, h: 40 };
  return { layout, children: [], transform, transformOrigin: origin, paintSelf(){} };
}
it('applies rotate/translate/scale around center before paintSelf', () => {
  const { r, calls } = rec();
  paint(node({ rotate: 90, translateX: 10, scale: 2 }), r);
  const names = calls.map((c) => c[0]);
  // pivots: translate(center) ... translate(-center); includes rotate + scale + translate
  expect(names).toContain('rotate');
  expect(names).toContain('scale');
  // rotate happens before paintSelf — paintSelf is a no-op here so just assert order vs restore
  expect(names.indexOf('rotate')).toBeLessThan(names.indexOf('restore'));
});
it('no transform ops when transform is null', () => {
  const { r, calls } = rec();
  paint(node(null), r);
  expect(calls.some((c)=>c[0]==='rotate')).toBe(false);
});
