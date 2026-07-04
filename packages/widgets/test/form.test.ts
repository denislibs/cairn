import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { defaultTheme } from '../src/theme';
import { Form, useForm, useFormOptional, useFormField, formContext } from '../src/form';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const announced: string[] = [];
const mockHost = {
  renderer: {} as any,
  textInput: {} as any,
  a11y: {
    announce: (msg: string) => announced.push(msg),
    sync: () => {},
    focus: () => {},
    dispose: () => {},
  },
  metrics: { width: 800, height: 600 },
};

function withTheme(fn: () => void) {
  createRoot(() => {
    runWithContext(themeContext, () => defaultTheme, fn);
  });
}

function withThemeAndHost(fn: () => void) {
  createRoot(() => {
    runWithContext(hostContext, mockHost as any, () =>
      runWithContext(themeContext, () => defaultTheme, fn),
    );
  });
}

// ─── Form — setValue/getValue ─────────────────────────────────────────────────

describe('Form — setValue/getValue', () => {
  it('setValue updates the value accessor', () => {
    withTheme(() => {
      let formCtx: ReturnType<typeof useForm> | null = null;
      Form({
        initialValues: { email: '' },
        children: () => {
          formCtx = useForm();
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      expect(formCtx).not.toBeNull();
      formCtx!.setValue('email', 'test@example.com');
      expect(formCtx!.getValue('email')).toBe('test@example.com');
    });
  });

  it('getValue returns initial value from initialValues', () => {
    withTheme(() => {
      let formCtx: ReturnType<typeof useForm> | null = null;
      Form({
        initialValues: { name: 'Alice' },
        children: () => {
          formCtx = useForm();
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      expect(formCtx!.getValue('name')).toBe('Alice');
    });
  });

  it('multiple fields can be set independently', () => {
    withTheme(() => {
      let formCtx: ReturnType<typeof useForm> | null = null;
      Form({
        initialValues: { first: '', last: '' },
        children: () => {
          formCtx = useForm();
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      formCtx!.setValue('first', 'John');
      formCtx!.setValue('last', 'Doe');
      expect(formCtx!.getValue('first')).toBe('John');
      expect(formCtx!.getValue('last')).toBe('Doe');
    });
  });
});

// ─── Form — submit (failing validator) ────────────────────────────────────────

describe('Form — submit (failing validator)', () => {
  it('submit with a failing field validator sets error and does NOT call onSubmit', () => {
    withThemeAndHost(() => {
      announced.length = 0;
      let formCtx: ReturnType<typeof useForm> | null = null;
      let submitted = false;
      Form({
        initialValues: { email: '' },
        onSubmit: () => { submitted = true; },
        children: () => {
          formCtx = useForm();
          formCtx!.register('email', {
            validate: (v) => (!v ? 'Email is required' : undefined),
          });
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      formCtx!.submit();
      expect(submitted).toBe(false);
      expect(formCtx!.getError('email')).toBe('Email is required');
    });
  });

  it('submit with failing form-level validate sets error and does NOT call onSubmit', () => {
    withThemeAndHost(() => {
      announced.length = 0;
      let formCtx: ReturnType<typeof useForm> | null = null;
      let submitted = false;
      Form({
        initialValues: { age: '' },
        validate: (values) => (!values.age ? { age: 'Age is required' } : undefined),
        onSubmit: () => { submitted = true; },
        children: () => {
          formCtx = useForm();
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      formCtx!.submit();
      expect(submitted).toBe(false);
      expect(formCtx!.getError('age')).toBe('Age is required');
    });
  });

  it('submit clean (no errors) calls onSubmit with values', () => {
    withThemeAndHost(() => {
      announced.length = 0;
      let formCtx: ReturnType<typeof useForm> | null = null;
      let submittedValues: Record<string, any> | null = null;
      Form({
        initialValues: { email: 'valid@example.com' },
        onSubmit: (values) => { submittedValues = values; },
        children: () => {
          formCtx = useForm();
          formCtx!.register('email', {
            validate: (v) => (!v ? 'Required' : undefined),
          });
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      formCtx!.submit();
      expect(submittedValues).not.toBeNull();
      expect(submittedValues!.email).toBe('valid@example.com');
    });
  });
});

// ─── Form — per-field + form-level validators ─────────────────────────────────

describe('Form — per-field + form-level validators', () => {
  it('per-field validator runs on submit', () => {
    withThemeAndHost(() => {
      announced.length = 0;
      let formCtx: ReturnType<typeof useForm> | null = null;
      Form({
        initialValues: { username: '' },
        children: () => {
          formCtx = useForm();
          formCtx!.register('username', {
            validate: (v) => (v.length < 3 ? 'Too short' : undefined),
          });
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      formCtx!.submit();
      expect(formCtx!.getError('username')).toBe('Too short');
    });
  });

  it('form-level validate merges with field errors', () => {
    withThemeAndHost(() => {
      announced.length = 0;
      let formCtx: ReturnType<typeof useForm> | null = null;
      Form({
        initialValues: { a: '', b: '' },
        validate: () => ({ b: 'B is bad' }),
        children: () => {
          formCtx = useForm();
          formCtx!.register('a', {
            validate: (v) => (!v ? 'A required' : undefined),
          });
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      formCtx!.submit();
      expect(formCtx!.getError('a')).toBe('A required');
      expect(formCtx!.getError('b')).toBe('B is bad');
    });
  });

  it('validateOnBlur: blur triggers validation for that field', () => {
    withThemeAndHost(() => {
      announced.length = 0;
      let formCtx: ReturnType<typeof useForm> | null = null;
      Form({
        initialValues: { field: '' },
        validateOnBlur: true,
        children: () => {
          formCtx = useForm();
          formCtx!.register('field', {
            validate: (v) => (!v ? 'Required' : undefined),
          });
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      // Simulate blur on the field
      formCtx!.markTouched('field');
      expect(formCtx!.getError('field')).toBe('Required');
    });
  });
});

// ─── useForm — throws outside ──────────────────────────────────────────────────

describe('useForm — throws outside', () => {
  it('useForm() throws when not inside Form', () => {
    createRoot(() => {
      expect(() => useForm()).toThrow();
    });
  });
});

// ─── useFormField ─────────────────────────────────────────────────────────────

describe('useFormField', () => {
  it('returns value, setValue, error bound to form', () => {
    withTheme(() => {
      let field: ReturnType<typeof useFormField> | null = null;
      Form({
        initialValues: { city: 'Paris' },
        children: () => {
          field = useFormField('city');
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      expect(field!.value()).toBe('Paris');
      field!.setValue('Berlin');
      expect(field!.value()).toBe('Berlin');
    });
  });

  it('markTouched marks the field as touched', () => {
    withTheme(() => {
      let formCtx: ReturnType<typeof useForm> | null = null;
      let field: ReturnType<typeof useFormField> | null = null;
      Form({
        initialValues: { country: '' },
        children: () => {
          formCtx = useForm();
          field = useFormField('country');
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      expect(formCtx!.touched('country')).toBe(false);
      field!.markTouched();
      expect(formCtx!.touched('country')).toBe(true);
    });
  });
});

// ─── Form — announce first error ──────────────────────────────────────────────

describe('Form — announce first error', () => {
  it('submit with errors announces the first error message', () => {
    withThemeAndHost(() => {
      announced.length = 0;
      let formCtx: ReturnType<typeof useForm> | null = null;
      Form({
        initialValues: { name: '' },
        onSubmit: () => {},
        children: () => {
          formCtx = useForm();
          formCtx!.register('name', {
            validate: (v) => (!v ? 'Name is required' : undefined),
          });
          return { layout: {} as any, children: [], handlers: {}, paintSelf: () => {} };
        },
      });
      formCtx!.submit();
      expect(announced.length).toBeGreaterThan(0);
      expect(announced[announced.length - 1]).toBe('Name is required');
    });
  });
});
