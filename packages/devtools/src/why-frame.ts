import type { SignalRef } from './protocol';
import { signalId } from './signal-id';

interface SignalNode { name?: string }

/** Accumulates per-frame reactive activity. The agent owns setReactiveDevHooks and calls
 *  noteWrite/noteEffectRun; take() drains the frame. */
export class WhyFrameTracker {
  private signalWrites = 0;
  private effectRuns = 0;
  private changed = new Map<number, SignalRef>();

  noteWrite(node: object): void {
    this.signalWrites++;
    const id = signalId(node);
    if (!this.changed.has(id)) this.changed.set(id, { id, name: (node as SignalNode).name });
  }

  noteEffectRun(node: object): void {
    if ((node as { isEffect?: boolean }).isEffect) this.effectRuns++;
  }

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
