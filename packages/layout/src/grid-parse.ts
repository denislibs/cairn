export type TrackSize =
  | { kind: 'px'; value: number }
  | { kind: 'fr'; value: number }
  | { kind: 'auto' };

export interface Placement { start?: number; end?: number; span?: number }

function parseTrackToken(tok: string): TrackSize {
  if (tok === 'auto') return { kind: 'auto' };
  if (tok.endsWith('fr')) return { kind: 'fr', value: parseFloat(tok) };
  if (tok.endsWith('px')) return { kind: 'px', value: parseFloat(tok) };
  // bare number → px
  const n = parseFloat(tok);
  return { kind: 'px', value: isNaN(n) ? 0 : n };
}

export function parseTracks(input: string | TrackSize[]): TrackSize[] {
  if (Array.isArray(input)) return input;
  const out: TrackSize[] = [];
  // Split into tokens, keeping repeat(...) groups intact.
  const parts = input.match(/repeat\([^)]*\)|\S+/g) ?? [];
  for (const part of parts) {
    const rep = part.match(/^repeat\(\s*(\d+)\s*,\s*(.+)\)$/);
    if (rep) {
      const count = parseInt(rep[1], 10);
      const inner = parseTracks(rep[2].trim()); // inner may be multiple tokens
      for (let i = 0; i < count; i++) out.push(...inner.map((t) => ({ ...t })));
    } else {
      out.push(parseTrackToken(part));
    }
  }
  return out;
}

export function parsePlacement(spec: string | number): Placement {
  if (typeof spec === 'number') return { start: spec, span: 1 };
  const s = spec.trim();
  if (s.includes('/')) {
    const [a, b] = s.split('/').map((x) => x.trim());
    const res: Placement = {};
    if (a.startsWith('span')) res.span = parseInt(a.slice(4).trim(), 10);
    else res.start = parseInt(a, 10);
    if (b.startsWith('span')) res.span = parseInt(b.slice(4).trim(), 10);
    else res.end = parseInt(b, 10);
    return res;
  }
  if (s.startsWith('span')) return { span: parseInt(s.slice(4).trim(), 10) };
  return { start: parseInt(s, 10), span: 1 };
}
