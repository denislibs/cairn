import type { Instance, SemanticsNode } from '@cairn/runtime';
import { createSignal } from '@cairn/reactivity';
import { Box, Row, Column, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

export interface StepperStep {
  label: string;
  description?: string;
}

export interface StepperProps extends LayoutChildProps {
  steps: StepperStep[];
  active: number; // 0-based index
  orientation?: 'horizontal' | 'vertical';
  onStepClick?: (index: number) => void;
  style?: StyleInput;
}

export function Stepper(props: StepperProps): Instance {
  const t = useWidgetTheme();
  const orientation = props.orientation ?? 'horizontal';
  const steps = props.steps;

  const stepInstances: Instance[] = steps.map((step, i) => {
    const isActive = i === props.active;
    const isCompleted = i < props.active;
    const isClickable = !!props.onStepClick;

    const { handlers } = createControl({
      onClick: () => props.onStepClick?.(i),
    });

    const circleStyle: StyleInput = () => ({
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isActive ? t.colors.primary : isCompleted ? t.colors.primary : t.colors.surface,
      border: isActive || isCompleted ? undefined : { width: 2, color: t.colors.border },
      alignX: 'center' as const,
      alignY: 'center' as const,
      cursor: isClickable ? 'pointer' : 'default',
    });

    const labelText = Text({
      children: isCompleted ? '✓' : String(i + 1),
      style: () => ({
        fontSize: t.fontSizes.sm,
        fontWeight: t.fontWeights.medium,
        color: isActive || isCompleted ? '#ffffff' : t.colors.text,
      }),
    });

    const circle = Box({
      style: circleStyle,
      focusable: isClickable,
      ...(isClickable ? handlers : {}),
      children: labelText,
    });

    const labelNode = Text({
      children: step.label,
      style: () => ({
        fontSize: t.fontSizes.sm,
        color: isActive ? t.colors.primary : t.colors.text,
        fontWeight: isActive ? t.fontWeights.medium : t.fontWeights.regular,
      }),
    });

    const stepContent = Column({
      mainAxisSize: 'min',
      style: { gap: t.spacing.xs, alignX: 'center' },
      children: [circle, labelNode],
    });

    const sem: SemanticsNode = {
      role: 'listitem',
      label: step.label,
      current: isActive ? true : undefined,
    };
    stepContent.semantics = sem;

    return stepContent;
  });

  // Add connectors between steps
  const allChildren: Instance[] = [];
  for (let i = 0; i < stepInstances.length; i++) {
    allChildren.push(stepInstances[i]);
    if (i < stepInstances.length - 1) {
      const connector = Box({
        style: () => ({
          width: orientation === 'horizontal' ? 40 : 2,
          height: orientation === 'horizontal' ? 2 : 24,
          backgroundColor: i < props.active ? t.colors.primary : t.colors.border,
        }),
      });
      const connSem: SemanticsNode = { role: 'separator' };
      connector.semantics = connSem;
      allChildren.push(connector);
    }
  }

  const container = orientation === 'horizontal'
    ? Row({
        mainAxisSize: 'min',
        style: mergeStyles({ gap: t.spacing.sm, alignY: 'center' }, props.style),
        children: allChildren,
      })
    : Column({
        mainAxisSize: 'min',
        style: mergeStyles({ gap: t.spacing.sm }, props.style),
        children: allChildren,
      });

  const listSem: SemanticsNode = { role: 'list' };
  container.semantics = listSem;
  applyLayoutChildProps(container, props);
  container.debugName = 'Stepper';
  return container;
}
