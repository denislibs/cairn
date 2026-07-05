import { setReactiveDevHooks } from '@cairn/reactivity';
import type { SignalRef } from './protocol';

interface SignalNode { name?: string }

export class WhyFrameTracker {
  private signalWrites = 0;
  private effectRuns = 0;
  private ids = new WeakMap<object, number>();
  private nextId = 1;
  private changed = new Map<number, SignalRef>();

  private idOf(node: object): number {
    let id = this.ids.get(node);
    if (id === undefined) { id = this.nextId++; this.ids.set(node, id); }
    return id;
  }

  start(): void {
    setReactiveDevHooks({
      // Mint an id at creation time so ids reflect signal creation order and are ready before the first write.
      onSignalCreate: (n) => { this.idOf(n as object); },
      onSignalWrite: (n) => {
        this.signalWrites++;
        const id = this.idOf(n as object);
        if (!this.changed.has(id)) {
          this.changed.set(id, { id, name: (n as SignalNode).name });
        }
      },
      onComputationRun: (n) => { if ((n as { isEffect?: boolean }).isEffect) this.effectRuns++; },
    });
  }

  stop(): void { setReactiveDevHooks(null); }

  take(): { signalWrites: number; effectRuns: number; signals: SignalRef[] } {
    const result = {
      signalWrites: this.signalWrites,
      effectRuns: this.effectRuns,
      signals: [...this.changed.values()],
    };
    this.signalWrites = 0;
    this.effectRuns = 0;
    this.changed.clear();
    return result;
  }
}
