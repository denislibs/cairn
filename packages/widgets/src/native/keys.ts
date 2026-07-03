export const ARROW_UP = 'ArrowUp';
export const ARROW_DOWN = 'ArrowDown';
export const ARROW_LEFT = 'ArrowLeft';
export const ARROW_RIGHT = 'ArrowRight';
export const HOME = 'Home';
export const END = 'End';
export const ESCAPE = 'Escape';
export const ENTER = 'Enter';
export const SPACE = ' ';
export const PAGE_UP = 'PageUp';
export const PAGE_DOWN = 'PageDown';

export function isArrow(key: string): boolean {
  return key === ARROW_UP || key === ARROW_DOWN || key === ARROW_LEFT || key === ARROW_RIGHT;
}

export function isVerticalArrow(key: string): boolean {
  return key === ARROW_UP || key === ARROW_DOWN;
}

export function isHorizontalArrow(key: string): boolean {
  return key === ARROW_LEFT || key === ARROW_RIGHT;
}
