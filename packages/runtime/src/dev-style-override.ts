import { createSignal } from '@cairn/reactivity';
import type { Instance } from './instance';
import type { BaseStyle } from '@cairn/style';

export interface StyleOverride {
  patch: Record<string, unknown>;
  disabled: Set<string>;
}

const store = new WeakMap<Instance, StyleOverride>();
let active = false;
// One global reactive "version" — style binds subscribe to it (only when active) so any
// override edit re-runs them. equals:false => every bump notifies.
const [version, setVersion] = createSignal(0, { equals: false });

/** Enable the override system (called by installDevtools before mount). Prod stays inert. */
export function activateStyleOverrides(): void {
  active = true;
}

/** REACTIVE read — call inside a style bind. Returns the instance's override, or undefined.
 *  When inactive it returns immediately without subscribing (zero prod cost). */
export function readStyleOverride(inst: Instance): StyleOverride | undefined {
  if (!active) return undefined;
  version(); // subscribe so edits re-run this bind
  return store.get(inst);
}

/** Merge an override over a resolved style. Returns `base` unchanged when there is nothing to apply. */
export function applyStyleOverride(base: BaseStyle, ovr: StyleOverride | undefined): BaseStyle {
  if (!ovr || (Object.keys(ovr.patch).length === 0 && ovr.disabled.size === 0)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const k of ovr.disabled) delete out[k];
  Object.assign(out, ovr.patch);
  return out as BaseStyle;
}

function edit(inst: Instance): StyleOverride {
  let o = store.get(inst);
  if (!o) { o = { patch: {}, disabled: new Set() }; store.set(inst, o); }
  return o;
}
function bump(): void { setVersion((v) => v + 1); }

export function setStyleProp(inst: Instance, prop: string, value: unknown): void {
  const o = edit(inst); o.patch[prop] = value; o.disabled.delete(prop); bump();
}
export function toggleStyleProp(inst: Instance, prop: string, enabled: boolean): void {
  const o = edit(inst); if (enabled) o.disabled.delete(prop); else o.disabled.add(prop); bump();
}
export function removeStyleProp(inst: Instance, prop: string): void {
  const o = store.get(inst); if (!o) return; delete o.patch[prop]; o.disabled.delete(prop); bump();
}
export function clearStyleOverride(inst: Instance): void {
  if (store.delete(inst)) bump();
}
