# Styling S7 — Animations & Transitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** easing + interpolation, `animate` driver, declarative `transition` (opacity/color/backgroundColor), imperative keyframes + spring.

Design ref: `docs/superpowers/specs/2026-07-03-styling-s7-animation-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: style, runtime, primitives.

---

### Task 1: easing + interpolation (pure, @cairn/style)
- Files: `packages/style/src/easing.ts`, `packages/style/src/interpolate.ts`, export from `index.ts`. Tests `packages/style/test/easing.test.ts`, `interpolate.test.ts`.
- easing: `EasingName`, `easings` (linear/ease/ease-in/out/in-out via cubicBezier presets), `cubicBezier(x1,y1,x2,y2)` (Newton-Raphson sampling), `resolveEasing(e)`, `spring(stiffness?,damping?)` returning `(t)=>number` (approx; document).
- interpolate: `lerp(a,b,t)`; parse colors (`#rgb`,`#rrggbb`,`rgb()`,`rgba()`) → `[r,g,b,a]`; `lerpColor(a,b,t)` → `rgba(r,g,b,a)`; `interpolateValue(a,b,t)` (number→lerp, color→lerpColor, else snap at t>=1).
- TDD: easing endpoints/monotonic; lerpColor midpoint; interpolateValue branches.

### Task 2: `animate` driver (@cairn/runtime)
- Files: `packages/runtime/src/animate.ts` (`animate`, `AnimateOptions`), export from `packages/runtime/src/index.ts`. Test `packages/runtime/test/animate.test.ts` with a fake host (scheduler.requestFrame invokes cb with scripted timestamps).
- Uses `useHost().scheduler.requestFrame`; records start on first tick; `t=clamp((now-start-delay)/duration,0,1)`; `onUpdate(from+(to-from)*eased(t))`; re-request until done; `onDone`; returns cancel (flag + cancelFrame); `onCleanup(cancel)`.
- TDD: feed timestamps 0,dur/2,dur → onUpdate gets from, mid, to; onDone fires once; cancel stops further ticks. (Provide a fake host via `runWithContext(hostContext, fakeHost, () => { ... })` — check how tests build a fake host, e.g. `packages/runtime/test/fake-host.ts`.)

### Task 3: declarative `transition` (@cairn/primitives)
- Files: `packages/style/src/style.ts` (+`transition?`, `TransitionConfig`), `packages/primitives/src/transitions.ts` (`createStyleTransitions`), `packages/primitives/src/box.ts` + `text.ts` (route reactive style through it when `transition` present), test `packages/primitives/test/transitions.test.ts`.
- `TransitionConfig { properties?: string[]; duration: number; easing?: EasingName | ((t)=>number); delay?: number }`; `transition?: TransitionConfig | TransitionConfig[]`.
- `createStyleTransitions(resolved: () => BaseStyle): () => BaseStyle`:
  - animatable = `['opacity','backgroundColor','color']`.
  - per prop: a signal seeded from `untrack(resolved)`'s value.
  - `createEffect` on `resolved()`: for each animatable prop, find its matching TransitionConfig (properties includes it or no properties); if found and target !== current signal value → `animate({from: currentNumericOrColor, to: target, ..., onUpdate: setSig})` using `interpolateValue` for colors (animate drives 0→1 progress; onUpdate computes `interpolateValue(from,to,t)` — so wrap: use `animate` with from=0,to=1 and onUpdate(t)=> setSig(interpolateValue(from,to,t))). If no transition for the prop → set signal = target immediately (snap). Cancel a prop's in-flight tween when a new target arrives.
  - returns `() => { const r = resolved(); return { ...r, opacity: opSig(), backgroundColor: bgSig(), color: colorSig() }; }` — but only override props that are actually transitioned; for non-transitioned, the snap keeps them equal to r anyway, so overriding is safe. Guard: seed signals lazily.
  - Guard opacity/color possibly undefined (skip animating undefined→value; snap).
- Box/Text: `const styleSource = /* has transition? */ createStyleTransitions(resolved) : resolved;` then `bind(styleSource, s => {...})`. Detect "has transition" via `untrack(() => resolved().transition != null)` (cheap) — or always wrap (createStyleTransitions with no transitions just snaps = passthrough). Prefer: always route through createStyleTransitions (it's passthrough when no transition config), simpler. Ensure zero animation overhead when no transition.
- TDD: with a fake host scheduler, a Box whose resolved opacity changes 1→0 with `transition:{properties:['opacity'],duration:100}` → intermediate opacity values via the animated style accessor; without transition → snaps.

### Task 4: imperative keyframes + exports
- Files: `packages/runtime/src/keyframes.ts` (`animateKeyframes`), export `animate`/`animateKeyframes` from runtime index; ensure `spring`/easings exported from style index. Test `packages/runtime/test/keyframes.test.ts`.
- `animateKeyframes(frames: {at:number; value:number}[], opts: {duration; easing?; onUpdate; onDone?}): cancel` — sort frames by `at`; run sequential `animate` between consecutive frames with per-segment duration = `(at2-at1)*duration`; chain via onDone. Returns a cancel stopping the current segment.
- TDD: 3 frames → onUpdate passes through the values across segments (fake scheduler).

### Task 5: doc flip + example + verify
- Flip `docs/styling-and-capabilities.md` §8: `transition` ✅ (opacity/color/backgroundColor declaratively; other props via imperative `animate`); keyframes ✅ (imperative `animateKeyframes`); spring ✅ (approx preset); FLIP ❌ (deferred, note). Update snapshot (animation utilities: `animate`, `animateKeyframes`, easings, `spring`, `transition`). Optionally animate the counter (e.g. transition button bg on hover). Full `pnpm test` + `pnpm typecheck` green.
- Since this completes S1–S7, also add a short "styling block complete" note near the top of `docs/styling-and-capabilities.md`.

---

## Self-review
- Coverage: easing/interp (T1), driver (T2), transition (T3), keyframes/spring (T4), doc (T5).
- Backward-compat: no `transition` → createStyleTransitions passthrough/snaps → identical; animate only runs when invoked.
- Risk: transition effect loops — cancel prior tween on new target; seed signals from untrack; snap undefined. Test the passthrough (no-transition) case stays synchronous.
