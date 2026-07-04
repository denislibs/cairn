import type { Instance, SemanticsNode } from '@cairn/runtime';
import { createSignal, createEffect, type Accessor } from '@cairn/reactivity';
import { Box, Row, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl } from './control';
import {
  ARROW_LEFT, ARROW_RIGHT, ARROW_UP, ARROW_DOWN,
  HOME, END, PAGE_UP, PAGE_DOWN,
} from './native/keys';

export interface SliderProps extends LayoutChildProps {
  value?: number | Accessor<number>;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  style?: StyleInput;
}

export function Slider(props: SliderProps): Instance {
  const t = useWidgetTheme();

  const resolvedMin = props.min ?? 0;
  const resolvedMax = props.max ?? 100;
  const resolvedStep = props.step ?? 1;
  const isDisabled = !!props.disabled;

  // ─── Controlled / uncontrolled ────────────────────────────────────────────
  const controlled = props.value !== undefined;
  const [internal, setInternal] = createSignal(
    props.defaultValue ?? resolvedMin,
  );

  const read: Accessor<number> = (): number => {
    if (controlled) {
      const v = props.value!;
      return typeof v === 'function' ? (v as Accessor<number>)() : (v as number);
    }
    return internal();
  };

  // ─── clampSnap ────────────────────────────────────────────────────────────
  const clampSnap = (v: number): number => {
    const clamped = Math.max(resolvedMin, Math.min(resolvedMax, v));
    const snapped = resolvedMin + Math.round((clamped - resolvedMin) / resolvedStep) * resolvedStep;
    return Math.max(resolvedMin, Math.min(resolvedMax, snapped));
  };

  const commit = (v: number): void => {
    if (isDisabled) return;
    const next = clampSnap(v);
    if (!controlled) setInternal(next);
    props.onChange?.(next);
  };

  // ─── Focus-visible state via createControl ────────────────────────────────
  const [focusVisible, setFV] = createSignal(false);

  // ─── Native semantics ─────────────────────────────────────────────────────
  const semantics: SemanticsNode = {
    role: 'slider',
    label: props.label ?? '',
    min: resolvedMin,
    max: resolvedMax,
    now: read(),
    disabled: isDisabled,
    focusable: !isDisabled,
    onKeyDown: (key: string, _mods: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }): boolean => {
      if (isDisabled) return false;
      const span = resolvedMax - resolvedMin;
      switch (key) {
        case ARROW_RIGHT:
        case ARROW_UP:
          commit(read() + resolvedStep);
          return true;
        case ARROW_LEFT:
        case ARROW_DOWN:
          commit(read() - resolvedStep);
          return true;
        case HOME:
          commit(resolvedMin);
          return true;
        case END:
          commit(resolvedMax);
          return true;
        case PAGE_UP:
          commit(read() + span * 0.1);
          return true;
        case PAGE_DOWN:
          commit(read() - span * 0.1);
          return true;
        default:
          return false;
      }
    },
    onFocus: (kb: boolean) => setFV(kb),
    onBlur: () => setFV(false),
  };

  // Reactively sync semantics fields
  createEffect(() => {
    semantics.now = read();
    semantics.disabled = isDisabled;
    semantics.focusable = !isDisabled;
  });

  // ─── Drag state ───────────────────────────────────────────────────────────
  let dragging = false;

  const setFromPointer = (localX: number, trackWidth: number): void => {
    if (isDisabled) return;
    const frac = localX / trackWidth;
    commit(resolvedMin + frac * (resolvedMax - resolvedMin));
  };

  // ─── Theming ──────────────────────────────────────────────────────────────
  const TRACK_H = 4;
  const THUMB_SIZE = 18;

  // The fill fraction is clamped to [0,1]
  const fillFrac = (): number => {
    const span = resolvedMax - resolvedMin;
    if (span === 0) return 0;
    return Math.max(0, Math.min(1, (read() - resolvedMin) / span));
  };

  // Fill box (grows reactively to show progress)
  const fill = Box({
    style: () => ({
      width: `${fillFrac() * 100}%` as any,
      height: TRACK_H,
      borderRadius: TRACK_H / 2,
      backgroundColor: isDisabled ? t.colors.textDisabled : t.colors.primary,
    }),
  });

  // Thumb box (positioned via left, absolute within track)
  const thumb = Box({
    style: () => ({
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: t.colors.surface,
      border: { width: 2, color: isDisabled ? t.colors.textDisabled : t.colors.primary },
      left: -THUMB_SIZE / 2, // center on fill edge; will shift with fill
      top: -(THUMB_SIZE - TRACK_H) / 2,
    }),
  });

  // Track box — contains fill
  const track = Box({
    style: () => ({
      width: '100%' as any,
      height: TRACK_H,
      borderRadius: TRACK_H / 2,
      backgroundColor: t.colors.borderStrong,
      overflow: 'visible' as any,
    }),
    children: fill,
  });

  // Wrapper box — the interactive/focusable root
  const wrapperHandlers = {
    onPointerDown: (e: { localX?: number }) => {
      if (isDisabled) return;
      dragging = true;
      const w = (track.layout as any).size?.w ?? 0;
      setFromPointer(e.localX ?? 0, w);
    },
    onPointerMove: (e: { localX?: number }) => {
      if (isDisabled || !dragging) return;
      const w = (track.layout as any).size?.w ?? 0;
      setFromPointer(e.localX ?? 0, w);
    },
    onPointerUp: () => { dragging = false; },
    onPointerLeave: () => { dragging = false; },
  };

  const focusRingStyle = (): object =>
    focusVisible()
      ? { outline: { width: 2, color: t.colors.focusRing, offset: 2 } }
      : {};

  const wrapperStyle = mergeStyles(
    () => ({
      width: '100%' as any,
      height: THUMB_SIZE + 4,
      alignY: 'center' as const,
      cursor: isDisabled ? 'default' : 'pointer',
      opacity: isDisabled ? 0.5 : 1,
      ...focusRingStyle(),
    }),
    props.style,
  );

  const wrapper = Box({
    style: wrapperStyle,
    focusable: !isDisabled,
    ...wrapperHandlers,
    children: track,
  });

  wrapper.semantics = semantics;
  applyLayoutChildProps(wrapper, props);
  return wrapper;
}
