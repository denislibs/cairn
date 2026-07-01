# Cairn Phase 2 — Host seam + Canvas2D renderer — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** Phase 1 (`@cairn/reactivity`, merged to main)

## Goal

Deliver the platform seam (`@cairn/host`) and its browser implementation
(`@cairn/platform-web`): a portable `Renderer` interface plus `FrameScheduler` and
`SurfaceMetrics`, backed by Canvas 2D. Core packages remain DOM-free.

## Decisions

| Area | Decision |
|---|---|
| Renderer scope | Extended: rects, rounded rects, text, images, strokes, gradients, shadows, arbitrary paths |
| Renderer API style | High-level immediate mode with explicit `style` objects (portable to WebGL); no mutable-context mirroring of Canvas2D |
| Coordinates / HiDPI | Logical CSS pixels; renderer scales the backing store by `devicePixelRatio` internally via `setTransform` |
| Host composition | `Host` holds `renderer`, `scheduler`, `metrics` now; `input`/`textInput`/`a11y` are added as fields in their own phases (7/8/14) — non-breaking extension, no empty placeholder interfaces |
| "No DOM in core" guard | Type-level: core packages use tsconfig `lib: ["ES2022"]` (no `DOM`); `platform-web` uses `["ES2022","DOM","DOM.Iterable"]`. DOM use in core is a compile error. Applied retroactively to `@cairn/reactivity` |
| Renderer tests | Fake `CanvasRenderingContext2D` recording call sequences + args (headless, Vitest) |
| Packages | `@cairn/host` (pure types, no DOM), `@cairn/platform-web` (Canvas2DRenderer, rAF scheduler, ResizeObserver metrics, `createWebHost`) |

## Interfaces (`@cairn/host`)

Geometry & style value types (plain data, no DOM):

```ts
interface Point { x: number; y: number; }
interface Rect { x: number; y: number; width: number; height: number; }
type Radii = number | { tl: number; tr: number; br: number; bl: number };
type Color = string; // CSS color string for v1

interface GradientStop { offset: number; color: Color; }
type Gradient =
  | { kind: 'linear'; from: Point; to: Point; stops: GradientStop[] }
  | { kind: 'radial'; center: Point; radius: number; stops: GradientStop[] };

interface FillStyle { color?: Color; gradient?: Gradient; }
interface StrokeStyle { color?: Color; gradient?: Gradient; width?: number; }
interface Shadow { color: Color; blur: number; offsetX: number; offsetY: number; }

interface TextStyle {
  font: string;                 // CSS shorthand, e.g. "16px sans-serif"
  color?: Color;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'alphabetic' | 'bottom';
}
interface TextMeasurement { width: number; }
```

Path is an immutable value built by a builder:

```ts
interface Path { readonly commands: ReadonlyArray<PathCommand>; }
interface PathBuilder {
  moveTo(x: number, y: number): PathBuilder;
  lineTo(x: number, y: number): PathBuilder;
  arc(cx: number, cy: number, r: number, start: number, end: number): PathBuilder;
  quadTo(cx: number, cy: number, x: number, y: number): PathBuilder;
  close(): PathBuilder;
  build(): Path;
}
function createPath(): PathBuilder;
```
Images: to keep `@cairn/host` DOM-free, `drawImage` takes an opaque `ImageHandle`
(`{ readonly width: number; readonly height: number }`). Real DOM image sources
(`HTMLImageElement`, `ImageBitmap`, `HTMLCanvasElement`) structurally satisfy that shape,
so `platform-web` accepts them directly.

```ts
interface Renderer {
  beginFrame(): void;
  endFrame(): void;
  clear(rect?: Rect): void;

  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  clipRect(rect: Rect): void;
  setShadow(shadow: Shadow | null): void;

  fillRect(rect: Rect, style: FillStyle): void;
  strokeRect(rect: Rect, style: StrokeStyle): void;
  fillRoundRect(rect: Rect, radii: Radii, style: FillStyle): void;
  strokeRoundRect(rect: Rect, radii: Radii, style: StrokeStyle): void;
  fillPath(path: Path, style: FillStyle): void;
  strokePath(path: Path, style: StrokeStyle): void;
  drawText(text: string, pos: Point, style: TextStyle): void;
  measureText(text: string, style: TextStyle): TextMeasurement;
  drawImage(image: ImageHandle, dest: Rect, src?: Rect): void;
}

interface ImageHandle { readonly width: number; readonly height: number; }

interface FrameScheduler {
  requestFrame(cb: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
}

interface SurfaceMetrics {
  readonly width: number;            // logical (CSS) px
  readonly height: number;
  readonly devicePixelRatio: number;
  onResize(cb: (m: SurfaceMetrics) => void): () => void; // returns unsubscribe
}

interface Host {
  renderer: Renderer;
  scheduler: FrameScheduler;
  metrics: SurfaceMetrics;
}
```

## Implementation (`@cairn/platform-web`)

- **`Canvas2DRenderer`** wraps a `CanvasRenderingContext2D`. On construction and on
  resize it sizes the backing store to `logical * devicePixelRatio` and applies
  `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` so all drawing uses logical coordinates.
  Translates style objects into `ctx` state per call (fillStyle/strokeStyle/shadow/font),
  builds gradients via `createLinearGradient`/`createRadialGradient`, plays back `Path`
  commands via the ctx path API, and rounds rects via `ctx.roundRect` (or arc fallback).
- **`WebFrameScheduler`** wraps `requestAnimationFrame`/`cancelAnimationFrame`.
- **`WebSurfaceMetrics`** reads element size + `devicePixelRatio`; observes size via
  `ResizeObserver` and DPR changes via `matchMedia(\`(resolution: ...)\`)`, notifying
  subscribers and re-configuring the renderer's backing store.
- **`createWebHost(canvas: HTMLCanvasElement): Host`** wires the three together.

## Testing

- Fake `CanvasRenderingContext2D` records method calls and property sets. Tests assert:
  the correct ctx calls/args for each Renderer method; DPR backing-store sizing and
  `setTransform`; gradient construction; path playback; save/restore and clip nesting.
- `FrameScheduler`/`SurfaceMetrics` tested with fake `requestAnimationFrame` and a fake
  `ResizeObserver`.
- `examples/shapes/` — an HTML entry + script drawing static shapes/text/gradient for
  manual HiDPI verification in a browser (not part of CI).

## Exit criteria

- `@cairn/host` interfaces defined; DOM-free (`lib: ES2022`).
- `Canvas2DRenderer`, `WebFrameScheduler`, `WebSurfaceMetrics`, `createWebHost` implemented
  and covered by mock-based unit tests.
- Core packages fail to compile on any `document`/`window` reference (verified by adding a
  deliberate temp check during development, then removing it).
- `pnpm typecheck` and `pnpm vitest run` green across the workspace.
- `examples/shapes/` renders crisply on HiDPI (manual check).

## Out of scope (later phases)

- `InputSource` (Phase 7), `TextInputService` (Phase 8), `AccessibilityBridge` (Phase 14).
- Element tree / layout / `createRoot(host)` / `mount` (Phase 3–4).
- WebGL backend (post-v1).
