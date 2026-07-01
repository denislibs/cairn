# @cairn/host + @cairn/platform-web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cairn's platform seam — `@cairn/host` (portable, DOM-free interfaces: `Renderer`, `FrameScheduler`, `SurfaceMetrics`, `Host`, plus a `createPath` builder and value types) — and its browser implementation `@cairn/platform-web` (`Canvas2DRenderer`, `WebFrameScheduler`, `WebSurfaceMetrics`, `createWebHost`).

**Architecture:** `@cairn/host` is pure types + one tiny runtime helper (`createPath`); it has no DOM dependency, enforced at the type level via tsconfig `lib` excluding `DOM`. The `Renderer` is a high-level immediate-mode API taking explicit `style` value objects (portable to a future WebGL backend). `@cairn/platform-web` implements the seam over Canvas 2D: the renderer works in logical CSS pixels and scales the backing store by `devicePixelRatio` internally. The renderer is decoupled from the DOM canvas via a small injectable `CanvasSurface`, which makes it unit-testable with a fake `CanvasRenderingContext2D` that records calls.

**Tech Stack:** TypeScript (strict, `lib: ES2022` for core / `+DOM` for platform-web), pnpm workspaces, Vitest. No runtime dependencies.

---

## File Structure

```
tsconfig.base.json                          # MODIFY: add "lib": ["ES2022"] (no DOM)
package.json                                # MODIFY: typecheck script covers all packages

packages/host/                              # @cairn/host — pure, DOM-free
  package.json
  tsconfig.json                             # extends base (no DOM lib)
  src/
    types.ts                                # Point, Rect, Radii, Color, Gradient, FillStyle,
                                            #   StrokeStyle, Shadow, TextStyle, TextMeasurement, ImageHandle
    path.ts                                 # Path, PathCommand, PathBuilder, createPath (runtime)
    renderer.ts                             # Renderer interface
    scheduler.ts                            # FrameScheduler interface
    metrics.ts                              # SurfaceMetrics interface
    host.ts                                 # Host interface
    index.ts                                # barrel
  test/
    types.test.ts
    path.test.ts
    conformance.test.ts                     # interfaces are implementable + exported

packages/platform-web/                      # @cairn/platform-web — Canvas 2D impl
  package.json                              # deps: @cairn/host (workspace:*)
  tsconfig.json                             # extends base + "lib": ["ES2022","DOM","DOM.Iterable"]
  src/
    canvas-surface.ts                       # CanvasSurface interface + HtmlCanvasSurface
    canvas2d-renderer.ts                    # Canvas2DRenderer
    frame-scheduler.ts                      # WebFrameScheduler
    surface-metrics.ts                      # WebSurfaceMetrics
    create-web-host.ts                      # createWebHost
    index.ts                                # barrel
  test/
    fakes.ts                                # createFakeContext, createFakeSurface
    frame-scheduler.test.ts
    surface-metrics.test.ts
    canvas2d-renderer.test.ts
    create-web-host.test.ts

examples/shapes/                            # manual browser check (not CI)
  index.html
  main.ts
```

**Responsibilities:** `@cairn/host` owns the contract only. `@cairn/platform-web` owns all DOM/Canvas code. The `CanvasSurface` seam isolates backing-store sizing so the renderer is testable without a real canvas.

---

## Task 1: @cairn/host scaffold + DOM-free lib guard + value types

**Files:**
- Modify: `tsconfig.base.json`
- Modify: `package.json`
- Create: `packages/host/package.json`
- Create: `packages/host/tsconfig.json`
- Create: `packages/host/src/types.ts`
- Create: `packages/host/src/index.ts`
- Test: `packages/host/test/types.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/host/test/types.test.ts`:
```ts
import { test, expect } from 'vitest';
import type { Rect, FillStyle, Gradient } from '../src/index';

test('value types are constructable and exported', () => {
  const rect: Rect = { x: 1, y: 2, width: 3, height: 4 };
  const fill: FillStyle = { color: '#f00' };
  const grad: Gradient = {
    kind: 'linear',
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    stops: [
      { offset: 0, color: '#000' },
      { offset: 1, color: '#fff' },
    ],
  };
  expect(rect.width).toBe(3);
  expect(fill.color).toBe('#f00');
  expect(grad.kind).toBe('linear');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/host/test/types.test.ts`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 3: Set the core lib to exclude DOM**

Modify `tsconfig.base.json` — add a `"lib"` entry so core packages cannot reference DOM globals:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": false
  }
}
```

- [ ] **Step 4: Create the host package files**

`packages/host/package.json`:
```json
{
  "name": "@cairn/host",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "sideEffects": false
}
```

`packages/host/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

`packages/host/src/types.ts`:
```ts
// Geometry and style value types. Plain data, no DOM.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Radii = number | { tl: number; tr: number; br: number; bl: number };

export type Color = string; // CSS color string for v1

export interface GradientStop {
  offset: number;
  color: Color;
}

export type Gradient =
  | { kind: 'linear'; from: Point; to: Point; stops: GradientStop[] }
  | { kind: 'radial'; center: Point; radius: number; stops: GradientStop[] };

export interface FillStyle {
  color?: Color;
  gradient?: Gradient;
}

export interface StrokeStyle {
  color?: Color;
  gradient?: Gradient;
  width?: number;
}

export interface Shadow {
  color: Color;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface TextStyle {
  font: string; // CSS font shorthand, e.g. "16px sans-serif"
  color?: Color;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'alphabetic' | 'bottom';
}

export interface TextMeasurement {
  width: number;
}

// Opaque image handle — keeps @cairn/host DOM-free. DOM image sources
// (HTMLImageElement, ImageBitmap, HTMLCanvasElement) structurally satisfy this.
export interface ImageHandle {
  readonly width: number;
  readonly height: number;
}
```

`packages/host/src/index.ts`:
```ts
export type {
  Point,
  Rect,
  Radii,
  Color,
  GradientStop,
  Gradient,
  FillStyle,
  StrokeStyle,
  Shadow,
  TextStyle,
  TextMeasurement,
  ImageHandle,
} from './types';
```

- [ ] **Step 5: Update the root typecheck script to include host**

Modify `package.json` `scripts.typecheck`:
```json
    "typecheck": "tsc --noEmit -p packages/reactivity/tsconfig.json && tsc --noEmit -p packages/host/tsconfig.json"
```

- [ ] **Step 6: Install so the workspace links the new package**

