import type { Instance } from '@cairn/runtime';
import { BoxNode } from '@cairn/layout';
import type { Renderer } from '@cairn/host';
import type { Accessor } from '@cairn/reactivity';

export interface SliderProps {
  value: Accessor<number> | number;
  min: number;
  max: number;
  step?: number;
  width: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function Slider(props: SliderProps): Instance {
  const { min, max, width } = props;
  const step = props.step ?? 1;

  const read = (): number =>
    typeof props.value === 'function'
      ? (props.value as Accessor<number>)()
      : (props.value as number);

  const clampSnap = (v: number): number => {
    const clamped = Math.max(min, Math.min(max, v));
    const snapped = min + Math.round((clamped - min) / step) * step;
    return Math.max(min, Math.min(max, snapped));
  };

  const commit = (v: number): void => {
    if (props.disabled) return;
    props.onChange(clampSnap(v));
  };

  const setFromLocal = (lx: number): void => {
    const frac = Math.max(0, Math.min(width, lx)) / width;
    commit(min + frac * (max - min));
  };

  let dragging = false;

  const layout = new BoxNode({ width, height: 24 });

  const paintSelf = (r: Renderer): void => {
    const w = layout.size.w;
    const h = layout.size.h;
    const cy = h / 2;
    const t = 4;
    const frac = (read() - min) / (max - min);
    const fx = frac * w;

    const trackColor = props.disabled ? '#2a2a2a' : '#3a3a3a';
    const fillColor = props.disabled ? '#6b7280' : '#e5e7eb';
    const handleColor = props.disabled ? '#9ca3af' : '#f5f5f5';

    r.fillRoundRect({ x: 0, y: cy - t / 2, width: w, height: t }, t / 2, { color: trackColor });
    r.fillRoundRect({ x: 0, y: cy - t / 2, width: fx, height: t }, t / 2, { color: fillColor });

    const hr = 9;
    const hx = Math.max(hr, Math.min(w - hr, fx));
    r.fillRoundRect({ x: hx - hr, y: cy - hr, width: hr * 2, height: hr * 2 }, hr, { color: handleColor });
  };

  return {
    layout,
    children: [],
    focusable: true,
    paintSelf,
    handlers: {
      onPointerDown: (e) => {
        if (props.disabled) return;
        dragging = true;
        setFromLocal(e.localX ?? 0);
      },
      onPointerMove: (e) => {
        if (props.disabled) return;
        if (dragging) setFromLocal(e.localX ?? 0);
      },
      onPointerUp: () => {
        dragging = false;
      },
      onPointerLeave: () => {
        dragging = false;
      },
      onKeyDown: (e) => {
        if (props.disabled) return;
        if (e.key === 'ArrowRight') commit(read() + step);
        else if (e.key === 'ArrowLeft') commit(read() - step);
      },
    },
  };
}
