import type { SignalInfo } from './protocol';
import { signalId } from './signal-id';
import { serializeSignalValue } from './signal-value';

interface SignalNode { value: unknown; observers: { isEffect?: boolean }[] | null; name?: string }

export class SignalRegistry {
  private map = new Map<number, WeakRef<SignalNode>>();

  note(node: SignalNode): void {
    this.map.set(signalId(node), new WeakRef(node));
  }

  resolve(id: number): SignalNode | undefined {
    const node = this.map.get(id)?.deref();
    if (!node) this.map.delete(id);
    return node;
  }

  list(): SignalInfo[] {
    const out: SignalInfo[] = [];
    for (const [id, ref] of this.map) {
      const node = ref.deref();
      if (!node) { this.map.delete(id); continue; }
      const { value, type } = serializeSignalValue(node.value);
      const observers = (node.observers ?? []).filter((c) => c.isEffect).length;
      out.push({ id, name: node.name, value, type, observers });
    }
    return out;
  }
}
