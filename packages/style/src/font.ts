import type { BaseStyle } from './style';

// Compose a CSS font string. If any longhand is set, build from longhands (with
// defaults); otherwise fall back to the `font` shorthand (or a 16px sans-serif default).
export function composeFont(s: BaseStyle): string {
  const hasLonghand =
    s.fontFamily !== undefined || s.fontSize !== undefined ||
    s.fontWeight !== undefined || s.fontStyle !== undefined;
  if (!hasLonghand) return s.font ?? '16px sans-serif';
  const style = s.fontStyle ?? 'normal';
  const weight = s.fontWeight ?? 'normal';
  const size = s.fontSize ?? 16;
  const family = s.fontFamily ?? 'sans-serif';
  return `${style} ${weight} ${size}px ${family}`;
}
