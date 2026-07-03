export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export function applyTextTransform(text: string, t: TextTransform | undefined): string {
  switch (t) {
    case 'uppercase': return text.toUpperCase();
    case 'lowercase': return text.toLowerCase();
    case 'capitalize': return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default: return text;
  }
}
