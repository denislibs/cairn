import type { Renderer } from '@cairn/host';
import { createPath } from '@cairn/host';
import { BoxNode } from '@cairn/layout';
import { type Instance, useHost, scheduleFrame } from '@cairn/runtime';
import { createSignal, onCleanup } from '@cairn/reactivity';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';

export interface SpinnerProps extends LayoutChildProps {
  size?: number;
  color?: string;
  thickness?: number;
}

export function Spinner(props: SpinnerProps = {}): Instance {
  const size = props.size ?? 24;
  const color = props.color ?? '#9ca3af';
  const thickness = props.thickness ?? 3;
  const layout = new BoxNode({ width: size, height: size });
  const [angle, setAngle] = createSignal(0);

  const host = useHost();
  let handle = 0;
  let stopped = false;
  const loop = (): void => {
    if (stopped) return;
    setAngle((a) => a + 0.18);
    scheduleFrame();
    handle = host.scheduler.requestFrame(loop);
  };
  handle = host.scheduler.requestFrame(loop);
  onCleanup(() => { stopped = true; host.scheduler.cancelFrame(handle); });

  const instance: Instance = {
    layout,
    children: [],
    paintSelf(r: Renderer) {
      const s = layout.size.w;
      const r0 = Math.max(1, s / 2 - thickness);
      const a = angle();
      r.strokePath(createPath().arc(s / 2, s / 2, r0, a, a + Math.PI * 1.5).build(), { color, width: thickness });
    },
  };
  applyLayoutChildProps(instance, props);
  return instance;
}
