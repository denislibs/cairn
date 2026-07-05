import { describe, it, expect, beforeEach } from 'vitest';
import { WhyFrameTracker } from '../src/why-frame';
import { resetSignalIds, signalId } from '../src/signal-id';

function node(name?: string, isEffect = false): any { return { name, isEffect }; }

describe('WhyFrameTracker', () => {
  beforeEach(() => resetSignalIds());

  it('counts writes/effect-runs and dedups changed signals by id', () => {
    const t = new WhyFrameTracker();
    const a = node('a'); const b = node();
    t.noteWrite(a); t.noteWrite(a); t.noteWrite(b); // a twice -> one entry
    t.noteEffectRun(node(undefined, true));
    t.noteEffectRun(node(undefined, false)); // not an effect
    const r = t.take();
    expect(r.signalWrites).toBe(3);
    expect(r.effectRuns).toBe(1);
    expect(r.signals.length).toBe(2);
    expect(r.signals.find((s) => s.name === 'a')?.id).toBe(signalId(a));
  });

  it('take() resets state', () => {
    const t = new WhyFrameTracker();
    t.noteWrite(node('x'));
    t.take();
    expect(t.take()).toEqual({ signalWrites: 0, effectRuns: 0, signals: [] });
  });
});
