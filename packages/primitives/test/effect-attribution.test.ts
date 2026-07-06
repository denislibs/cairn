import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setReactiveDevHooks } from '@cairn/reactivity';
import { activateDevOwner, deactivateDevOwner, getDevOwner } from '@cairn/runtime';
import { Box } from '../src/box';

afterEach(() => { setReactiveDevHooks(null); deactivateDevOwner(); });

describe('primitive effect attribution', () => {
  it("Box's style effect runs under its own dev owner", () => {
    activateDevOwner();
    const owners: Array<{ inst: unknown; label: string } | null> = [];
    setReactiveDevHooks({
      onComputationRun: (n) => { if ((n as { isEffect?: boolean }).isEffect) owners.push(getDevOwner()); },
    });
    let box: any;
    createRoot(() => { box = Box({ style: { backgroundColor: '#ff0000' } }); });
    // At least one effect ran with the Box instance as owner, label 'style'
    const hit = owners.find((o) => o && o.inst === box && o.label === 'style');
    expect(hit).toBeTruthy();
  });
});
