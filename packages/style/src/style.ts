import type { EdgeInsets, Justify, Align } from '@cairn/layout';

export type StateName = 'hover' | 'focus' | 'active' | 'pressed' | 'disabled';

// Fixed precedence: later states override earlier ones (disabled wins).
export const STATE_ORDER: readonly StateName[] = ['hover', 'focus', 'active', 'pressed', 'disabled'];

export interface BaseStyle {
  // layout
  width?: number;
  height?: number;
  padding?: number | Partial<EdgeInsets>;
  gap?: number;
  justify?: Justify;
  align?: Align;
  // paint
  backgroundColor?: string;
  borderRadius?: number;
  color?: string;
  font?: string;
}

export type Style = BaseStyle & Partial<Record<StateName, BaseStyle>>;
