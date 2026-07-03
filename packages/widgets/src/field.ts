import type { Instance } from '@cairn/runtime';
import { Provider, Show } from '@cairn/runtime';
import { useContext, type Accessor } from '@cairn/reactivity';
import { Box, Column, Text, mergeStyles, type StyleInput } from '@cairn/primitives';
import { createCompoundContext } from './context';
import { useWidgetTheme } from './theme';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface FieldContextValue {
  invalid: Accessor<boolean>;
  disabled: boolean;
  id: symbol;
}

export const fieldContext = createCompoundContext<FieldContextValue>('Field');

/** Throwing: must be inside a Field. */
export function useField(): FieldContextValue {
  return fieldContext.use();
}

/** Non-throwing: returns null outside a Field. */
export function useFieldOptional(): FieldContextValue | null {
  return useContext(fieldContext.context);
}

// ─── Field parts ─────────────────────────────────────────────────────────────

export interface FieldLabelProps {
  children?: string;
  style?: StyleInput;
}

function FieldLabel(props: FieldLabelProps): Instance {
  const t = useWidgetTheme();
  return Text({
    style: mergeStyles(
      () => ({
        color: t.colors.text,
        fontSize: t.fontSizes.sm,
        fontWeight: t.fontWeights.medium,
      }),
      props.style,
    ),
    children: props.children,
  });
}

export interface FieldControlProps {
  children?: Instance | (() => Instance);
}

function FieldControl(props: FieldControlProps): Instance {
  if (typeof props.children === 'function') {
    return (props.children as () => Instance)();
  }
  return props.children ?? Box({});
}

export interface FieldHelperProps {
  children?: string;
  style?: StyleInput;
}

function FieldHelper(props: FieldHelperProps): Instance {
  const t = useWidgetTheme();
  return Text({
    style: mergeStyles(
      () => ({
        color: t.colors.textMuted,
        fontSize: t.fontSizes.xs,
      }),
      props.style,
    ),
    children: props.children,
  });
}

export interface FieldErrorProps {
  children?: string;
  style?: StyleInput;
}

function FieldError(props: FieldErrorProps): Instance {
  const t = useWidgetTheme();
  // useFieldOptional() so this can also be rendered standalone in tests
  const field = useFieldOptional();
  const isInvalid: Accessor<boolean> = field ? field.invalid : () => false;
  return Show({
    when: isInvalid,
    children: () =>
      Text({
        style: mergeStyles(
          () => ({
            color: t.colors.danger,
            fontSize: t.fontSizes.xs,
          }),
          props.style,
        ),
        children: props.children,
      }),
  });
}

// ─── Field root ───────────────────────────────────────────────────────────────

export interface FieldProps {
  invalid?: Accessor<boolean>;
  disabled?: boolean;
  style?: StyleInput;
  /** A thunk invoked inside the Field context scope. */
  children?: () => Instance;
}

export interface FieldComponent {
  (props: FieldProps): Instance;
  Label: typeof FieldLabel;
  Control: typeof FieldControl;
  Helper: typeof FieldHelper;
  Error: typeof FieldError;
}

function FieldRoot(props: FieldProps): Instance {
  const t = useWidgetTheme();

  const ctxValue: FieldContextValue = {
    invalid: props.invalid ?? (() => false),
    disabled: !!props.disabled,
    id: Symbol('Field'),
  };

  if (props.children) {
    return Provider({
      context: fieldContext.context,
      value: ctxValue,
      children: () => {
        const child = props.children!();
        return Column({
          style: mergeStyles(() => ({ gap: t.spacing.xs }), props.style),
          children: child,
        });
      },
    });
  }

  return Provider({
    context: fieldContext.context,
    value: ctxValue,
    children: () =>
      Column({
        style: mergeStyles(() => ({ gap: t.spacing.xs }), props.style),
      }),
  });
}

// Attach parts to the root function
export const Field = FieldRoot as FieldComponent;
Field.Label = FieldLabel;
Field.Control = FieldControl;
Field.Helper = FieldHelper;
Field.Error = FieldError;
