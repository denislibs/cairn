# P10-2 — Image async (loading / cache / spinner) — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Phase 10 UI-kit roadmap (P10-2).

## Goal
`Image` accepts a URL string `src`: loads it asynchronously, caches by URL, shows a spinner while loading and an error fallback on failure. The existing `src: ImageHandle` (synchronous) path is preserved.

## 1. Host image-loading seam
`Host` gains `loadImage?(url: string): Promise<ImageHandle>` (optional, like `setCursor`). `@cairn/platform-web`:
- `packages/platform-web/src/image-loader.ts`: `createImageLoader(): (url: string) => Promise<ImageHandle>` with a module/closure-level `Map<string, Promise<ImageHandle>>` cache. Loading uses `new window.Image()`; `onload` → resolve the element (it structurally satisfies `ImageHandle` via `naturalWidth`/`width`; use `{ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }`-compatible handle — actually return the `HTMLImageElement`, which the renderer's `drawImage` already accepts as `CanvasImageSource`, and expose `width`/`height` — HTMLImageElement has `width`/`height` but they may be 0 until loaded; set them from `naturalWidth`/`naturalHeight` after load by returning a thin wrapper `{ width, height, image }`? The renderer casts the handle to `CanvasImageSource` directly. So the handle MUST be the drawable element. Return the `HTMLImageElement`; after `onload` its `naturalWidth`/`naturalHeight` are set and `width`/`height` reflect them → satisfies `ImageHandle` (`readonly width/height`) and draws. Cache the resolved element.)
- `onerror` → reject. A failed URL's rejected promise is cached (so it isn't retried every frame); a `clearImageCache()` helper is exported for tests.
- `createWebHost` wires `loadImage: createImageLoader()`.

## 2. `Spinner` (`@cairn/widgets`)
A rotating arc loading indicator. `Spinner({ size?, color?, thickness? })` (defaults 24 / `#9ca3af` / 3). A raw `Instance` with a `BoxNode(size)`; `paintSelf` strokes a 270° arc (`createPath().arc(cx, cy, r, angle, angle + 1.5π)` → `strokePath`) at a rotating `angle`. Rotation is driven by a self-looping `useHost().scheduler.requestFrame` loop that advances an `angle` signal each frame; `onCleanup` stops the loop (so it only spins while mounted). Read by `paintSelf` via the signal.

## 3. `Image` async src
`ImageProps.src: ImageHandle | string`. When `src` is a string:
- The `Image` instance's `BoxNode` gets `alignX/alignY: 'center'` so a spinner child centers.
- State signals: `handle` (ImageHandle | null), `status` ('loading' | 'loaded' | 'error').
- On creation, `useHost().loadImage(src)` (cached) → on resolve `setHandle(h); setStatus('loaded')`; on reject `setStatus('error')`. Reactively (a `bind`/effect) set `instance.children = status==='loading' ? [Spinner(...)] : []` and `scheduleFrame`.
- `paintSelf`: if `handle()` → `drawImage` fitted by `objectFit` (as today); if `status==='error'` → a muted fallback (fill a light-gray rounded rect + a small broken-image glyph via a Path, or just a fill + centered "×"); loading → paints nothing (the Spinner child shows).
- `src` changing (reactive) re-triggers load (optional v1: `src` treated as static; document — most images have a fixed URL). Keep it simple: read `src` once; if reactivity needed later, add.
- ImageHandle `src` path unchanged (synchronous draw, no spinner).

## Testing
- `createImageLoader`: returns the same cached promise for the same URL (call twice → identical promise); (loading itself needs a DOM `Image` — in jsdom/node, mock `globalThis.Image` or guard; test the CACHE behavior with a stubbed loader factory that counts calls).
- `Spinner`: builds an Instance with a BoxNode of the given size; `paintSelf` calls `strokePath` (recording renderer). (Rotation loop uses the host scheduler — test it starts a frame request under a fake host.)
- `Image` async: with a fake host whose `loadImage` returns a controllable promise, an `Image({ src: 'x', ... })` starts in `loading` (has a Spinner child); after the promise resolves with a handle, children clear and `paintSelf` draws the image; on reject, error fallback (no throw). ImageHandle path: draws immediately, no children.
- Full `pnpm test` + `pnpm typecheck` green; existing Image (ImageHandle) tests unchanged.

## Exit criteria
- URL `Image` loads async with cache, spinner while loading, error fallback; `Spinner` widget; tested.
- Live browser check: an `Image` with a URL (data-URL or local asset) shows a spinner then the image.
- Capability doc §10 Image row notes async URL loading + cache + spinner. One PR merged.

## Out of scope
Lazy-load-on-scroll, srcset/responsive images, progressive/blur-up placeholders, retry/backoff, cross-origin config, SVG-as-image.
