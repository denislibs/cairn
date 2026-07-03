import { onCleanup } from '@cairn/reactivity';
import { useOverlays, type Instance } from '@cairn/runtime';
import { BoxNode } from '@cairn/layout';

export interface PortalProps { children: Instance }

// Renders `children` into the root overlay layer (on top of everything). In-tree it
// occupies zero space.
export function Portal(props: PortalProps): Instance {
  const overlays = useOverlays();
  const id = overlays.add(props.children);
  onCleanup(() => overlays.remove(id));
  return { layout: new BoxNode({ width: 0, height: 0 }), children: [], paintSelf() {} };
}
