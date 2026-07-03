export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function parseColor(c: string): [number, number, number, number] | null {
  const s = c.trim();
  const hex = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16), 1];
  }
  const rgb = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(',').map((x) => parseFloat(x.trim()));
    return [parts[0]||0, parts[1]||0, parts[2]||0, parts[3] === undefined ? 1 : parts[3]];
  }
  return null;
}
export function lerpColor(a: string, b: string, t: number): string {
  const ca = parseColor(a), cb = parseColor(b);
  if (!ca || !cb) return t < 1 ? a : b; // unparseable → snap
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  const al = lerp(ca[3], cb[3], t);
  return `rgba(${r}, ${g}, ${bl}, ${al})`;
}

export function parseLength(v: number | string): { value: number; unit: string } | null {
  if (typeof v === 'number') return { value: v, unit: 'px' };
  const m = v.trim().match(/^(-?\d*\.?\d+)(px|%|rem|vw|vh|em)$/);
  return m ? { value: parseFloat(m[1]), unit: m[2] } : null;
}
export function lerpLength(a: number | string, b: number | string, t: number): number | string {
  const pa = parseLength(a), pb = parseLength(b);
  if (!pa || !pb || pa.unit !== pb.unit) return t >= 1 ? b : a; // snap on mismatch/unparseable
  const v = lerp(pa.value, pb.value, t);
  if (typeof a === 'number' && typeof b === 'number') return v; // number in → number out
  return `${v}${pa.unit}`;
}
export function lerpTransform(a: any, b: any, t: number): any {
  const keys = ['translateX','translateY','scale','scaleX','scaleY','rotate','skewX','skewY'];
  const identity = (k: string) => (k === 'scale' || k === 'scaleX' || k === 'scaleY' ? 1 : 0);
  const out: any = {};
  for (const k of keys) {
    const av = a[k], bv = b[k];
    if (av === undefined && bv === undefined) continue;
    out[k] = lerp(av ?? identity(k), bv ?? identity(k), t);
  }
  return out;
}
export function lerpShadow(a: any, b: any, t: number): any {
  return {
    color: lerpColor(a.color ?? '#000', b.color ?? '#000', t),
    blur: lerp(a.blur ?? 0, b.blur ?? 0, t),
    offsetX: lerp(a.offsetX ?? 0, b.offsetX ?? 0, t),
    offsetY: lerp(a.offsetY ?? 0, b.offsetY ?? 0, t),
    ...(a.spread !== undefined || b.spread !== undefined ? { spread: lerp(a.spread ?? 0, b.spread ?? 0, t) } : {}),
    ...(a.inset || b.inset ? { inset: (t >= 1 ? b.inset : a.inset) } : {}),
  };
}
function toCorners(r: any) { return typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r; }
export function lerpRadii(a: any, b: any, t: number): any {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  const ca = toCorners(a), cb = toCorners(b);
  return { tl: lerp(ca.tl, cb.tl, t), tr: lerp(ca.tr, cb.tr, t), br: lerp(ca.br, cb.br, t), bl: lerp(ca.bl, cb.bl, t) };
}
function toInsets(p: any) { return typeof p === 'number' ? { top: p, right: p, bottom: p, left: p } : p; }
export function lerpInsets(a: any, b: any, t: number): any {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  const ia = toInsets(a), ib = toInsets(b);
  return { top: lerp(ia.top??0, ib.top??0, t), right: lerp(ia.right??0, ib.right??0, t), bottom: lerp(ia.bottom??0, ib.bottom??0, t), left: lerp(ia.left??0, ib.left??0, t) };
}
function lerpGradient(a: any, b: any, t: number): any {
  if (a.kind !== b.kind || !a.stops || !b.stops || a.stops.length !== b.stops.length) return t >= 1 ? b : a;
  const stops = a.stops.map((s: any, i: number) => ({ offset: lerp(s.offset, b.stops[i].offset, t), color: lerpColor(s.color, b.stops[i].color, t) }));
  return { ...a, stops };
}

export function interpolateValue(a: unknown, b: unknown, t: number): unknown {
  if (a == null || b == null) return t >= 1 ? b : a;
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (typeof a === 'string' && typeof b === 'string') {
    if (parseColor(a) && parseColor(b)) return lerpColor(a, b, t);
    if (parseLength(a) && parseLength(b)) return lerpLength(a, b, t);
    return t >= 1 ? b : a;
  }
  // object ↔ object
  if (typeof a === 'object' && typeof b === 'object') {
    const ao = a as any, bo = b as any;
    if (Array.isArray(ao) && Array.isArray(bo)) {
      if (ao.length !== bo.length) return t >= 1 ? b : a;
      return ao.map((x, i) => interpolateValue(x, bo[i], t));
    }
    if ('stops' in ao || 'stops' in bo) return lerpGradient(ao, bo, t);
    if ('translateX' in ao || 'translateY' in ao || 'scale' in ao || 'scaleX' in ao || 'rotate' in ao || 'skewX' in ao || 'skewY' in ao ||
        'translateX' in bo || 'scale' in bo || 'rotate' in bo) return lerpTransform(ao, bo, t);
    if (('blur' in ao && 'offsetX' in ao) || ('blur' in bo && 'offsetX' in bo)) return lerpShadow(ao, bo, t);
    if ('tl' in ao || 'tl' in bo) return lerpRadii(ao, bo, t);
    if (('top' in ao && 'left' in ao) || ('top' in bo && 'left' in bo)) return lerpInsets(ao, bo, t);
  }
  // number ↔ Radii/Insets object (normalize)
  if (typeof a === 'number' && typeof b === 'object' && b !== null) {
    if ('tl' in (b as any)) return lerpRadii(a, b, t);
    if ('top' in (b as any)) return lerpInsets(a, b, t);
  }
  if (typeof b === 'number' && typeof a === 'object' && a !== null) {
    if ('tl' in (a as any)) return lerpRadii(a, b, t);
    if ('top' in (a as any)) return lerpInsets(a, b, t);
  }
  // number ↔ length-string (both px-ish, no object involved)
  if ((typeof a === 'number' || typeof b === 'number') &&
      (typeof a === 'number' || typeof a === 'string') &&
      (typeof b === 'number' || typeof b === 'string') &&
      parseLength(a as any) && parseLength(b as any)) {
    return lerpLength(a as any, b as any, t);
  }
  return t >= 1 ? b : a;
}
