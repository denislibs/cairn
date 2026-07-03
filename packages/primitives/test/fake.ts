import type { Renderer } from '@cairn/host';
import type { LayoutContext } from '@cairn/layout';

export function createFakeRenderer(): Renderer & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args]);
  };
  const r = {
    calls,
    resize: rec('resize'),
    beginFrame: rec('beginFrame'),
    endFrame: rec('endFrame'),
    clear: rec('clear'),
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    scale: rec('scale'),
    clipRect: rec('clipRect'),
    clipRoundRect: rec('clipRoundRect'),
    setShadow: rec('setShadow'),
    setGlobalAlpha: rec('setGlobalAlpha'),
    setLineDash: rec('setLineDash'),
    fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'),
    fillRoundRect: rec('fillRoundRect'),
    strokeRoundRect: rec('strokeRoundRect'),
    fillPath: rec('fillPath'),
    strokePath: rec('strokePath'),
    drawText: rec('drawText'),
    measureText: (text: string, style: unknown) => {
      calls.push(['measureText', text, style]);
      return { width: text.length * 7 };
    },
    drawImage: rec('drawImage'),
  };
  return r as unknown as Renderer & { calls: unknown[][] };
}

export const fakeCtx: LayoutContext = {
  measureText: (text) => ({ width: text.length * 7 }),
};

export const LOOSE = { minW: 0, maxW: 1000, minH: 0, maxH: 1000 };
