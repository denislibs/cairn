import type { Instance } from './instance';

export interface RuntimeDevHooks {
  onCommit(root: Instance, viewport: { w: number; h: number }): void;
}

let hooks: RuntimeDevHooks | null = null;

export function setRuntimeDevHooks(h: RuntimeDevHooks | null): void {
  hooks = h;
}

export function emitCommit(root: Instance, viewport: { w: number; h: number }): void {
  if (hooks) hooks.onCommit(root, viewport);
}
