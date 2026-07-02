import type { Renderer } from '@cairn/host';

export interface Call {
  name: string;
  args: any[];
}

export function recordingRenderer(): { r: Renderer; calls: Call[] } {
  const calls: Call[] = [];
  const names = [
    'resize', 'beginFrame', 'endFrame', 'clear', 'save', 'restore', 'translate', 'scale',
    'clipRect', 'setShadow', 'setGlobalAlpha', 'setLineDash', 'fillRect', 'strokeRect',
    'fillRoundRect', 'strokeRoundRect', 'fillPath', 'strokePath', 'drawText', 'drawImage',
  ];
  const r: any = {};
  for (const n of names) r[n] = (...args: any[]) => calls.push({ name: n, args });
  r.measureText = (t: string) => ({ width: t.length * 8 });
  return { r: r as Renderer, calls };
}
