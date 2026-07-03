import { describe, it, expect, afterEach } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, type Instance } from '../src/index';
import { useOverlays } from '../src/overlays';
import { createFakeHost } from './fake-host';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function makeAppWithOverlay(): Instance {
  const appLayout = new BoxNode({ width: 200, height: 100 });
  const overlayLayout = new BoxNode({ width: 50, height: 50 });

  const overlayInst: Instance = {
    layout: overlayLayout,
    children: [],
    paintSelf(r) {
      r.fillRect({ x: 0, y: 0, width: 50, height: 50 }, { color: '#overlay' });
    },
  };

  const appInst: Instance = {
    layout: appLayout,
    children: [],
    paintSelf(r) {
      r.fillRect({ x: 0, y: 0, width: 200, height: 100 }, { color: '#app' });
    },
  };

  // Register the overlay via useOverlays()
  const reg = useOverlays();
  reg.add(overlayInst);

  return appInst;
}

describe('mount with overlays', () => {
  it('paints app root before overlay', () => {
    const { host, renderer } = createFakeHost();
    dispose = mount(makeAppWithOverlay, host);

    // Extract fillRect calls to check ordering
    const fillRects = renderer.calls.filter((c) => c[0] === 'fillRect');
    expect(fillRects.length).toBe(2);

    // App root painted before overlay
    const appFill = fillRects.findIndex((c) => {
      const style = c[2] as { color: string };
      return style.color === '#app';
    });
    const overlayFill = fillRects.findIndex((c) => {
      const style = c[2] as { color: string };
      return style.color === '#overlay';
    });

    expect(appFill).toBeGreaterThanOrEqual(0);
    expect(overlayFill).toBeGreaterThanOrEqual(0);
    expect(appFill).toBeLessThan(overlayFill);
  });

  it('overlay hit-testing: pointer over overlay position is dispatched', () => {
    const { host, input } = createFakeHost();

    const log: string[] = [];

    function makeAppWithHittableOverlay(): Instance {
      const appLayout = new BoxNode({ width: 200, height: 100 });
      const overlayLayout = new BoxNode({ width: 50, height: 50 });

      const overlayInst: Instance = {
        layout: overlayLayout,
        children: [],
        paintSelf() {},
        handlers: {
          onPointerDown: () => log.push('overlay-hit'),
        },
      };

      const reg = useOverlays();
      reg.add(overlayInst);

      return {
        layout: appLayout,
        children: [],
        paintSelf() {},
        handlers: {
          onPointerDown: () => log.push('app-hit'),
        },
      };
    }

    dispose = mount(makeAppWithHittableOverlay, host);

    // Pointer within the overlay area (0,0 to 50,50)
    input.emitPointer({ type: 'pointerdown', x: 10, y: 10, button: 0, pointerType: 'mouse' });

    // Overlay is last in children of layered(), so hit-test resolves it first (front-to-back)
    expect(log).toContain('overlay-hit');
  });
});
