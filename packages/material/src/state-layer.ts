import { alpha } from './colors';

export type InteractionState = 'none' | 'hover' | 'focus' | 'pressed' | 'dragged';

// Material state-layer opacities (baseline design-language values).
export function stateLayerOpacity(state: InteractionState): number {
  switch (state) {
    case 'hover': return 0.04;
    case 'focus': return 0.12;
    case 'pressed': return 0.12;
    case 'dragged': return 0.16;
    default: return 0;
  }
}

// A translucent overlay of `color` for the given interaction state (over the surface).
export function stateOverlay(color: string, state: InteractionState): string {
  if (state === 'none') return 'transparent';
  return alpha(color, stateLayerOpacity(state));
}
