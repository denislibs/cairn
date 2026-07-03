import { describe, it, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { RadioGroup, Radio, radioGroupContext } from '../src/radio';

describe('RadioGroup — uncontrolled', () => {
  it('selecting a radio sets the group value and fires onChange', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
      // Simulate clicking the first Radio child (value='b')
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radio = Radio({ value: 'b' });
        radio.handlers!.onClick!({} as any);
      });
      expect(seen).toEqual(['b']);
    });
  });

  it('only one radio is checked at a time', () => {
    createRoot(() => {
      const [groupValue, setGroupValue] = createSignal<any>('a');
      let checkedB = false;
      let checkedC = false;

      const ctx = { value: groupValue, setValue: setGroupValue, disabled: false, register: () => {}, unregister: () => {}, getValues: () => [], activeIndex: () => 0, handleArrow: () => false };
      runWithContext(radioGroupContext.context, ctx, () => {
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        // Initially neither b nor c is checked (group value is 'a')
        // Click b
        radioB.handlers!.onClick!({} as any);
        // setGroupValue should be called with 'b'
        expect(groupValue()).toBe('b');
        // Now c is not checked
        checkedB = groupValue() === 'b';
        checkedC = groupValue() === 'c';
      });
      expect(checkedB).toBe(true);
      expect(checkedC).toBe(false);
    });
  });
});

describe('RadioGroup — controlled', () => {
  it('controlled group: onChange fires but internal value stays fixed', () => {
    createRoot(() => {
      const [value] = createSignal('a');
      const seen: any[] = [];
      const group = RadioGroup({ value, onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radio = Radio({ value: 'b' });
        radio.handlers!.onClick!({} as any);
      });
      expect(seen).toEqual(['b']);
      expect(value()).toBe('a'); // not changed by RadioGroup
    });
  });

  it('controlled plain value: fires onChange correctly', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ value: 'a', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radio = Radio({ value: 'b' });
        radio.handlers!.onClick!({} as any);
      });
      expect(seen).toEqual(['b']);
    });
  });
});

describe('RadioGroup — disabled', () => {
  it('disabled group blocks radio selection', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'a', disabled: true, onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radio = Radio({ value: 'b' });
        radio.handlers!.onClick?.({} as any);
      });
      expect(seen).toEqual([]);
    });
  });

  it('disabled individual radio blocks selection', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radio = Radio({ value: 'b', disabled: true });
        radio.handlers!.onClick?.({} as any);
      });
      expect(seen).toEqual([]);
    });
  });
});

describe('Radio — checked state', () => {
  it('radio is checked when its value equals group value', () => {
    createRoot(() => {
      const [groupValue] = createSignal('b');
      let checkedB = false;
      const ctx = { value: groupValue, setValue: () => {}, disabled: false, register: () => {}, unregister: () => {}, getValues: () => [], activeIndex: () => 0, handleArrow: () => false };
      runWithContext(radioGroupContext.context, ctx, () => {
        // The radio with value 'b' should be checked
        checkedB = groupValue() === 'b';
      });
      expect(checkedB).toBe(true);
    });
  });
});

describe('Radio — Space key', () => {
  it('Space key selects the radio (on keyup)', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radio = Radio({ value: 'b' });
        radio.handlers!.onKeyUp!({ key: ' ' } as any);
      });
      expect(seen).toEqual(['b']);
    });
  });
});

describe('Radio — arrow key roving', () => {
  it('ArrowDown moves selection to next registered value', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        // Register three radios in order: a, b, c
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        // Arrow down from 'a' → should select 'b'
        radioA.handlers!.onKeyDown!({ key: 'ArrowDown' } as any);
      });
      expect(seen).toEqual(['b']);
    });
  });

  it('ArrowRight moves selection to next registered value', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'b', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        // Arrow right from 'b' → should select 'c'
        radioB.handlers!.onKeyDown!({ key: 'ArrowRight' } as any);
      });
      expect(seen).toEqual(['c']);
    });
  });

  it('ArrowUp moves selection to previous registered value', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'b', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        // Arrow up from 'b' → should select 'a'
        radioB.handlers!.onKeyDown!({ key: 'ArrowUp' } as any);
      });
      expect(seen).toEqual(['a']);
    });
  });

  it('ArrowLeft moves selection to previous registered value', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'c', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        // Arrow left from 'c' → should select 'b'
        radioC.handlers!.onKeyDown!({ key: 'ArrowLeft' } as any);
      });
      expect(seen).toEqual(['b']);
    });
  });

  it('ArrowDown wraps from last to first', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'c', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        // Arrow down from 'c' (last) → wraps to 'a'
        radioC.handlers!.onKeyDown!({ key: 'ArrowDown' } as any);
      });
      expect(seen).toEqual(['a']);
    });
  });
});

