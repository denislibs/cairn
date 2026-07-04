import { describe, it, expect, afterEach } from 'vitest';
import { mount, setRuntimeDevHooks } from '@cairn/runtime';
import type { Instance } from '@cairn/runtime';
import { setReactiveDevHooks } from '@cairn/reactivity';
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
});
