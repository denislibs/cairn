export type ParseResult = { ok: true; value: unknown } | { ok: false };

const STRING_PROPS = new Set(['backgroundColor', 'color', 'border', 'font']);
const NUMBER_PROPS = new Set(['opacity', 'borderRadius', 'gap', 'width', 'height']);

function num(raw: string): number | null {
  const m = raw.trim().match(/^-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isNaN(n) ? null : n;
}

export function parseStyleValue(prop: string, raw: string): ParseResult {
  const t = raw.trim();
  if (STRING_PROPS.has(prop)) return t ? { ok: true, value: t } : { ok: false };
  if (NUMBER_PROPS.has(prop)) { const n = num(t); return n === null ? { ok: false } : { ok: true, value: n }; }
  if (prop === 'padding') {
    const parts = t.split(/\s+/).map(num);
    if (parts.some((p) => p === null)) return { ok: false };
    const [a, b, c, d] = parts as number[];
    if (parts.length === 1) return { ok: true, value: a };
    if (parts.length === 2) return { ok: true, value: { top: a, right: b, bottom: a, left: b } };
    if (parts.length === 4) return { ok: true, value: { top: a, right: b, bottom: c, left: d } };
    return { ok: false };
  }
  return { ok: false }; // non-editable (boxShadow, transform, …)
}
