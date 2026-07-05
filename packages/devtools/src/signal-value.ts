export type SignalValueType = 'number' | 'string' | 'boolean' | 'other';

export function serializeSignalValue(v: unknown): { value: string; type: SignalValueType } {
  const t = typeof v;
  if (t === 'number') return { value: String(v), type: 'number' };
  if (t === 'boolean') return { value: String(v), type: 'boolean' };
  if (t === 'string') return { value: v as string, type: 'string' };
  if (t === 'function') return { value: '[fn]', type: 'other' };
  try { return { value: JSON.stringify(v) ?? String(v), type: 'other' }; }
  catch { return { value: String(v), type: 'other' }; }
}

export type CoerceResult = { ok: true; value: unknown } | { ok: false };

export function coerceSignalValue(current: unknown, raw: string): CoerceResult {
  const t = typeof current;
  if (t === 'number') { const n = parseFloat(raw); return Number.isNaN(n) ? { ok: false } : { ok: true, value: n }; }
  if (t === 'boolean') return { ok: true, value: /^true$/i.test(raw.trim()) };
  if (t === 'string') return { ok: true, value: raw.replace(/^"([\s\S]*)"$/, '$1') };
  return { ok: false }; // objects / undefined / functions — not editable
}
