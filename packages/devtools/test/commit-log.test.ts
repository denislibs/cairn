import { describe, it, expect } from 'vitest';
import { CommitLog } from '../src/commit-log';

describe('CommitLog', () => {
  it('stores entries in order', () => {
    const log = new CommitLog(10);
    log.push({ frame: 1, changedIds: [1], signalWrites: 2, effectRuns: 1 });
    log.push({ frame: 2, changedIds: [], signalWrites: 0, effectRuns: 0 });
    expect(log.entries().map((e) => e.frame)).toEqual([1, 2]);
  });

  it('evicts oldest beyond capacity', () => {
    const log = new CommitLog(2);
    log.push({ frame: 1, changedIds: [], signalWrites: 0, effectRuns: 0 });
    log.push({ frame: 2, changedIds: [], signalWrites: 0, effectRuns: 0 });
    log.push({ frame: 3, changedIds: [], signalWrites: 0, effectRuns: 0 });
    expect(log.entries().map((e) => e.frame)).toEqual([2, 3]);
  });

  it('clears', () => {
    const log = new CommitLog();
    log.push({ frame: 1, changedIds: [], signalWrites: 0, effectRuns: 0 });
    log.clear();
    expect(log.entries()).toEqual([]);
  });
});
