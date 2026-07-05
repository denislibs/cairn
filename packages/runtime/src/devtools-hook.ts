import type { Instance } from './instance';

export interface FrameTiming {
  total: number;
  layout: number;
  a11y: number;
  paint: number;
}

export interface RuntimeDevHooks {
  onCommit(root: Instance, viewport: { w: number; h: number }, timing: FrameTiming): void;
}

let hooks: RuntimeDevHooks | null = null;

export function setRuntimeDevHooks(h: RuntimeDevHooks | null): void {
  hooks = h;
}

export function emitCommit(root: Instance, viewport: { w: number; h: number }, timing: FrameTiming): void {
  if (hooks) hooks.onCommit(root, viewport, timing);
}
