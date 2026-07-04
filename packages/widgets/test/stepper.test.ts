import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Stepper } from '../src/stepper';

const STEPS = [
  { label: 'Step 1' },
  { label: 'Step 2' },
  { label: 'Step 3' },
];

describe('Stepper — rendering', () => {
  it('container has role list', () => {
    createRoot(() => {
      const s = Stepper({ steps: STEPS, active: 0 });
      expect(s.semantics!.role).toBe('list');
    });
  });

  it('renders N step instances (with connector separators between them)', () => {
    createRoot(() => {
      const s = Stepper({ steps: STEPS, active: 0 });
      // 3 steps + 2 separators = 5 children
      expect(s.children.length).toBe(5);
    });
  });
});

describe('Stepper — active step', () => {
  it('active step has semantics.current = true', () => {
    createRoot(() => {
      const s = Stepper({ steps: STEPS, active: 1 });
      // children: step0 (idx 0), sep (idx 1), step1 (idx 2), sep (idx 3), step2 (idx 4)
      const step1 = s.children[2];
      expect(step1.semantics!.current).toBe(true);
    });
  });

  it('non-active steps do not have current set', () => {
    createRoot(() => {
      const s = Stepper({ steps: STEPS, active: 1 });
      const step0 = s.children[0];
      const step2 = s.children[4];
      expect(step0.semantics!.current).toBeUndefined();
      expect(step2.semantics!.current).toBeUndefined();
    });
  });
});

describe('Stepper — onStepClick', () => {
  it('fires onStepClick with index when a step is clicked', () => {
    createRoot(() => {
      const seen: number[] = [];
      const s = Stepper({ steps: STEPS, active: 0, onStepClick: (i) => seen.push(i) });
      // step 0 is at children[0]; its first child is the circle Box with handlers
      const step0 = s.children[0];
      // The circle is the first child of the stepContent Column
      const circle = step0.children[0];
      circle.handlers?.onClick?.({} as any);
      expect(seen).toEqual([0]);
    });
  });
});
