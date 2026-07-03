export function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function toHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lighten(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]);
}

export function darken(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex([r * (1 - amt), g * (1 - amt), b * (1 - amt)]);
}

export function alpha(color: string, a: number): string {
  if (color.startsWith('#')) { const [r, g, b] = parseHex(color); return `rgba(${r}, ${g}, ${b}, ${a})`; }
  return color; // pass through non-hex (rgb/rgba) as-is
}

export function luminance([r, g, b]: [number, number, number]): number {
  // relative-luminance approximation (sRGB weighted)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function contrastText(bg: string): string {
  const rgb = bg.startsWith('#') ? parseHex(bg) : [0, 0, 0] as [number, number, number];
  return luminance(rgb) < 0.55 ? '#fff' : 'rgba(0, 0, 0, 0.87)';
}
