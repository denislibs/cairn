import type { Instance } from '@cairn/runtime';
import { Provider, hostContext } from '@cairn/runtime';
import { createSignal, useContext, type Accessor } from '@cairn/reactivity';
import { Column, type StyleInput } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useAnnounce } from './native/announce';

// ─── Context value ────────────────────────────────────────────────────────────

export interface FormContextValue {
  values: Accessor<Record<string, any>>;
  errors: Accessor<Record<string, string>>;
  getValue: (name: string) => any;
  setValue: (name: string, v: any) => void;
  getError: (name: string) => string | undefined;
  register: (name: string, opts?: { validate?: (v: any, values: Record<string, any>) => string | undefined }) => void;
  submit: () => void;
  touched: (name: string) => boolean;
  markTouched: (name: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const formContext = createCompoundContext<FormContextValue>('Form');

/** Throwing: must be inside a Form. */
export function useForm(): FormContextValue {
  return formContext.use();
}

/** Non-throwing: returns null outside a Form. */
export function useFormOptional(): FormContextValue | null {
  return useContext(formContext.context);
}

/** Bound field accessors derived from the form context. */
export function useFormField(name: string): {
  value: Accessor<any>;
  setValue: (v: any) => void;
  error: Accessor<string | undefined>;
  markTouched: () => void;
} {
  const form = useForm();
  return {
    value: () => form.getValue(name),
    setValue: (v: any) => form.setValue(name, v),
    error: () => form.getError(name),
    markTouched: () => form.markTouched(name),
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FormProps {
  initialValues?: Record<string, any>;
  validate?: (values: Record<string, any>) => Record<string, string> | undefined;
  onSubmit?: (values: Record<string, any>) => void;
  validateOnBlur?: boolean;
  children?: () => Instance;
  style?: StyleInput;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function Form(props: FormProps): Instance {
  const [values, setValues] = createSignal<Record<string, any>>(props.initialValues ?? {});
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [touchedMap, setTouchedMap] = createSignal<Record<string, boolean>>({});

  // Per-field validators stored outside reactive system (just a Map)
  const fieldValidators = new Map<string, (v: any, values: Record<string, any>) => string | undefined>();

  // useAnnounce called once at Form construction (not inside submit)
  const host = useContext(hostContext);
  const announce = host
    ? useAnnounce()
    : (_msg: string, _assertive?: boolean) => {};

  const runValidation = (currentValues: Record<string, any>): Record<string, string> => {
    const merged: Record<string, string> = {};

    // Per-field validators
    for (const [fieldName, validator] of fieldValidators.entries()) {
      const err = validator(currentValues[fieldName], currentValues);
      if (err) merged[fieldName] = err;
    }

    // Form-level validate merges on top
    if (props.validate) {
      const formErrors = props.validate(currentValues);
      if (formErrors) {
        Object.assign(merged, formErrors);
      }
    }

    return merged;
  };

  const ctx: FormContextValue = {
    values,
    errors,

    getValue(name: string): any {
      return values()[name];
    },

    setValue(name: string, v: any): void {
      setValues((prev) => ({ ...prev, [name]: v }));
    },

    getError(name: string): string | undefined {
      return errors()[name];
    },

    register(name: string, opts?: { validate?: (v: any, values: Record<string, any>) => string | undefined }): void {
      if (opts?.validate) {
        fieldValidators.set(name, opts.validate);
      }
      // Initialize value if not already present
      setValues((prev) => {
        if (!(name in prev)) {
          return { ...prev, [name]: '' };
        }
        return prev;
      });
    },

    submit(): void {
      const currentValues = values();
      const merged = runValidation(currentValues);

      if (Object.keys(merged).length > 0) {
        setErrors(merged);
        // Announce first error (assertive)
        const firstError = Object.values(merged)[0];
        if (firstError) {
          announce(firstError, true);
        }
        return;
      }

      // No errors — clear and call onSubmit
      setErrors({});
      props.onSubmit?.(currentValues);
    },

    touched(name: string): boolean {
      return !!touchedMap()[name];
    },

    markTouched(name: string): void {
      setTouchedMap((prev) => ({ ...prev, [name]: true }));

      // validateOnBlur: run validation for this field immediately on touch
      if (props.validateOnBlur) {
        const currentValues = values();
        const merged = runValidation(currentValues);
        setErrors(merged);
      }
    },
  };

  if (props.children) {
    return Provider({
      context: formContext.context,
      value: ctx,
      children: () => {
        const child = props.children!();
        return Column({
          mainAxisSize: 'min',
          style: props.style,
          children: child,
        });
      },
    });
  }

  return Provider({
    context: formContext.context,
    value: ctx,
    children: () =>
      Column({
        mainAxisSize: 'min',
        style: props.style,
      }),
  });
}
