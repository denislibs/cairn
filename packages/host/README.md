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
  `Shadow`, `TextStyle`, `TextMeasurement`, `ImageHandle`.
- `createPath()` — immutable path builder.

This package has **no DOM dependency** — enforced by `tsconfig` `lib: ["ES2022"]`.
Any reference to `document`/`window` here is a compile error.
