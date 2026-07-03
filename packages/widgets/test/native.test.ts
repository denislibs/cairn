import { describe, it, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';

// --- keys tests ---
import {
  ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT,
  HOME, END, ESCAPE, ENTER, SPACE, PAGE_UP, PAGE_DOWN,
  isArrow, isVerticalArrow, isHorizontalArrow,
} from '../src/native/keys';

describe('keys', () => {
  it('constants are correct', () => {
    expect(ARROW_UP).toBe('ArrowUp');
    expect(ARROW_DOWN).toBe('ArrowDown');
    expect(ARROW_LEFT).toBe('ArrowLeft');
    expect(ARROW_RIGHT).toBe('ArrowRight');
    expect(HOME).toBe('Home');
    expect(END).toBe('End');
    expect(ESCAPE).toBe('Escape');
    expect(ENTER).toBe('Enter');
    expect(SPACE).toBe(' ');
    expect(PAGE_UP).toBe('PageUp');
    expect(PAGE_DOWN).toBe('PageDown');
  });

  it('isArrow', () => {
    expect(isArrow('ArrowUp')).toBe(true);
    expect(isArrow('ArrowDown')).toBe(true);
    expect(isArrow('ArrowLeft')).toBe(true);
    expect(isArrow('ArrowRight')).toBe(true);
    expect(isArrow('Enter')).toBe(false);
    expect(isArrow('Home')).toBe(false);
  });

  it('isVerticalArrow', () => {
    expect(isVerticalArrow('ArrowUp')).toBe(true);
    expect(isVerticalArrow('ArrowDown')).toBe(true);
    expect(isVerticalArrow('ArrowLeft')).toBe(false);
  });

  it('isHorizontalArrow', () => {
    expect(isHorizontalArrow('ArrowLeft')).toBe(true);
    expect(isHorizontalArrow('ArrowRight')).toBe(true);
    expect(isHorizontalArrow('ArrowUp')).toBe(false);
  });
});

// --- roving tests ---
import { createRoving } from '../src/native/roving';

describe('createRoving', () => {
  it('ArrowDown moves forward (vertical orientation default)', () => {
    createRoot(() => {
      const [count] = createSignal(5);
      const { active, handleKey } = createRoving({ count });
      expect(active()).toBe(0);
      const handled = handleKey('ArrowDown');
      expect(handled).toBe(true);
      expect(active()).toBe(1);
    });
  });

  it('ArrowUp moves backward', () => {
    createRoot(() => {
      const [count] = createSignal(5);
      const { active, handleKey } = createRoving({ count, initial: 2 });
      handleKey('ArrowUp');
      expect(active()).toBe(1);
    });
  });

  it('Home goes to 0', () => {
    createRoot(() => {
      const [count] = createSignal(5);
      const { active, handleKey } = createRoving({ count, initial: 3 });
      const handled = handleKey('Home');
      expect(handled).toBe(true);
      expect(active()).toBe(0);
    });
  });

  it('End goes to count-1', () => {
    createRoot(() => {
      const [count] = createSignal(5);
      const { active, handleKey } = createRoving({ count });
      const handled = handleKey('End');
      expect(handled).toBe(true);
      expect(active()).toBe(4);
    });
  });

  it('no loop — clamps at boundaries', () => {
    createRoot(() => {
      const [count] = createSignal(3);
      const { active, handleKey } = createRoving({ count, loop: false });
      // Already at 0, ArrowUp should stay at 0
      handleKey('ArrowUp');
      expect(active()).toBe(0);

      handleKey('End');
      handleKey('ArrowDown');
      expect(active()).toBe(2); // clamped
    });
  });

  it('loop wraps around', () => {
    createRoot(() => {
      const [count] = createSignal(3);
      const { active, handleKey } = createRoving({ count, loop: true });
      // At 0, ArrowUp wraps to 2
      handleKey('ArrowUp');
      expect(active()).toBe(2);
    });
  });

  it('horizontal orientation: ArrowLeft/Right work, ArrowUp/Down do not', () => {
    createRoot(() => {
      const [count] = createSignal(5);
      const { active, handleKey } = createRoving({ count, orientation: 'horizontal' });
      expect(handleKey('ArrowRight')).toBe(true);
      expect(active()).toBe(1);
      expect(handleKey('ArrowDown')).toBe(false); // not handled
      expect(active()).toBe(1); // unchanged
    });
  });

  it('both orientation: all arrows work', () => {
    createRoot(() => {
      const [count] = createSignal(5);
      const { active, handleKey } = createRoving({ count, orientation: 'both', initial: 2 });
      handleKey('ArrowUp');
      expect(active()).toBe(1);
      handleKey('ArrowRight');
      expect(active()).toBe(2);
    });
  });

  it('unrecognized key returns false', () => {
    createRoot(() => {
      const [count] = createSignal(5);
      const { handleKey } = createRoving({ count });
      expect(handleKey('Tab')).toBe(false);
      expect(handleKey('Escape')).toBe(false);
    });
  });
});

// --- typeahead tests ---
import { createTypeahead } from '../src/native/typeahead';

describe('createTypeahead', () => {
  it('matches a label prefix and calls onMatch', () => {
    let matched = -1;
    const labels = ['Apple', 'Banana', 'Cherry'];
    const { handleChar } = createTypeahead({
      getLabels: () => labels,
      onMatch: (i) => { matched = i; },
    });
    const handled = handleChar('b');
    expect(handled).toBe(true);
    expect(matched).toBe(1); // 'Banana'
  });

  it('is case-insensitive', () => {
    let matched = -1;
    const { handleChar } = createTypeahead({
      getLabels: () => ['Apple', 'Banana'],
      onMatch: (i) => { matched = i; },
    });
    handleChar('A');
    expect(matched).toBe(0);
  });

  it('buffers multiple chars for multi-char prefix', () => {
    let matched = -1;
    const labels = ['Apple', 'Apricot', 'Banana'];
    const { handleChar } = createTypeahead({
      getLabels: () => labels,
      onMatch: (i) => { matched = i; },
    });
    handleChar('a');
    expect(matched).toBe(0); // 'Apple' first
    handleChar('p');
    // buffer is now 'ap'
    handleChar('r');
    // buffer is now 'apr' — matches 'Apricot'
    expect(matched).toBe(1);
  });

  it('returns false when no match', () => {
    const { handleChar } = createTypeahead({
      getLabels: () => ['Apple', 'Banana'],
      onMatch: () => {},
    });
    expect(handleChar('z')).toBe(false);
  });

  it('resets buffer after timeout and matches from fresh start', () => {
    let matched = -1;
    let fakeTime = 0;
    const { handleChar } = createTypeahead({
      getLabels: () => ['Apple', 'Banana'],
      onMatch: (i) => { matched = i; },
      timeoutMs: 500,
      now: () => fakeTime,
    });

    handleChar('a'); // matches Apple at t=0
    expect(matched).toBe(0);

    // Jump time past timeout
    fakeTime = 600;
    handleChar('b'); // buffer resets, then 'b' → matches Banana
    expect(matched).toBe(1);
  });

  it('does not reset buffer when called within timeout', () => {
    let matched = -1;
    let fakeTime = 0;
    const { handleChar } = createTypeahead({
      getLabels: () => ['Apple', 'Apricot', 'Banana'],
      onMatch: (i) => { matched = i; },
      timeoutMs: 500,
      now: () => fakeTime,
    });

    handleChar('a'); // buffer='a', matches Apple
    fakeTime = 200; // within timeout
    handleChar('p'); // buffer='ap', still matches Apple
    fakeTime = 300;
    handleChar('r'); // buffer='apr', matches Apricot
    expect(matched).toBe(1);
  });

  it('ignores multi-char strings (non-printable keys)', () => {
    const { handleChar } = createTypeahead({
      getLabels: () => ['Apple'],
      onMatch: () => {},
    });
    expect(handleChar('Enter')).toBe(false);
    expect(handleChar('ArrowDown')).toBe(false);
  });
});

// --- announce tests ---
import { useAnnounce } from '../src/native/announce';

describe('useAnnounce', () => {
  it('calls host.a11y.announce when available', () => {
    createRoot(() => {
      let announced = '';
      const fakeHost = {
        a11y: { announce: (msg: string) => { announced = msg; } },
      };

      runWithContext(hostContext, fakeHost as any, () => {
        const announce = useAnnounce();
        announce('Hello from a11y');
      });

      expect(announced).toBe('Hello from a11y');
    });
  });

  it('is a no-op when host.a11y is absent', () => {
    createRoot(() => {
      const fakeHost = {}; // no a11y
      runWithContext(hostContext, fakeHost as any, () => {
        const announce = useAnnounce();
        expect(() => announce('test')).not.toThrow();
      });
    });
  });
});
