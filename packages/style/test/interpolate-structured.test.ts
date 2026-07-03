import { describe, it, expect } from 'vitest';
import { interpolateValue, lerpLength, lerpTransform, lerpShadow, lerpRadii, lerpInsets } from '../src';

describe('lerpLength', () => {
  it('same unit lerps', () => { expect(lerpLength('0px', '10px', 0.5)).toBe('5px'); expect(lerpLength('0%', '100%', 0.25)).toBe('25%'); });
  it('number treated as px', () => { expect(lerpLength(0, 10, 0.5)).toBe(5); }); // number in → number out (px)
  it('mismatched units snap', () => { expect(lerpLength('0px', '100%', 0.5)).toBe('0px'); expect(lerpLength('0px', '100%', 1)).toBe('100%'); });
});
describe('lerpTransform', () => {
  it('per-field with identity defaults', () => {
    expect(lerpTransform({ scale: 1 }, { scale: 2 }, 0.5)).toEqual({ scale: 1.5 });
    expect(lerpTransform({ translateX: 0 }, { translateX: 10, rotate: 90 }, 0.5)).toEqual({ translateX: 5, rotate: 45 });
  });
});
describe('lerpShadow', () => {
  it('lerps numbers + color, keeps inset', () => {
    const r: any = lerpShadow({ color: '#000', blur: 0, offsetX: 0, offsetY: 0 }, { color: '#000', blur: 10, offsetX: 4, offsetY: 4 }, 0.5);
    expect(r.blur).toBe(5); expect(r.offsetX).toBe(2);
  });
});
describe('lerpRadii', () => {
  it('number lerp', () => { expect(lerpRadii(0, 10, 0.5)).toBe(5); });
  it('number ↔ per-corner normalizes', () => { expect(lerpRadii(0, { tl: 10, tr: 10, br: 10, bl: 10 }, 0.5)).toEqual({ tl: 5, tr: 5, br: 5, bl: 5 }); });
});
describe('lerpInsets', () => {
  it('number lerp', () => { expect(lerpInsets(0, 20, 0.5)).toBe(10); });
  it('object lerp', () => { expect(lerpInsets({ top:0,right:0,bottom:0,left:0 }, { top:10,right:10,bottom:10,left:10 }, 0.5)).toEqual({ top:5,right:5,bottom:5,left:5 }); });
});
describe('interpolateValue dispatch', () => {
  it('number / color still work', () => { expect(interpolateValue(0, 10, 0.5)).toBe(5); expect(interpolateValue('#000', '#fff', 0.5)).toBe('rgba(128, 128, 128, 1)'); });
  it('Length string', () => { expect(interpolateValue('0px', '10px', 0.5)).toBe('5px'); });
  it('Transform object', () => { expect(interpolateValue({ scale: 1 }, { scale: 3 }, 0.5)).toEqual({ scale: 2 }); });
  it('Shadow object', () => { const r: any = interpolateValue({ color:'#000', blur:0, offsetX:0, offsetY:0 }, { color:'#000', blur:8, offsetX:0, offsetY:0 }, 0.5); expect(r.blur).toBe(4); });
  it('Radii number↔object', () => { expect(interpolateValue(0, { tl:8,tr:8,br:8,bl:8 }, 0.5)).toEqual({ tl:4,tr:4,br:4,bl:4 }); });
  it('unknown snaps', () => { expect(interpolateValue('a', 'b', 0.3)).toBe('a'); expect(interpolateValue('a', 'b', 1)).toBe('b'); });
});
