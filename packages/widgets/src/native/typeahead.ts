export interface TypeaheadOptions {
  getLabels: () => string[];
  onMatch: (index: number) => void;
  timeoutMs?: number;
  now?: () => number; // injected clock — default: incrementing counter
}

export interface TypeaheadResult {
  handleChar: (ch: string) => boolean;
}

export function createTypeahead(opts: TypeaheadOptions): TypeaheadResult {
  const timeoutMs = opts.timeoutMs ?? 500;

  // Default clock: simple incrementing counter (not real time, but monotonic)
  let counter = 0;
  const defaultNow = () => ++counter;
  const now = opts.now ?? defaultNow;

  let buffer = '';
  let lastTime = 0;

  function handleChar(ch: string): boolean {
    // Only handle printable single chars
    if (ch.length !== 1) return false;

    const t = now();
    if (t - lastTime > timeoutMs) {
      buffer = ''; // reset after timeout
    }
    lastTime = t;
    buffer += ch;

    const labels = opts.getLabels();
    const prefix = buffer.toLowerCase();
    const idx = labels.findIndex((l) => l.toLowerCase().startsWith(prefix));
    if (idx >= 0) {
      opts.onMatch(idx);
      return true;
    }
    // No match — keep buffer but return false
    return false;
  }

  return { handleChar };
}