Run: `pnpm install`
Expected: no errors; `@cairn/host` recognized as a workspace package.

- [ ] **Step 7: Run test + typecheck**

Run: `pnpm vitest run packages/host/test/types.test.ts`
Expected: PASS (1 test).

Run: `pnpm typecheck`
Expected: no errors (reactivity still compiles under `lib: ES2022`; host compiles).

- [ ] **Step 8: Verify the DOM guard actually works**

Temporarily append to `packages/host/src/index.ts`:
```ts
const _domGuardCheck = document;
```
Run: `pnpm exec tsc --noEmit -p packages/host/tsconfig.json`
Expected: FAIL with `Cannot find name 'document'.` (this proves DOM is excluded from core).
Then REMOVE the `_domGuardCheck` line and re-run:
Run: `pnpm exec tsc --noEmit -p packages/host/tsconfig.json`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(host): scaffold @cairn/host with value types and DOM-free lib guard"
```

---

## Task 2: createPath builder

**Files:**
- Create: `packages/host/src/path.ts`
- Modify: `packages/host/src/index.ts`
- Test: `packages/host/test/path.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/host/test/path.test.ts`:
```ts
import { test, expect } from 'vitest';
import { createPath } from '../src/index';

test('builds a path as an immutable command list', () => {
  const path = createPath()
    .moveTo(0, 0)
    .lineTo(10, 0)
    .lineTo(10, 10)
    .close()
    .build();

  expect(path.commands).toEqual([
    { type: 'moveTo', x: 0, y: 0 },
    { type: 'lineTo', x: 10, y: 0 },
    { type: 'lineTo', x: 10, y: 10 },
    { type: 'close' },
  ]);
});

test('supports arc and quadTo', () => {
  const path = createPath().arc(5, 5, 5, 0, Math.PI).quadTo(1, 2, 3, 4).build();
  expect(path.commands).toEqual([
    { type: 'arc', cx: 5, cy: 5, r: 5, start: 0, end: Math.PI },
    { type: 'quadTo', cx: 1, cy: 2, x: 3, y: 4 },
  ]);
});

