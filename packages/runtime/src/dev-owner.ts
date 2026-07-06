import type { Instance } from './instance';

export interface DevOwner { inst: Instance; label: string }

let current: DevOwner | null = null;
let active = false;

/** Enable ambient owner tracking (called by installDevtools). Prod stays inert. */
export function activateDevOwner(): void { active = true; }
export function deactivateDevOwner(): void { active = false; current = null; }

/** Run `fn` with `inst`/`label` as the ambient dev owner (restored afterwards).
 *  Inert (direct call) when not activated — zero prod cost.
 *  NOTE: the owner is live ONLY during `fn`. Effects created inside `fn` run their
 *  FIRST pass synchronously here, so a devtools hook can tag effect→instance at that
 *  moment; on later re-runs the ambient owner is null (tag once, cache it). */
export function runWithDevOwner<T>(inst: Instance, label: string, fn: () => T): T {
  if (!active) return fn();
  const prev = current;
  current = { inst, label };
  try { return fn(); } finally { current = prev; }
}

export function getDevOwner(): DevOwner | null { return active ? current : null; }
