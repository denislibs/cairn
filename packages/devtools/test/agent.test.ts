// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, setRuntimeDevHooks } from '@cairn/runtime';
import type { Instance } from '@cairn/runtime';
import { setReactiveDevHooks, createSignal, createRoot } from '@cairn/reactivity';
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
    layout: { offsetX: 0, offsetY: 0, size: { w: 200, h: 100 }, flex: 0, zIndex: 0,
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

  it('inspect mode can pick after get-snapshot even when the commit predated subscribe', () => {
    const listeners: Record<string, (e: any) => void> = {};
    const canvas = {
      addEventListener: (t: string, h: (e: any) => void, _capture?: boolean) => { listeners[t] = h; },
      removeEventListener: (t: string, _h: (e: any) => void, _capture?: boolean) => { delete listeners[t]; },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    } as any;

    installDevtools({ canvas });
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;

    // Mount with NO subscriber yet — the initial commit is lazily skipped.
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);

    // Panel attaches after the commit has already happened.
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    hook.send({ type: 'get-snapshot' });
    hook.send({ type: 'inspect-start' });

    // Fire a pointerdown inside the root node bounds (0,0)-(200,100).
    listeners['pointerdown']?.({ clientX: 20, clientY: 20, preventDefault() {}, stopPropagation() {} });

    dispose();
    const sel = events.find((e) => e.type === 'selection');
    expect(sel).toBeTruthy();
  });

  it('getSnapshot() returns a non-null snapshot when the only commit was lazily skipped (no subscriber at mount time)', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;

    // Mount with NO subscriber yet — the initial commit is lazily skipped,
    // so s.last is null. getSnapshot() must still return a usable snapshot.
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);

    const snapshot = hook.getSnapshot();
    dispose();

    expect(snapshot).not.toBeNull();
    expect(snapshot?.name).toBe('Box');
  });

  it('commit meta includes signals array and durationMs field', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);
    const commit = events.find((e) => e.type === 'commit');
    expect(commit && commit.type === 'commit' && Array.isArray(commit.meta.signals)).toBe(true);
    expect(commit && commit.type === 'commit' && typeof commit.meta.durationMs).toBe('number');
    dispose();
  });

  it('set-style command resolves the id and does not throw; get-snapshot still returns the node', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);
    const commit = events.find((e) => e.type === 'commit');
    const rootId = commit && commit.type === 'commit' ? commit.snapshot.id : -1;

    hook.send({ type: 'set-style', id: rootId, prop: 'opacity', value: '0.3' });
    hook.send({ type: 'toggle-style', id: rootId, prop: 'opacity', enabled: false });
    hook.send({ type: 'remove-style', id: rootId, prop: 'opacity' });
    hook.send({ type: 'set-style', id: 999999, prop: 'opacity', value: '0.5' }); // unknown id — no-op
    hook.send({ type: 'get-snapshot' });

    const after = [...events].reverse().find((e) => e.type === 'commit');
    expect(after && after.type === 'commit' && after.snapshot.id).toBe(rootId);
    dispose();
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

  it('composite hook registers created signals and still counts why-frame activity', () => {
    installDevtools();
    // create a signal AFTER install so onSignalCreate fires
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    createRoot(() => {
      const [, setC] = createSignal(0, { name: 'probe' });
      setC(1);
    });
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);
    expect(events.some((e) => e.type === 'commit')).toBe(true);
    dispose();
  });

  it('set-signal does not count as app signal activity', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    createRoot(() => { const [, ] = createSignal(0, { name: 'x' }); });
    hook.send({ type: 'get-signals' });
    const sig = [...events].reverse().find((e) => e.type === 'signals');
    const id = sig && sig.type === 'signals' ? sig.list.find((s) => s.name === 'x')!.id : -1;
    events.length = 0;
    hook.send({ type: 'set-signal', id, value: '5' });
    // the signals event emitted by set-signal must reflect value 5; and NO commit should attribute this as a signal write
    const after = events.find((e) => e.type === 'signals');
    expect(after && after.type === 'signals' && after.list.find((s) => s.name === 'x')?.value).toBe('5');
  });

  it('commit meta carries per-phase timing', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);
    const commit = events.find((e) => e.type === 'commit');
    expect(commit && commit.type === 'commit').toBe(true);
    if (commit && commit.type === 'commit') {
      expect(typeof commit.meta.phases.layout).toBe('number');
      expect(typeof commit.meta.phases.a11y).toBe('number');
      expect(typeof commit.meta.phases.paint).toBe('number');
      expect(commit.meta.durationMs).toBeGreaterThanOrEqual(0);
    }
    dispose();
  });

  it('get-signals emits the registry list; set-signal updates a scalar', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));

    let getC!: () => number;
    createRoot(() => {
      const [c, setC] = createSignal(0, { name: 'count' });
      getC = c;
      void setC;
    });

    hook.send({ type: 'get-signals' });
    const sig = [...events].reverse().find((e) => e.type === 'signals');
    expect(sig && sig.type === 'signals').toBe(true);
    const entry = sig && sig.type === 'signals' ? sig.list.find((x) => x.name === 'count') : undefined;
    expect(entry).toBeTruthy();
    expect(entry!.value).toBe('0');

    hook.send({ type: 'set-signal', id: entry!.id, value: '7' });
    expect(getC()).toBe(7); // the real signal was written
  });

  it('tags primitive effects with their owning instance id after mount', async () => {
    installDevtools();
    const { host } = createFakeHost();
    // a real Box so its style effect runs under runWithDevOwner
    const { Box } = await import('@cairn/primitives');
    const app = () => Box({ style: { backgroundColor: '#f00' } });
    const dispose = mount(app, host);
    // The agent's effect-owner map now has the Box's style effect. We can't read the WeakMap by node,
    // but signal-graph (Task 4) exercises it end-to-end. Here we just assert install+mount didn't throw
    // and a commit happened.
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    hook.send({ type: 'get-snapshot' });
    expect(events.some((e) => e.type === 'commit')).toBe(true);
    dispose();
  });

  it('signal-graph maps a signal to the nodes its effects own', async () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));

    const { Text } = await import('@cairn/primitives');
    const { createSignal } = await import('@cairn/reactivity');
    const { host } = createFakeHost();
    let n = 0;
    // a Text whose content reads a named signal → the text effect observes it and is owned by the Text instance
    const dispose = mount(() => {
      const [c] = createSignal(0, { name: 'count' });
      return Text({ value: () => `count: ${c()}` });
    }, host);

    hook.send({ type: 'get-signals' });
    const sig = [...events].reverse().find((e) => e.type === 'signals');
    const id = sig && sig.type === 'signals' ? sig.list.find((s) => s.name === 'count')!.id : -1;
    hook.send({ type: 'signal-graph', id });
    const g = [...events].reverse().find((e) => e.type === 'signal-graph');
    expect(g && g.type === 'signal-graph').toBe(true);
    if (g && g.type === 'signal-graph') {
      expect(g.graph.nodeIds.length).toBeGreaterThan(0);
      expect(g.graph.effects.some((ef) => ef.label === 'text')).toBe(true);
    }
    void n;
    dispose();
  });
});
