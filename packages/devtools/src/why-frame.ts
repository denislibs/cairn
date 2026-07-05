import { setReactiveDevHooks } from '@cairn/reactivity';

export class WhyFrameTracker {
  private signalWrites = 0;
  private effectRuns = 0;

  start(): void {
    setReactiveDevHooks({
      onSignalWrite: () => { this.signalWrites++; },
      onComputationRun: (n) => { if ((n as { isEffect?: boolean }).isEffect) this.effectRuns++; },
    });
  }

  stop(): void {
    setReactiveDevHooks(null);
  }

  take(): { signalWrites: number; effectRuns: number } {
    const result = { signalWrites: this.signalWrites, effectRuns: this.effectRuns };
    this.signalWrites = 0;
    this.effectRuns = 0;
    return result;
  }
}
