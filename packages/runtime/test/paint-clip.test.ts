import { describe, it, expect } from 'vitest';
import { paint, type Instance } from '../src/instance';
import { BoxNode } from '@cairn/layout';
function rec() { const calls:any[]=[]; const r:any=new Proxy({},{get:(_t,k)=>(...a:any[])=>calls.push([k,...a])}); return {r,calls}; }
function node(clip: any, children: Instance[] = [], tag = 'self', log: string[] = []): Instance {
  const layout = new BoxNode({}); layout.size = { w: 20, h: 20 };
  return { layout, children, clipChildren: clip, paintSelf(){ log.push(tag); } };
}
describe('paint clip', () => {
  it('clips children to rounded box after paintSelf', () => {
    const { r, calls } = rec();
    paint(node(8, [node(undefined, [], 'child')]), r);
    const clipIdx = calls.findIndex((c) => c[0] === 'clipRoundRect');
    expect(clipIdx).toBeGreaterThanOrEqual(0);
    expect(calls[clipIdx].slice(1)).toEqual([{ x:0,y:0,width:20,height:20 }, 8]);
  });
  it('no clip when clipChildren is undefined', () => {
    const { r, calls } = rec();
    paint(node(undefined, [node(undefined,[],'c')]), r);
    expect(calls.some((c)=>c[0]==='clipRoundRect')).toBe(false);
  });
  it('clipChildren 0 still clips (square)', () => {
    const { r, calls } = rec();
    paint(node(0, [node(undefined,[],'c')]), r);
    expect(calls.some((c)=>c[0]==='clipRoundRect' && c[2]===0)).toBe(true);
  });
});
