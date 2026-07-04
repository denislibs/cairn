import { describe, it, expect, afterEach } from 'vitest';
import { mount, setRuntimeDevHooks } from '@cairn/runtime';
import type { Instance } from '@cairn/runtime';
import { setReactiveDevHooks, createSignal } from '@cairn/reactivity';
import { installDevtools, uninstallDevtools } from '../src/agent';
import type { AgentEvent } from '../src/protocol';
import { createFakeHost } from '../../runtime/test/fake-host';

afterEach(() => {
  uninstallDevtools();
  setRuntimeDevHooks(null);
  setReactiveDevHooks(null);
  delete (globalThis as { __CAIRN_DEVTOOLS_HOOK__?: unknown }).__CAIRN_DEVTOOLS_HOOK__;
});

function appRoot(): Instance {
  return {
    layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, flex: 0, zIndex: 0,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      layout: () => ({ w: 200, h: 100 }), constructor: { name: 'BoxNode' } } as any,
    children: [], paintSelf() {},
  };
}

describe('installDevtools', () => {
  it('publishes a hook on globalThis and emits hello on subscribe', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    expect(hook).toBeTruthy();
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    expect(events[0]).toEqual({ type: 'hello', version: hook.version });
  });

  it('emits a commit event when a mounted app renders a frame', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));

    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);

    const commit = events.find((e) => e.type === 'commit');
    expect(commit).toBeTruthy();
    if (commit && commit.type === 'commit') {
      expect(commit.snapshot.name).toBe('Box');
      expect(commit.meta.frame).toBeGreaterThanOrEqual(1);
    }
    dispose();
  });

  it('is idempotent', () => {
    installDevtools();
    const first = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    installDevtools();
    expect((globalThis as any).__CAIRN_DEVTOOLS_HOOK__).toBe(first);
  });

  it('get-snapshot serializes the last root even if the only commit happened before subscribe', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;

    // Mount with NO subscriber yet — the initial commit is lazily skipped.
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);

    // Now a panel attaches and asks for the current tree.
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    hook.send({ type: 'get-snapshot' });

    dispose();

    const commit = events.find((e) => e.type === 'commit');
    expect(commit).toBeTruthy();
    if (commit && commit.type === 'commit') {
      expect(commit.snapshot.name).toBe('Box');
    }
  });

  it('get-snapshot reply carries the real last-frame meta, not hardcoded zeros', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));

    // Write a signal AFTER the tracker is started so signalWrites > 0 in the commit meta.
    const [, setVal] = createSignal(0);
    setVal(1);

    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);

    // Find the last real commit emitted during mount
    const realCommit = [...events].reverse().find((e) => e.type === 'commit');
    expect(realCommit).toBeTruthy();
    if (!realCommit || realCommit.type !== 'commit') return;
    const realMeta = realCommit.meta;
    // Sanity: the signal write should have been counted
    expect(realMeta.signalWrites).toBeGreaterThanOrEqual(1);

    // Now ask for a snapshot replay — it must echo back the same meta (not zeros)
    const beforeCount = events.length;
    hook.send({ type: 'get-snapshot' });
    const replayCommit = events[beforeCount];
    expect(replayCommit).toBeTruthy();
    expect(replayCommit.type).toBe('commit');
    if (replayCommit.type === 'commit') {
      expect(replayCommit.meta).toEqual(realMeta);
    }

    dispose();
  });
});
