# @cairn/platform-web

Browser implementation of the Cairn `Host` seam over Canvas 2D.

## Exports

- `createWebHost(canvas)` — the main entry: returns a `Host` wired to the canvas.
- `Canvas2DRenderer` — `Renderer` over `CanvasRenderingContext2D`; draws in logical
  pixels and scales the backing store by `devicePixelRatio`.
- `WebFrameScheduler` — `requestAnimationFrame` based.
- `WebSurfaceMetrics` — size + DPR via `ResizeObserver` / `matchMedia`.
- `HtmlCanvasSurface` / `CanvasSurface` — the injectable backing-store seam.

## Usage

```ts
import { createWebHost } from '@cairn/platform-web';

const host = createWebHost(document.querySelector('canvas')!);
host.renderer.beginFrame();
host.renderer.fillRect({ x: 0, y: 0, width: 100, height: 40 }, { color: '#3b82f6' });
host.renderer.endFrame();
```
