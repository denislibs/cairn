export interface CommitEntry {
  frame: number;
  changedIds: number[];
  signalWrites: number;
  effectRuns: number;
  signals: { id: number; name?: string }[];
  durationMs: number;
}

export class CommitLog {
  private buf: CommitEntry[] = [];
  constructor(private capacity = 100) {}

  push(entry: CommitEntry): void {
    this.buf.push(entry);
    if (this.buf.length > this.capacity) this.buf.shift();
  }

  entries(): CommitEntry[] {
    return this.buf.slice();
  }

  clear(): void {
    this.buf = [];
  }
}
