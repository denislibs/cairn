export interface EffectOwner { instanceId: number; label: string }

let map = new WeakMap<object, EffectOwner>();

export function tagEffect(node: object, instanceId: number, label: string): void {
  map.set(node, { instanceId, label });
}
export function effectOwnerOf(node: object): EffectOwner | undefined {
  return map.get(node);
}
/** Test-only: drop all tags. */
export function resetEffectOwner(): void { map = new WeakMap(); }
