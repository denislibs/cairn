import { describe, it, expect } from 'vitest';
import { stateLayerOpacity, stateOverlay } from '../src/state-layer';

describe('state layer', () => {
  it('opacity per state', () => {
    expect(stateLayerOpacity('none')).toBe(0);
    expect(stateLayerOpacity('hover')).toBe(0.04);
    expect(stateLayerOpacity('focus')).toBe(0.12);
    expect(stateLayerOpacity('pressed')).toBe(0.12);
    expect(stateLayerOpacity('dragged')).toBe(0.16);
  });
  it('overlay', () => {
    expect(stateOverlay('#000000', 'none')).toBe('transparent');
    expect(stateOverlay('#000000', 'hover')).toBe('rgba(0, 0, 0, 0.04)');
  });
});