test('builder methods are chainable and build returns a snapshot', () => {
  const builder = createPath().moveTo(1, 1);
  const p1 = builder.build();
  builder.lineTo(2, 2);
  const p2 = builder.build();
  // p1 must not be mutated by later builder calls
  expect(p1.commands).toEqual([{ type: 'moveTo', x: 1, y: 1 }]);
  expect(p2.commands).toEqual([
    { type: 'moveTo', x: 1, y: 1 },
    { type: 'lineTo', x: 2, y: 2 },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/host/test/path.test.ts`
Expected: FAIL — `createPath` is not exported.

- [ ] **Step 3: Implement path.ts**

`packages/host/src/path.ts`:
```ts
export type PathCommand =
  | { type: 'moveTo'; x: number; y: number }
  | { type: 'lineTo'; x: number; y: number }
  | { type: 'arc'; cx: number; cy: number; r: number; start: number; end: number }
  | { type: 'quadTo'; cx: number; cy: number; x: number; y: number }
  | { type: 'close' };

export interface Path {
  readonly commands: ReadonlyArray<PathCommand>;
}

export interface PathBuilder {
  moveTo(x: number, y: number): PathBuilder;
  lineTo(x: number, y: number): PathBuilder;
  arc(cx: number, cy: number, r: number, start: number, end: number): PathBuilder;
  quadTo(cx: number, cy: number, x: number, y: number): PathBuilder;
  close(): PathBuilder;
  build(): Path;
}

export function createPath(): PathBuilder {
  const commands: PathCommand[] = [];
  const builder: PathBuilder = {
    moveTo(x, y) {
      commands.push({ type: 'moveTo', x, y });
      return builder;
    },
    lineTo(x, y) {
      commands.push({ type: 'lineTo', x, y });
      return builder;
    },
    arc(cx, cy, r, start, end) {
      commands.push({ type: 'arc', cx, cy, r, start, end });
      return builder;
    },
    quadTo(cx, cy, x, y) {
      commands.push({ type: 'quadTo', cx, cy, x, y });
      return builder;
    },
    close() {
      commands.push({ type: 'close' });
      return builder;
    },
    // Snapshot so later builder mutations don't affect a previously built Path.
    build() {
      return { commands: commands.slice() };
    },
  };
  return builder;
}
```

`packages/host/src/index.ts` (append the path exports):
```ts
export type {
  Point,
  Rect,
  Radii,
  Color,
  GradientStop,
  Gradient,
  FillStyle,
  StrokeStyle,
  Shadow,
  TextStyle,
  TextMeasurement,
  ImageHandle,
} from './types';

export type { Path, PathCommand, PathBuilder } from './path';
export { createPath } from './path';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/host/test/path.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(host): createPath immutable path builder"
```

---

## Task 3: Renderer, FrameScheduler, SurfaceMetrics, Host interfaces

**Files:**
- Create: `packages/host/src/renderer.ts`
- Create: `packages/host/src/scheduler.ts`
- Create: `packages/host/src/metrics.ts`
- Create: `packages/host/src/host.ts`
- Modify: `packages/host/src/index.ts`
- Test: `packages/host/test/conformance.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/host/test/conformance.test.ts`:
```ts
import { test, expect } from 'vitest';
import { createPath } from '../src/index';
import type {
  Renderer,
  FrameScheduler,
  SurfaceMetrics,
  Host,
  ImageHandle,
} from '../src/index';

// A trivial no-op renderer proves the interface is implementable and exported.
function makeNoopRenderer(): Renderer {
  return {
    resize() {},
    beginFrame() {},
    endFrame() {},
    clear() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    clipRect() {},
    setShadow() {},
    fillRect() {},
    strokeRect() {},
    fillRoundRect() {},
    strokeRoundRect() {},
    fillPath() {},
    strokePath() {},
    drawText() {},
    measureText() {
      return { width: 0 };
    },
    drawImage() {},
  };
}

test('Renderer is implementable and usable', () => {
  const r = makeNoopRenderer();
  r.beginFrame();
  r.fillRect({ x: 0, y: 0, width: 1, height: 1 }, { color: '#000' });
  r.fillPath(createPath().moveTo(0, 0).build(), { color: '#000' });
  expect(r.measureText('hi', { font: '10px sans-serif' })).toEqual({ width: 0 });
});

test('FrameScheduler / SurfaceMetrics / Host are implementable', () => {
  const scheduler: FrameScheduler = {
    requestFrame() {
      return 1;
    },
    cancelFrame() {},
  };
  const metrics: SurfaceMetrics = {
    width: 100,
    height: 50,
    devicePixelRatio: 2,
    onResize() {
      return () => {};
    },
    dispose() {},
  };
  const host: Host = { renderer: makeNoopRenderer(), scheduler, metrics };
  const img: ImageHandle = { width: 4, height: 4 };
  host.renderer.drawImage(img, { x: 0, y: 0, width: 4, height: 4 });

  expect(scheduler.requestFrame(() => {})).toBe(1);
  expect(host.metrics.devicePixelRatio).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/host/test/conformance.test.ts`
Expected: FAIL — `Renderer`/`Host` types not exported.

- [ ] **Step 3: Implement the interfaces**

`packages/host/src/renderer.ts`:
```ts
import type {
  Rect,
  Radii,
  FillStyle,
  StrokeStyle,
  Shadow,
  TextStyle,
  TextMeasurement,
  Point,
  ImageHandle,
} from './types';
import type { Path } from './path';

export interface Renderer {
  // Configure the surface for a logical size at a given DPR. May reset context
  // state — call BETWEEN frames, never between beginFrame()/endFrame().
  resize(logicalWidth: number, logicalHeight: number, devicePixelRatio: number): void;

  beginFrame(): void;
  endFrame(): void;
  clear(rect?: Rect): void;

  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  // Intersects the current clip; wrap in save()/restore() to scope it.
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
```

`packages/host/src/scheduler.ts`:
```ts
export interface FrameScheduler {
  requestFrame(cb: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
}
```

`packages/host/src/metrics.ts`:
```ts
export interface SurfaceMetrics {
  readonly width: number; // logical (CSS) pixels
  readonly height: number;
  readonly devicePixelRatio: number;
  onResize(cb: (metrics: SurfaceMetrics) => void): () => void; // returns unsubscribe
  dispose(): void; // tear down platform observers/listeners (call on unmount)
}
```

`packages/host/src/host.ts`:
```ts
import type { Renderer } from './renderer';
import type { FrameScheduler } from './scheduler';
import type { SurfaceMetrics } from './metrics';

// input / textInput / a11y are added in their own phases (7 / 8 / 14).
export interface Host {
  renderer: Renderer;
  scheduler: FrameScheduler;
  metrics: SurfaceMetrics;
}
```

`packages/host/src/index.ts` (append):
```ts
export type {
  Point,
  Rect,
  Radii,
  Color,
  GradientStop,
  Gradient,
  FillStyle,
  StrokeStyle,
  Shadow,
  TextStyle,
  TextMeasurement,
  ImageHandle,
} from './types';

export type { Path, PathCommand, PathBuilder } from './path';
export { createPath } from './path';

export type { Renderer } from './renderer';
export type { FrameScheduler } from './scheduler';
export type { SurfaceMetrics } from './metrics';
export type { Host } from './host';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/host`
Expected: PASS (all host tests: types 1 + path 3 + conformance 2 = 6).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(host): Renderer, FrameScheduler, SurfaceMetrics, Host interfaces"
```

---

## Task 4: @cairn/platform-web scaffold + WebFrameScheduler

**Files:**
- Create: `packages/platform-web/package.json`
- Create: `packages/platform-web/tsconfig.json`
- Create: `packages/platform-web/src/frame-scheduler.ts`
- Create: `packages/platform-web/src/index.ts`
- Modify: `package.json` (typecheck script)
- Test: `packages/platform-web/test/frame-scheduler.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/platform-web/test/frame-scheduler.test.ts`:
```ts
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebFrameScheduler } from '../src/index';

let raf: ReturnType<typeof vi.fn>;
let caf: ReturnType<typeof vi.fn>;

beforeEach(() => {
  raf = vi.fn((cb: FrameRequestCallback) => {
    return 42;
  });
  caf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('requestFrame delegates to requestAnimationFrame and returns the handle', () => {
  const scheduler = new WebFrameScheduler();
  const cb = vi.fn();
  const handle = scheduler.requestFrame(cb);
  expect(raf).toHaveBeenCalledTimes(1);
  expect(handle).toBe(42);
  // the callback passed to rAF should invoke our callback with the time
  const rafCb = raf.mock.calls[0][0] as FrameRequestCallback;
  rafCb(123.5);
  expect(cb).toHaveBeenCalledWith(123.5);
});

test('cancelFrame delegates to cancelAnimationFrame', () => {
  const scheduler = new WebFrameScheduler();
  scheduler.cancelFrame(7);
  expect(caf).toHaveBeenCalledWith(7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/platform-web/test/frame-scheduler.test.ts`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 3: Create the package + scheduler**

`packages/platform-web/package.json`:
```json
{
  "name": "@cairn/platform-web",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "sideEffects": false,
  "dependencies": {
    "@cairn/host": "workspace:*"
  }
}
```

`packages/platform-web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "test"]
}
```

`packages/platform-web/src/frame-scheduler.ts`:
```ts
import type { FrameScheduler } from '@cairn/host';

export class WebFrameScheduler implements FrameScheduler {
  requestFrame(cb: (timeMs: number) => void): number {
    return requestAnimationFrame(cb);
  }

  cancelFrame(handle: number): void {
    cancelAnimationFrame(handle);
  }
}
```

`packages/platform-web/src/index.ts`:
```ts
export { WebFrameScheduler } from './frame-scheduler';
```

- [ ] **Step 4: Update the root typecheck script + install**

Modify `package.json` `scripts.typecheck`:
```json
    "typecheck": "tsc --noEmit -p packages/reactivity/tsconfig.json && tsc --noEmit -p packages/host/tsconfig.json && tsc --noEmit -p packages/platform-web/tsconfig.json"
```

Run: `pnpm install`
Expected: no errors; `@cairn/host` symlinked into `@cairn/platform-web`.

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm vitest run packages/platform-web/test/frame-scheduler.test.ts`
Expected: PASS (2 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(platform-web): scaffold package + WebFrameScheduler"
```

---

## Task 5: WebSurfaceMetrics

**Files:**
- Create: `packages/platform-web/src/surface-metrics.ts`
- Modify: `packages/platform-web/src/index.ts`
- Test: `packages/platform-web/test/surface-metrics.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/platform-web/test/surface-metrics.test.ts`:
```ts
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSurfaceMetrics } from '../src/index';

// Minimal fake element with controllable client size.
function makeEl(w: number, h: number) {
  return { clientWidth: w, clientHeight: h } as unknown as HTMLElement;
}

let resizeCbs: Array<() => void>;
let observed: unknown[];

beforeEach(() => {
  resizeCbs = [];
  observed = [];
  class FakeResizeObserver {
    constructor(cb: () => void) {
      resizeCbs.push(cb);
    }
    observe(el: unknown) {
      observed.push(el);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver);
  vi.stubGlobal('devicePixelRatio', 2);
  // matchMedia is used for DPR-change detection; make it a no-op fake.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ addEventListener() {}, removeEventListener() {} })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('reports the element logical size and devicePixelRatio', () => {
  const metrics = new WebSurfaceMetrics(makeEl(300, 150));
  expect(metrics.width).toBe(300);
  expect(metrics.height).toBe(150);
  expect(metrics.devicePixelRatio).toBe(2);
});

test('observes the element for resize', () => {
  const el = makeEl(300, 150);
  new WebSurfaceMetrics(el);
  expect(observed).toContain(el);
});

test('notifies subscribers on resize with updated size', () => {
  const el = makeEl(300, 150);
  const metrics = new WebSurfaceMetrics(el);
  const cb = vi.fn();
  metrics.onResize(cb);

  // simulate a resize
  (el as unknown as { clientWidth: number }).clientWidth = 400;
  (el as unknown as { clientHeight: number }).clientHeight = 200;
  resizeCbs.forEach((fn) => fn());

  expect(cb).toHaveBeenCalledTimes(1);
  expect(metrics.width).toBe(400);
  expect(metrics.height).toBe(200);
  expect(cb.mock.calls[0][0].width).toBe(400);
});

test('unsubscribe stops notifications', () => {
  const el = makeEl(300, 150);
  const metrics = new WebSurfaceMetrics(el);
  const cb = vi.fn();
  const off = metrics.onResize(cb);
  off();
  resizeCbs.forEach((fn) => fn());
  expect(cb).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/platform-web/test/surface-metrics.test.ts`
Expected: FAIL — `WebSurfaceMetrics` not exported.

- [ ] **Step 3: Implement surface-metrics.ts**

`packages/platform-web/src/surface-metrics.ts`:
```ts
import type { SurfaceMetrics } from '@cairn/host';

export class WebSurfaceMetrics implements SurfaceMetrics {
  width: number;
  height: number;
  devicePixelRatio: number;

  private subscribers = new Set<(m: SurfaceMetrics) => void>();
  private observer: ResizeObserver;

  constructor(private element: HTMLElement) {
    this.width = element.clientWidth;
    this.height = element.clientHeight;
    this.devicePixelRatio = globalThis.devicePixelRatio ?? 1;

    this.observer = new ResizeObserver(() => this.update());
    this.observer.observe(element);
    this.watchDprChanges();
  }

  onResize(cb: (m: SurfaceMetrics) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private update(): void {
    const w = this.element.clientWidth;
    const h = this.element.clientHeight;
    const dpr = globalThis.devicePixelRatio ?? 1;
    if (w === this.width && h === this.height && dpr === this.devicePixelRatio) return;
    this.width = w;
    this.height = h;
    this.devicePixelRatio = dpr;
    for (const cb of this.subscribers) cb(this);
  }

  // Re-check on DPR changes (e.g. moving the window between monitors / zoom).
  private watchDprChanges(): void {
    const mql = matchMedia(`(resolution: ${this.devicePixelRatio}dppx)`);
    const handler = () => {
      this.update();
      this.watchDprChanges(); // media query is DPR-specific; re-arm for the new DPR
    };
    mql.addEventListener('change', handler, { once: true });
  }
}
```

- [ ] **Step 4: Export it**

`packages/platform-web/src/index.ts`:
```ts
export { WebFrameScheduler } from './frame-scheduler';
export { WebSurfaceMetrics } from './surface-metrics';
```

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm vitest run packages/platform-web/test/surface-metrics.test.ts`
Expected: PASS (4 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(platform-web): WebSurfaceMetrics with resize + DPR tracking"
```

---

## Task 6: Test fakes + Canvas2DRenderer core (surface, HiDPI, frame, clear)

**Files:**
- Create: `packages/platform-web/test/fakes.ts`
- Create: `packages/platform-web/src/canvas-surface.ts`
- Create: `packages/platform-web/src/canvas2d-renderer.ts`
- Modify: `packages/platform-web/src/index.ts`
- Test: `packages/platform-web/test/canvas2d-renderer.test.ts`

- [ ] **Step 1: Write the fake context + surface helpers**

`packages/platform-web/test/fakes.ts`:
```ts
// Recording fake of the subset of CanvasRenderingContext2D the renderer uses.
export interface FakeContext {
  calls: unknown[][];
  [key: string]: unknown;
}

const METHODS = [
  'save',
  'restore',
  'setTransform',
  'translate',
  'scale',
  'clearRect',
  'fillRect',
  'strokeRect',
  'beginPath',
  'rect',
  'roundRect',
  'moveTo',
  'lineTo',
  'arc',
  'quadraticCurveTo',
  'closePath',
  'fill',
  'stroke',
  'clip',
  'fillText',
  'drawImage',
] as const;

const PROPS = [
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'font',
  'textAlign',
  'textBaseline',
  'shadowColor',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
] as const;

export function createFakeContext(): FakeContext {
  const calls: unknown[][] = [];
  const ctx = { calls } as FakeContext;

  for (const name of METHODS) {
    ctx[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  }

  ctx.measureText = (text: string) => {
    calls.push(['measureText', text]);
    return { width: text.length * 7 };
  };

  const makeGradient = (kind: string, ...coords: unknown[]) => {
    calls.push([kind, ...coords]);
    const g = {
      addColorStop: (offset: number, color: string) => {
        calls.push(['addColorStop', offset, color]);
      },
    };
    return g;
  };
  ctx.createLinearGradient = (...c: unknown[]) => makeGradient('createLinearGradient', ...c);
  ctx.createRadialGradient = (...c: unknown[]) => makeGradient('createRadialGradient', ...c);

  for (const prop of PROPS) {
    let value: unknown;
    Object.defineProperty(ctx, prop, {
      get() {
        return value;
      },
      set(next) {
        value = next;
        calls.push(['set:' + prop, next]);
      },
    });
  }

  return ctx;
}

export function createFakeSurface() {
  const ctx = createFakeContext();
  const sizes: Array<[number, number]> = [];
  const surface = {
    context: ctx as unknown as CanvasRenderingContext2D,
    setBackingSize(w: number, h: number) {
      sizes.push([w, h]);
    },
  };
  return { surface, ctx, sizes };
}
```

- [ ] **Step 2: Write the failing test**

`packages/platform-web/test/canvas2d-renderer.test.ts`:
```ts
import { test, expect } from 'vitest';
import { Canvas2DRenderer } from '../src/index';
import { createFakeSurface } from './fakes';

test('resize sizes the backing store by DPR and sets the transform', () => {
  const { surface, ctx, sizes } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.resize(300, 150, 2);
  expect(sizes).toEqual([[600, 300]]); // logical * dpr
  expect(ctx.calls).toContainEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
});

test('clear without a rect clears the whole logical area', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.resize(300, 150, 1);
  r.clear();
  expect(ctx.calls).toContainEqual(['clearRect', 0, 0, 300, 150]);
});

test('clear with a rect clears just that rect', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.resize(300, 150, 1);
  r.clear({ x: 10, y: 20, width: 30, height: 40 });
  expect(ctx.calls).toContainEqual(['clearRect', 10, 20, 30, 40]);
});

test('beginFrame / endFrame save and restore context state', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.beginFrame();
  r.endFrame();
  const names = ctx.calls.map((c) => c[0]);
  expect(names).toEqual(['save', 'restore']);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/platform-web/test/canvas2d-renderer.test.ts`
Expected: FAIL — `Canvas2DRenderer` not exported.

- [ ] **Step 4: Implement canvas-surface.ts and the renderer core**

`packages/platform-web/src/canvas-surface.ts`:
```ts
// Decouples the renderer from the DOM canvas so it can be unit-tested with a fake.
export interface CanvasSurface {
  readonly context: CanvasRenderingContext2D;
  setBackingSize(widthPx: number, heightPx: number): void;
}

export class HtmlCanvasSurface implements CanvasSurface {
  readonly context: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[cairn] 2D canvas context is not available');
    this.context = ctx;
  }

  setBackingSize(widthPx: number, heightPx: number): void {
    this.canvas.width = widthPx;
    this.canvas.height = heightPx;
  }
}
```

`packages/platform-web/src/canvas2d-renderer.ts`:
```ts
import type { Rect, Renderer } from '@cairn/host';
import type { CanvasSurface } from './canvas-surface';

export class Canvas2DRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private logicalWidth = 0;
  private logicalHeight = 0;

  constructor(private surface: CanvasSurface) {
    this.ctx = surface.context;
  }

  // Size the backing store to logical*dpr and draw in logical coordinates.
  resize(logicalWidth: number, logicalHeight: number, dpr: number): void {
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.surface.setBackingSize(Math.round(logicalWidth * dpr), Math.round(logicalHeight * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  beginFrame(): void {
    this.ctx.save();
  }

  endFrame(): void {
    this.ctx.restore();
  }

  clear(rect?: Rect): void {
    if (rect) {
      this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    } else {
      this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    }
  }

  // ---- the rest of the Renderer surface is implemented in later tasks ----
  save(): void {
    this.ctx.save();
  }
  restore(): void {
    this.ctx.restore();
  }
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }
  scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }
  clipRect(rect: Rect): void {
    this.ctx.beginPath();
    this.ctx.rect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.clip();
  }
  setShadow(): void {}
  fillRect(): void {}
  strokeRect(): void {}
  fillRoundRect(): void {}
  strokeRoundRect(): void {}
  fillPath(): void {}
  strokePath(): void {}
  drawText(): void {}
  measureText(): { width: number } {
    return { width: 0 };
  }
  drawImage(): void {}
}
```

> NOTE: The empty method bodies above are filled in Tasks 7–8. They exist now only so the class satisfies the `Renderer` interface and the core tests (resize/clear/frame) compile and pass. Tasks 7–8 replace them with real implementations and add their own tests.

`packages/platform-web/src/index.ts`:
```ts
export { WebFrameScheduler } from './frame-scheduler';
export { WebSurfaceMetrics } from './surface-metrics';
export { Canvas2DRenderer } from './canvas2d-renderer';
export { HtmlCanvasSurface } from './canvas-surface';
export type { CanvasSurface } from './canvas-surface';
```

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm vitest run packages/platform-web/test/canvas2d-renderer.test.ts`
Expected: PASS (4 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(platform-web): Canvas2DRenderer core (surface, HiDPI resize, clear, frame)"
```

---

## Task 7: Canvas2DRenderer — state ops, shadow, rects (with color + gradient)

**Files:**
- Modify: `packages/platform-web/src/canvas2d-renderer.ts`
- Test: `packages/platform-web/test/canvas2d-renderer.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `packages/platform-web/test/canvas2d-renderer.test.ts`:
```ts
test('translate / scale / clipRect map to ctx calls', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.translate(5, 6);
  r.scale(2, 3);
  r.clipRect({ x: 1, y: 2, width: 3, height: 4 });
  expect(ctx.calls).toContainEqual(['translate', 5, 6]);
  expect(ctx.calls).toContainEqual(['scale', 2, 3]);
  expect(ctx.calls).toContainEqual(['rect', 1, 2, 3, 4]);
  expect(ctx.calls).toContainEqual(['clip']);
});

test('setShadow sets shadow props; null resets them', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.setShadow({ color: '#0008', blur: 4, offsetX: 1, offsetY: 2 });
  expect(ctx.calls).toContainEqual(['set:shadowColor', '#0008']);
  expect(ctx.calls).toContainEqual(['set:shadowBlur', 4]);
  expect(ctx.calls).toContainEqual(['set:shadowOffsetX', 1]);
  expect(ctx.calls).toContainEqual(['set:shadowOffsetY', 2]);

  r.setShadow(null);
  expect(ctx.calls).toContainEqual(['set:shadowColor', 'rgba(0,0,0,0)']);
  expect(ctx.calls).toContainEqual(['set:shadowBlur', 0]);
});

test('fillRect sets a solid fill then fills', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRect({ x: 1, y: 2, width: 3, height: 4 }, { color: '#f00' });
  expect(ctx.calls).toContainEqual(['set:fillStyle', '#f00']);
  expect(ctx.calls).toContainEqual(['fillRect', 1, 2, 3, 4]);
});

test('strokeRect sets stroke color + width then strokes', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.strokeRect({ x: 0, y: 0, width: 10, height: 10 }, { color: '#00f', width: 2 });
  expect(ctx.calls).toContainEqual(['set:strokeStyle', '#00f']);
  expect(ctx.calls).toContainEqual(['set:lineWidth', 2]);
  expect(ctx.calls).toContainEqual(['strokeRect', 0, 0, 10, 10]);
});

test('fillRect with a linear gradient builds the gradient with stops', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRect(
    { x: 0, y: 0, width: 10, height: 10 },
    {
      gradient: {
        kind: 'linear',
        from: { x: 0, y: 0 },
        to: { x: 10, y: 0 },
        stops: [
          { offset: 0, color: '#000' },
          { offset: 1, color: '#fff' },
        ],
      },
    },
  );
  expect(ctx.calls).toContainEqual(['createLinearGradient', 0, 0, 10, 0]);
  expect(ctx.calls).toContainEqual(['addColorStop', 0, '#000']);
  expect(ctx.calls).toContainEqual(['addColorStop', 1, '#fff']);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run packages/platform-web/test/canvas2d-renderer.test.ts`
Expected: the new tests FAIL (setShadow/fillRect/strokeRect are no-ops).

- [ ] **Step 3: Replace the stub methods with real implementations**

In `packages/platform-web/src/canvas2d-renderer.ts`, replace the placeholder methods `setShadow`, `fillRect`, `strokeRect` (leave `fillRoundRect`/`strokeRoundRect`/`fillPath`/`strokePath`/`drawText`/`measureText`/`drawImage` as their stubs for Task 8) and add the private style helpers. The full class body for the changed region:

```ts
  setShadow(shadow: import('@cairn/host').Shadow | null): void {
    if (shadow) {
      this.ctx.shadowColor = shadow.color;
      this.ctx.shadowBlur = shadow.blur;
      this.ctx.shadowOffsetX = shadow.offsetX;
      this.ctx.shadowOffsetY = shadow.offsetY;
    } else {
      this.ctx.shadowColor = 'rgba(0,0,0,0)';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }
  }

  fillRect(rect: Rect, style: import('@cairn/host').FillStyle): void {
    this.ctx.fillStyle = this.resolveFill(style);
    this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  strokeRect(rect: Rect, style: import('@cairn/host').StrokeStyle): void {
    this.applyStroke(style);
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  private resolveFill(style: import('@cairn/host').FillStyle): string | CanvasGradient {
    if (style.gradient) return this.buildGradient(style.gradient);
    return style.color ?? '#000';
  }

  private applyStroke(style: import('@cairn/host').StrokeStyle): void {
    this.ctx.strokeStyle = style.gradient
      ? this.buildGradient(style.gradient)
      : style.color ?? '#000';
    this.ctx.lineWidth = style.width ?? 1;
  }

  private buildGradient(g: import('@cairn/host').Gradient): CanvasGradient {
    let gradient: CanvasGradient;
    if (g.kind === 'linear') {
      gradient = this.ctx.createLinearGradient(g.from.x, g.from.y, g.to.x, g.to.y);
    } else {
      gradient = this.ctx.createRadialGradient(
        g.center.x,
        g.center.y,
        0,
        g.center.x,
        g.center.y,
        g.radius,
      );
    }
    for (const stop of g.stops) gradient.addColorStop(stop.offset, stop.color);
    return gradient;
  }
```

> To keep imports clean, instead of the inline `import('@cairn/host')` types you may extend the top import to:
> ```ts
> import type { Rect, Renderer, Shadow, FillStyle, StrokeStyle, Gradient } from '@cairn/host';
> ```
> and drop the inline `import(...)` qualifiers. Do that now — update the top import line and use the bare type names in the method signatures above.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run packages/platform-web/test/canvas2d-renderer.test.ts`
Expected: PASS (9 tests: 4 from Task 6 + 5 new).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(platform-web): renderer state ops, shadow, rects with color+gradient"
```

---

## Task 8: Canvas2DRenderer — rounded rects, paths, text, images

**Files:**
- Modify: `packages/platform-web/src/canvas2d-renderer.ts`
- Test: `packages/platform-web/test/canvas2d-renderer.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `packages/platform-web/test/canvas2d-renderer.test.ts`:
```ts
import { createPath } from '@cairn/host';

test('fillRoundRect uses roundRect with normalized radii then fills', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRoundRect({ x: 1, y: 2, width: 10, height: 20 }, 4, { color: '#abc' });
  expect(ctx.calls).toContainEqual(['set:fillStyle', '#abc']);
  expect(ctx.calls).toContainEqual(['beginPath']);
  expect(ctx.calls).toContainEqual(['roundRect', 1, 2, 10, 20, [4, 4, 4, 4]]);
  expect(ctx.calls).toContainEqual(['fill']);
});

test('fillRoundRect accepts per-corner radii', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.fillRoundRect(
    { x: 0, y: 0, width: 8, height: 8 },
    { tl: 1, tr: 2, br: 3, bl: 4 },
    { color: '#000' },
  );
  expect(ctx.calls).toContainEqual(['roundRect', 0, 0, 8, 8, [1, 2, 3, 4]]);
});

test('fillPath plays back the path commands then fills', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const path = createPath().moveTo(0, 0).lineTo(10, 0).quadTo(10, 10, 0, 10).close().build();
  r.fillPath(path, { color: '#123' });
  expect(ctx.calls).toContainEqual(['beginPath']);
  expect(ctx.calls).toContainEqual(['moveTo', 0, 0]);
  expect(ctx.calls).toContainEqual(['lineTo', 10, 0]);
  expect(ctx.calls).toContainEqual(['quadraticCurveTo', 10, 10, 0, 10]);
  expect(ctx.calls).toContainEqual(['closePath']);
  expect(ctx.calls).toContainEqual(['fill']);
});

test('strokePath plays back the path then strokes', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const path = createPath().moveTo(0, 0).arc(5, 5, 5, 0, 3.14).build();
  r.strokePath(path, { color: '#456', width: 3 });
  expect(ctx.calls).toContainEqual(['moveTo', 0, 0]);
  expect(ctx.calls).toContainEqual(['arc', 5, 5, 5, 0, 3.14]);
  expect(ctx.calls).toContainEqual(['set:lineWidth', 3]);
  expect(ctx.calls).toContainEqual(['stroke']);
});

test('drawText sets font/color/align/baseline then fills text', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  r.drawText('hi', { x: 3, y: 4 }, {
    font: '16px sans-serif',
    color: '#222',
    align: 'center',
    baseline: 'middle',
  });
  expect(ctx.calls).toContainEqual(['set:font', '16px sans-serif']);
  expect(ctx.calls).toContainEqual(['set:fillStyle', '#222']);
  expect(ctx.calls).toContainEqual(['set:textAlign', 'center']);
  expect(ctx.calls).toContainEqual(['set:textBaseline', 'middle']);
  expect(ctx.calls).toContainEqual(['fillText', 'hi', 3, 4]);
});

test('measureText sets the font and returns the measured width', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const m = r.measureText('hello', { font: '10px monospace' });
  expect(ctx.calls).toContainEqual(['set:font', '10px monospace']);
  expect(ctx.calls).toContainEqual(['measureText', 'hello']);
  expect(m.width).toBe(35); // fake: 5 chars * 7
});

test('drawImage draws with dest only', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const img = { width: 20, height: 10 };
  r.drawImage(img, { x: 1, y: 2, width: 20, height: 10 });
  expect(ctx.calls).toContainEqual(['drawImage', img, 1, 2, 20, 10]);
});

test('drawImage draws with src and dest rects', () => {
  const { surface, ctx } = createFakeSurface();
  const r = new Canvas2DRenderer(surface);
  const img = { width: 20, height: 10 };
  r.drawImage(img, { x: 0, y: 0, width: 10, height: 5 }, { x: 2, y: 3, width: 4, height: 6 });
  expect(ctx.calls).toContainEqual(['drawImage', img, 2, 3, 4, 6, 0, 0, 10, 5]);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run packages/platform-web/test/canvas2d-renderer.test.ts`
Expected: the 8 new tests FAIL (methods are stubs).

- [ ] **Step 3: Implement the remaining methods**

In `packages/platform-web/src/canvas2d-renderer.ts`, extend the top type import to include the remaining types and replace the stub methods `fillRoundRect`, `strokeRoundRect`, `fillPath`, `strokePath`, `drawText`, `measureText`, `drawImage` with:

Update the import line to:
```ts
import type {
  Rect,
  Renderer,
  Shadow,
  FillStyle,
  StrokeStyle,
  Gradient,
  Radii,
  Path,
  Point,
  TextStyle,
  TextMeasurement,
  ImageHandle,
} from '@cairn/host';
```

Replace the stub methods with:
```ts
  fillRoundRect(rect: Rect, radii: Radii, style: FillStyle): void {
    this.ctx.fillStyle = this.resolveFill(style);
    this.ctx.beginPath();
    this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, normalizeRadii(radii));
    this.ctx.fill();
  }

  strokeRoundRect(rect: Rect, radii: Radii, style: StrokeStyle): void {
    this.applyStroke(style);
    this.ctx.beginPath();
    this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, normalizeRadii(radii));
    this.ctx.stroke();
  }

  fillPath(path: Path, style: FillStyle): void {
    this.ctx.fillStyle = this.resolveFill(style);
    this.tracePath(path);
    this.ctx.fill();
  }

  strokePath(path: Path, style: StrokeStyle): void {
    this.applyStroke(style);
    this.tracePath(path);
    this.ctx.stroke();
  }

  drawText(text: string, pos: Point, style: TextStyle): void {
    this.ctx.font = style.font;
    this.ctx.fillStyle = style.color ?? '#000';
    this.ctx.textAlign = style.align ?? 'left';
    this.ctx.textBaseline = style.baseline ?? 'alphabetic';
    this.ctx.fillText(text, pos.x, pos.y);
  }

  measureText(text: string, style: TextStyle): TextMeasurement {
    this.ctx.font = style.font;
    return { width: this.ctx.measureText(text).width };
  }

  drawImage(image: ImageHandle, dest: Rect, src?: Rect): void {
    const img = image as unknown as CanvasImageSource;
    if (src) {
      this.ctx.drawImage(
        img,
        src.x,
        src.y,
        src.width,
        src.height,
        dest.x,
        dest.y,
        dest.width,
        dest.height,
      );
    } else {
      this.ctx.drawImage(img, dest.x, dest.y, dest.width, dest.height);
    }
  }

  private tracePath(path: Path): void {
    this.ctx.beginPath();
    for (const cmd of path.commands) {
      switch (cmd.type) {
        case 'moveTo':
          this.ctx.moveTo(cmd.x, cmd.y);
          break;
        case 'lineTo':
          this.ctx.lineTo(cmd.x, cmd.y);
          break;
        case 'arc':
          this.ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.start, cmd.end);
          break;
        case 'quadTo':
          this.ctx.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y);
          break;
        case 'close':
          this.ctx.closePath();
          break;
      }
    }
  }
```

Add this module-level helper at the bottom of the file (after the class):
```ts
function normalizeRadii(r: Radii): [number, number, number, number] {
  return typeof r === 'number' ? [r, r, r, r] : [r.tl, r.tr, r.br, r.bl];
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run packages/platform-web/test/canvas2d-renderer.test.ts`
Expected: PASS (17 tests: 9 + 8 new).

Run: `pnpm typecheck`
Expected: no errors.

> If `roundRect` reports a type error, it means the DOM lib version lacks it; in that case cast: `(this.ctx as CanvasRenderingContext2D & { roundRect(...args: unknown[]): void })`. Only do this if the error actually occurs.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(platform-web): renderer rounded rects, paths, text, images"
```

---

## Task 9: createWebHost

**Files:**
- Create: `packages/platform-web/src/create-web-host.ts`
- Modify: `packages/platform-web/src/index.ts`
- Test: `packages/platform-web/test/create-web-host.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/platform-web/test/create-web-host.test.ts`:
```ts
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebHost } from '../src/index';
import { createFakeContext } from './fakes';

let fakeCtx: ReturnType<typeof createFakeContext>;

beforeEach(() => {
  fakeCtx = createFakeContext();
  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver);
  vi.stubGlobal('devicePixelRatio', 2);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ addEventListener() {}, removeEventListener() {} })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeCanvas(w: number, h: number) {
  return {
    clientWidth: w,
    clientHeight: h,
    width: 0,
    height: 0,
    getContext: () => fakeCtx,
  } as unknown as HTMLCanvasElement;
}

test('createWebHost returns a Host with renderer, scheduler, and metrics', () => {
  const host = createWebHost(fakeCanvas(300, 150));
  expect(typeof host.renderer.fillRect).toBe('function');
  expect(typeof host.scheduler.requestFrame).toBe('function');
  expect(host.metrics.width).toBe(300);
  expect(host.metrics.height).toBe(150);
  expect(host.metrics.devicePixelRatio).toBe(2);
});

test('createWebHost configures the renderer backing store from metrics (DPR applied)', () => {
  const canvas = fakeCanvas(300, 150);
  createWebHost(canvas);
  // backing store = logical * dpr
  expect(canvas.width).toBe(600);
  expect(canvas.height).toBe(300);
  expect(fakeCtx.calls).toContainEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/platform-web/test/create-web-host.test.ts`
Expected: FAIL — `createWebHost` not exported.

- [ ] **Step 3: Implement create-web-host.ts**

`packages/platform-web/src/create-web-host.ts`:
```ts
import type { Host } from '@cairn/host';
import { HtmlCanvasSurface } from './canvas-surface';
import { Canvas2DRenderer } from './canvas2d-renderer';
import { WebFrameScheduler } from './frame-scheduler';
import { WebSurfaceMetrics } from './surface-metrics';

export function createWebHost(canvas: HTMLCanvasElement): Host {
  const renderer = new Canvas2DRenderer(new HtmlCanvasSurface(canvas));
  const scheduler = new WebFrameScheduler();
  const metrics = new WebSurfaceMetrics(canvas);

  const configure = () => renderer.resize(metrics.width, metrics.height, metrics.devicePixelRatio);
  configure(); // initial sizing
  metrics.onResize(configure); // keep backing store in sync

  return { renderer, scheduler, metrics };
}
```

`packages/platform-web/src/index.ts`:
```ts
export { WebFrameScheduler } from './frame-scheduler';
export { WebSurfaceMetrics } from './surface-metrics';
export { Canvas2DRenderer } from './canvas2d-renderer';
export { HtmlCanvasSurface } from './canvas-surface';
export type { CanvasSurface } from './canvas-surface';
export { createWebHost } from './create-web-host';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/platform-web/test/create-web-host.test.ts`
Expected: PASS (2 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(platform-web): createWebHost wiring renderer + scheduler + metrics"
```

---

## Task 10: Example, READMEs, and full-workspace green

**Files:**
- Create: `examples/shapes/index.html`
- Create: `examples/shapes/main.ts`
- Create: `packages/host/README.md`
- Create: `packages/platform-web/README.md`

- [ ] **Step 1: Create the manual example**

`examples/shapes/index.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Cairn — shapes</title>
    <style>
      html, body { margin: 0; height: 100%; }
      #stage { display: block; width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <canvas id="stage"></canvas>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`examples/shapes/main.ts`:
```ts
import { createWebHost } from '@cairn/platform-web';
import { createPath } from '@cairn/host';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);
const r = host.renderer;

function draw() {
  r.beginFrame();
  r.clear();

  r.setShadow({ color: '#0006', blur: 12, offsetX: 0, offsetY: 4 });
  r.fillRoundRect({ x: 40, y: 40, width: 220, height: 120 }, 16, {
    gradient: {
      kind: 'linear',
      from: { x: 40, y: 40 },
      to: { x: 260, y: 160 },
      stops: [
        { offset: 0, color: '#6ee7b7' },
        { offset: 1, color: '#3b82f6' },
      ],
    },
  });
  r.setShadow(null);

  r.drawText('Cairn', { x: 60, y: 110 }, {
    font: 'bold 40px sans-serif',
    color: '#0f172a',
    baseline: 'middle',
  });

  const tri = createPath().moveTo(320, 60).lineTo(420, 160).lineTo(320, 160).close().build();
  r.fillPath(tri, { color: '#f59e0b' });

  r.endFrame();
}

draw();
host.metrics.onResize(draw);
```

- [ ] **Step 2: Write the READMEs**

`packages/host/README.md`:
```markdown
# @cairn/host

The platform seam for Cairn. Pure, DOM-free interfaces and value types that the
core depends on; concrete platforms (e.g. `@cairn/platform-web`) implement them.

## Exports

- `Renderer` — high-level immediate-mode drawing API (rects, rounded rects, text,
  images, strokes, gradients, shadows, arbitrary paths). Works in logical CSS pixels.
- `FrameScheduler` — `requestFrame` / `cancelFrame`.
- `SurfaceMetrics` — logical size, `devicePixelRatio`, and an `onResize` subscription.
- `Host` — bundles `renderer`, `scheduler`, `metrics`. (input / textInput / a11y are
  added in later phases.)
- Value types: `Point`, `Rect`, `Radii`, `Color`, `Gradient`, `FillStyle`, `StrokeStyle`,
  `Shadow`, `TextStyle`, `ImageHandle`.
- `createPath()` — immutable path builder.

This package has **no DOM dependency** — enforced by `tsconfig` `lib: ["ES2022"]`.
```

`packages/platform-web/README.md`:
```markdown
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
```

- [ ] **Step 3: Run the full workspace suite + typecheck**

Run: `pnpm vitest run`
Expected: PASS — all packages green (reactivity 40 + host 6 + platform-web 17+2+4+2 = 71 total; exact count may vary slightly, all passing).

Run: `pnpm typecheck`
Expected: no errors across reactivity, host, platform-web.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(platform-web): shapes example + package READMEs; finalize Phase 2"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** Renderer (extended, immediate, style objects) → Tasks 3/6/7/8. FrameScheduler → Tasks 3/4. SurfaceMetrics → Tasks 3/5. Host (three services now) → Tasks 3/9. HiDPI logical-pixel + DPR backing store → Tasks 6/9. DOM-free core via `lib` → Task 1 (with an explicit guard-verification step). Mock-context renderer tests → Tasks 6–8. Example → Task 10. `createPath` → Task 2.
- **Deferred (per spec):** `InputSource`/`TextInputService`/`AccessibilityBridge` are NOT added to `Host` here (Phases 7/8/14).
- **Type consistency:** `CanvasSurface` = `{ context, setBackingSize }` used identically in `HtmlCanvasSurface`, `Canvas2DRenderer`, and `createFakeSurface`. `Canvas2DRenderer.resize(logicalW, logicalH, dpr)` signature is used the same way in tests and in `createWebHost`. Renderer method names match the `@cairn/host` `Renderer` interface exactly.
- **Fake fidelity caveat:** the fake context's `measureText` returns `length * 7` and records calls; tests assert against that. Real Canvas text metrics differ — text-measurement correctness is exercised via the manual example and later phases, not the unit fake.
```
