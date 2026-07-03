# Styling S3 — Transforms + Effects — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** 2D transforms + origin, multi/spread/elevation shadows, canvas `filter`, `backgroundImage` on Box.

**Architecture:** Renderer gains `rotate`/`transform`/`setFilter`; paint walker applies `Instance.transform` (pivot around origin) to the subtree; `Box` paints richer shadows / filter / backgroundImage.

Design ref: `docs/superpowers/specs/2026-07-03-styling-s3-transforms-effects-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: host, platform-web, style, runtime, primitives.

---

### Task 1: Renderer rotate + transform + setFilter
- Files: `packages/host/src/renderer.ts`, `packages/platform-web/src/canvas2d-renderer.ts`, test `packages/platform-web/test/canvas2d-renderer.test.ts`; add the 3 methods to every renderer fake/no-op (`packages/host/test/conformance.test.ts`, `packages/primitives/test/recording-renderer.ts` + `packages/widgets/test/recording-renderer.ts` method-name arrays, `packages/*/test/fake*.ts`).
- `rotate(rad)` → `ctx.rotate(rad)`; `transform(a,b,c,d,e,f)` → `ctx.transform(...)`; `setFilter(f: string|null)` → `if ('filter' in ctx) ctx.filter = f ?? 'none'`.
- TDD: mock-ctx asserts each call. Full suite green.

### Task 2: transform + transformOrigin (style + walker)
- Files: `packages/style/src/style.ts` (+`Transform` type, `transform`, `transformOrigin`), `packages/style/src/index.ts` (export `Transform`), new `packages/primitives/src/transform.ts` (`applyTransform(r, t, origin, size)`), `packages/runtime/src/instance.ts` (`Instance.transform`/`transformOrigin` + apply in `paint`), `packages/primitives/src/box.ts` + `flex.ts` (set from style), tests.
- `applyTransform(r, t, origin, size)`: `const ox=origin?.x ?? size.w/2, oy=origin?.y ?? size.h/2; r.translate(ox,oy); if(t.translateX||t.translateY) r.translate(t.translateX||0,t.translateY||0); if(t.rotate) r.rotate(t.rotate*Math.PI/180); const sx=t.scaleX ?? t.scale ?? 1, sy=t.scaleY ?? t.scale ?? 1; if(sx!==1||sy!==1) r.scale(sx,sy); if(t.skewX||t.skewY) r.transform(1, Math.tan((t.skewY||0)*Math.PI/180), Math.tan((t.skewX||0)*Math.PI/180), 1, 0, 0); r.translate(-ox,-oy);`
- Walker: in `paint`, after translate(offset)+alpha, before `paintSelf`: `if (inst.transform) applyTransform(r, inst.transform, inst.transformOrigin ?? undefined, inst.layout.size);` — but `applyTransform` lives in primitives (dep cycle risk: runtime must not import primitives). SOLUTION: inline the transform math directly in `instance.ts` (runtime) using only `Renderer` calls; keep a copy of the pivot math there, and ALSO export `applyTransform` from primitives for reuse/testing OR just implement in runtime and test via the walker. Simplest: implement the pivot math inline in `instance.ts` (no primitives import); put the `Transform` TYPE in `@cairn/style` (runtime already may depend on style? check — runtime imports from host/layout/reactivity; add a type-only import of `Transform` from `@cairn/style` if runtime depends on style, else define a minimal structural type in runtime). Verify deps: if runtime does NOT depend on @cairn/style, define `Instance.transform` with a structural inline type matching `Transform`.
- Box/Flex: `instance.transform = s.transform; instance.transformOrigin = s.transformOrigin;` in the bind.
- TDD: walker emits rotate/translate/scale for a transform; box sets it from style.

### Task 3: shadows — array / spread / inset / elevation
- Files: `packages/style/src/style.ts` (`Shadow.spread?`, `Shadow.inset?`; `boxShadow?: Shadow | Shadow[]`; `elevation?: number`), `packages/primitives/src/box.ts` (paint), test `packages/primitives/test/box-shadow.test.ts`.
- Normalize boxShadow to array; add elevation preset (a small `elevationShadow(n)` map). Draw drop shadows (inflate rect+radius by `spread`, offset) BEFORE the fill; inset best-effort after fill inside a clip.
- TDD: array → N shadowed fills; spread inflates the shadowed rect; elevation yields a shadow.

### Task 4: filter (+ backdropFilter best-effort)
- Files: `packages/style/src/style.ts` (+`filter?: string`, `backdropFilter?: string`), `packages/primitives/src/box.ts`, test.
- `Box.paintSelf`: wrap fill/content draw in `setFilter(s.filter)` / `setFilter(null)`. `backdropFilter`: best-effort (documented) — may be deferred to a note if a faithful impl isn't cheap; at minimum store+typecheck it and apply `setFilter` around a clipped re-fill. Keep `filter` solid and tested.
- TDD: `setFilter` set+reset around content when `filter` set; none otherwise.

### Task 5: backgroundImage on Box
- Files: `packages/style/src/style.ts` (+`backgroundImage?: ImageHandle`, `backgroundSize?`), `packages/primitives/src/box.ts` (paint via `computeObjectFit` from `./image`), test.
- After the fill, if `backgroundImage`: `save(); clipRoundRect(box, radius); drawImage(fitted); restore()`.
- TDD: drawImage called (fitted rects) when backgroundImage set.

### Task 6: doc flip + verify
- Flip `docs/styling-and-capabilities.md`: §3 `backgroundImage`/`objectFit` ✅, `backdropFilter` (best-effort note); §5 `boxShadow` (multi/spread/inset) ✅, `textShadow` already ✅, `elevation` ✅, `filter` ✅; §7 `rotate`/`skew` ✅, `transformOrigin` ✅, translate/scale ✅. Update BaseStyle snapshot. Full `pnpm test` + `pnpm typecheck` green.

---

## Self-review
- Coverage: renderer (T1), transform+walker (T2), shadows (T3), filter (T4), bgImage (T5), doc (T6).
- Dep hygiene: runtime must not import @cairn/primitives — implement transform pivot math inline in `instance.ts`; `Transform` type from @cairn/style (type-only) or structural.
- Backward-compat: all new fields optional; defaults leave paint identical (existing tests green).
