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
export function interpolateValue(a: unknown, b: unknown, t: number): unknown {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (typeof a === 'string' && typeof b === 'string' && parseColor(a) && parseColor(b)) return lerpColor(a, b, t);
  return t >= 1 ? b : a; // non-interpolable → step
}
