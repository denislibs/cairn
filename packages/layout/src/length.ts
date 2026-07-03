export type Length = number | string;

export interface LengthContext {
  basis: number;       // reference size for % (parent available extent on this axis)
  viewportW: number;
  viewportH: number;
  rootFontSize: number;
}

// Resolve a Length to pixels. Returns 'auto' for auto / unresolvable %, undefined for undefined input.
export function resolveLength(len: Length | undefined, ctx: LengthContext): number | 'auto' | undefined {
  if (len === undefined) return undefined;
  if (typeof len === 'number') return len;
  const s = len.trim();
  if (s === 'auto') return 'auto';
  const calc = s.match(/^calc\(\s*(.+?)\s*([+\-])\s*(.+?)\s*\)$/);
  if (calc) {
    const a = resolveLength(calc[1].trim(), ctx);
    const b = resolveLength(calc[3].trim(), ctx);
    if (a === 'auto' || b === 'auto' || a === undefined || b === undefined) return 'auto';
    return calc[2] === '+' ? a + b : a - b;
  }
  if (s.endsWith('%')) {
    if (!isFinite(ctx.basis)) return 'auto';
    return (ctx.basis * parseFloat(s)) / 100;
  }
  if (s.endsWith('vw')) return (ctx.viewportW * parseFloat(s)) / 100;
  if (s.endsWith('vh')) return (ctx.viewportH * parseFloat(s)) / 100;
  if (s.endsWith('rem')) return ctx.rootFontSize * parseFloat(s);
  if (s.endsWith('px')) return parseFloat(s);
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}
