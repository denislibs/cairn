import { describe, it, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { Field, useField, useFieldOptional, fieldContext } from '../src/field';
import type { Instance } from '@cairn/runtime';

const fakeInstance = (): Instance => ({ layout: {} as any, children: [], handlers: {}, paintSelf: () => {} });

describe('Field — context exposes invalid/disabled', () => {
  it('context has the correct invalid accessor and disabled flag', () => {
    createRoot(() => {
      let ctxValue: ReturnType<typeof useFieldOptional> = null;
      Field({
        invalid: () => true,
        disabled: true,
        children: () => {
          ctxValue = useFieldOptional();
          return fakeInstance();
        },
      });
      expect(ctxValue).not.toBeNull();
      expect(ctxValue!.invalid()).toBe(true);
      expect(ctxValue!.disabled).toBe(true);
    });
  });

  it('invalid=false gives false', () => {
    createRoot(() => {
      let ctxValue: ReturnType<typeof useFieldOptional> = null;
      Field({
        invalid: () => false,
        disabled: false,
        children: () => {
          ctxValue = useFieldOptional();
          return fakeInstance();
        },
      });
      expect(ctxValue!.invalid()).toBe(false);
      expect(ctxValue!.disabled).toBe(false);
    });
  });

  it('id is a symbol', () => {
    createRoot(() => {
      let ctxValue: ReturnType<typeof useFieldOptional> = null;
      Field({
        children: () => {
          ctxValue = useFieldOptional();
          return fakeInstance();
        },
      });
      expect(typeof ctxValue!.id).toBe('symbol');
    });
  });
});

describe('Field — renders without throwing', () => {
  it('renders Field with label/helper/error parts', () => {
    createRoot(() => {
      expect(() =>
        Field({
          invalid: () => false,
          children: () =>
            Field.Label({ children: 'My label' }),
        }),
      ).not.toThrow();
    });
  });

  it('Field.Helper renders a Text node', () => {
    createRoot(() => {
      expect(() => Field.Helper({ children: 'Helper text' })).not.toThrow();
    });
  });

  it('Field.Error renders without throwing', () => {
    createRoot(() => {
      // Must be inside a Field for Show to work
      expect(() =>
        Field({
          invalid: () => true,
          children: () => Field.Error({ children: 'Error msg' }),
        }),
      ).not.toThrow();
    });
  });
});

describe('Field.Error — Show gate', () => {
  it('Field.Error children array is empty when invalid=false', () => {
    createRoot(() => {
      const [invalid, setInvalid] = createSignal(false);
      let errorInst: ReturnType<typeof Field.Error> | null = null;
      Field({
        invalid,
        children: () => {
          errorInst = Field.Error({ children: 'Oops' });
          return errorInst;
        },
      });
      // Show is used: when invalid=false, the error Show has no children
      expect(errorInst!.children).toHaveLength(0);
    });
  });

  it('Field.Error children array is non-empty when invalid=true', () => {
    createRoot(() => {
      const [invalid, setInvalid] = createSignal(true);
      let errorInst: ReturnType<typeof Field.Error> | null = null;
      Field({
        invalid,
        children: () => {
          errorInst = Field.Error({ children: 'Oops' });
          return errorInst;
        },
      });
      // Show is used: when invalid=true, the error Show has children
      expect(errorInst!.children).toHaveLength(1);
    });
  });
});

describe('useFieldOptional — outside Field returns null', () => {
  it('returns null when not inside a Field', () => {
    createRoot(() => {
      const val = useFieldOptional();
      expect(val).toBeNull();
    });
  });
});

describe('useField — throws outside Field', () => {
  it('throws when called outside a Field', () => {
    createRoot(() => {
      expect(() => useField()).toThrow();
    });
  });

  it('does not throw when called inside a Field', () => {
    createRoot(() => {
      let threw = false;
      Field({
        children: () => {
          try {
            useField();
          } catch {
            threw = true;
          }
          return fakeInstance();
        },
      });
      expect(threw).toBe(false);
    });
  });
});

describe('useFieldOptional — inside Field returns value', () => {
  it('returns context value inside a Field', () => {
    createRoot(() => {
      let ctxValue: ReturnType<typeof useFieldOptional> = null;
      Field({
        invalid: () => true,
        children: () => {
          ctxValue = useFieldOptional();
          return fakeInstance();
        },
      });
      expect(ctxValue).not.toBeNull();
      expect(ctxValue!.invalid()).toBe(true);
    });
  });
});

describe('Field — label text in context', () => {
  it('Field context exposes labelText after Field.Label renders', () => {
    createRoot(() => {
      let ctxValue: ReturnType<typeof useFieldOptional> = null;
      Field({
        children: () => {
          Field.Label({ children: 'My Field' });
          ctxValue = useFieldOptional();
          return fakeInstance();
        },
      });
      expect(ctxValue).not.toBeNull();
      expect((ctxValue as any)!.labelText).toBe('My Field');
    });
  });

  it('Field context labelText is empty string when no Field.Label rendered', () => {
    createRoot(() => {
      let ctxValue: ReturnType<typeof useFieldOptional> = null;
      Field({
        children: () => {
          ctxValue = useFieldOptional();
          return fakeInstance();
        },
      });
      expect((ctxValue as any)!.labelText).toBe('');
    });
  });
});

describe('Field.Error — announce on invalid', () => {
  it('calls announce when invalid flips from false to true', () => {
    createRoot(() => {
      const [invalid, setInvalid] = createSignal(false);
      const announced: string[] = [];
      const fakeHost = {
        a11y: { announce: (msg: string) => announced.push(msg) },
      };
      runWithContext(hostContext, fakeHost as any, () => {
        Field({
          invalid,
          children: () => {
            Field.Error({ children: 'This field is required' });
            return fakeInstance();
          },
        });
      });
      expect(announced).toHaveLength(0);
      // Flip invalid to true → should announce
      setInvalid(true);
      expect(announced).toHaveLength(1);
      expect(announced[0]).toBe('This field is required');
    });
  });

  it('does not announce again when already invalid (no re-announce on every frame)', () => {
    createRoot(() => {
      const [invalid, setInvalid] = createSignal(true);
      const announced: string[] = [];
      const fakeHost = {
        a11y: { announce: (msg: string) => announced.push(msg) },
      };
      runWithContext(hostContext, fakeHost as any, () => {
        Field({
          invalid,
          children: () => {
            Field.Error({ children: 'Error!' });
            return fakeInstance();
          },
        });
      });
      // Already true on mount: announces once on initial flip
      const countAfterMount = announced.length;
      // Setting same value again should NOT re-announce
      setInvalid(true);
      expect(announced.length).toBe(countAfterMount);
    });
  });

  it('does not call announce when invalid flips from true to false', () => {
    createRoot(() => {
      const [invalid, setInvalid] = createSignal(true);
      const announced: string[] = [];
      const fakeHost = {
        a11y: { announce: (msg: string) => announced.push(msg) },
      };
      runWithContext(hostContext, fakeHost as any, () => {
        Field({
          invalid,
          children: () => {
            Field.Error({ children: 'Error!' });
            return fakeInstance();
          },
        });
      });
      const countAfterMount = announced.length;
      setInvalid(false);
      // Going false→false or true→false should not add a new announcement
      expect(announced.length).toBe(countAfterMount);
    });
  });
});