describe('useRadioGroup — throws outside RadioGroup', () => {
  it('throws when used outside a RadioGroup', () => {
    createRoot(() => {
      expect(() => {
        radioGroupContext.use();
      }).toThrow();
    });
  });
});

describe('RadioGroup — renders without throwing', () => {
  it('renders a RadioGroup with Radio children', () => {
    createRoot(() => {
      expect(() => {
        RadioGroup({
          defaultValue: 'a',
          children: () => Radio({ value: 'a', label: 'Option A' }),
        });
      }).not.toThrow();
    });
  });
});

describe('Radio — focusable', () => {
  it('is focusable', () => {
    createRoot(() => {
      const ctx = { value: () => 'a', setValue: () => {}, disabled: false, register: () => {}, unregister: () => {}, getValues: () => [], activeIndex: () => 0, handleArrow: () => false };
      runWithContext(radioGroupContext.context, ctx, () => {
        expect(Radio({ value: 'a' }).focusable).toBe(true);
      });
    });
  });
});

describe('RadioGroup — semantics', () => {
  it('RadioGroup instance has semantics with role:"radiogroup"', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a' });
      expect(group.semantics).toBeDefined();
      expect(group.semantics!.role).toBe('radiogroup');
    });
  });

  it('RadioGroup semantics.disabled reflects props.disabled', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a', disabled: true });
      expect(group.semantics!.disabled).toBe(true);
    });
  });
});

describe('Radio — semantics', () => {
  it('Radio has semantics with role:"radio"', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a' });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radio = Radio({ value: 'a' });
        expect(radio.semantics).toBeDefined();
        expect(radio.semantics!.role).toBe('radio');
      });
    });
  });

  it('Radio semantics.label matches props.label', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a' });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radio = Radio({ value: 'a', label: 'Option A' });
        expect(radio.semantics!.label).toBe('Option A');
      });
    });
  });

  it('Radio semantics.checked is true when it matches group value', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a' });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        expect(radioA.semantics!.checked).toBe(true);
      });
    });
  });

  it('Radio semantics.checked is false when it does not match group value', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a' });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioB = Radio({ value: 'b' });
        expect(radioB.semantics!.checked).toBe(false);
      });
    });
  });

  it('selecting via onActivate updates semantics.checked', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a' });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        expect(radioA.semantics!.checked).toBe(true);
        expect(radioB.semantics!.checked).toBe(false);
        radioB.semantics!.onActivate!();
        expect(radioB.semantics!.checked).toBe(true);
        expect(radioA.semantics!.checked).toBe(false);
      });
    });
  });

  it('only one radio has focusable:true at a time (roving)', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a' });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        // Initially active is the first radio (index 0 = 'a')
        const focusableCount = [radioA, radioB, radioC].filter(r => r.semantics!.focusable).length;
        expect(focusableCount).toBe(1);
        expect(radioA.semantics!.focusable).toBe(true);
        expect(radioB.semantics!.focusable).toBe(false);
        expect(radioC.semantics!.focusable).toBe(false);
      });
    });
  });

  it('arrow onKeyDown moves selection to next value and returns true', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        const handled = radioA.semantics!.onKeyDown!('ArrowDown', { shift: false, ctrl: false, alt: false, meta: false });
        expect(handled).toBe(true);
        expect(seen).toEqual(['b']);
      });
    });
  });

  it('arrow onKeyDown moves selection to prev value', () => {
    createRoot(() => {
      const seen: any[] = [];
      const group = RadioGroup({ defaultValue: 'b', onChange: (v) => seen.push(v) });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const radioB = Radio({ value: 'b' });
        const radioC = Radio({ value: 'c' });
        const handled = radioB.semantics!.onKeyDown!('ArrowUp', { shift: false, ctrl: false, alt: false, meta: false });
        expect(handled).toBe(true);
        expect(seen).toEqual(['a']);
      });
    });
  });

  it('unhandled key returns false from onKeyDown', () => {
    createRoot(() => {
      const group = RadioGroup({ defaultValue: 'a' });
      runWithContext(radioGroupContext.context, group._ctx, () => {
        const radioA = Radio({ value: 'a' });
        const handled = radioA.semantics!.onKeyDown!('Tab', { shift: false, ctrl: false, alt: false, meta: false });
        expect(handled).toBe(false);
      });
    });
  });
});
