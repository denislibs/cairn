# DT4d — Performance Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the DevTools Performance tab a real frame-phase profiler — measure layout/a11y/paint per frame, thread it through the commit meta, and render a phase flame for the slowest frame plus Record/Reload controls.

**Architecture:** `renderFrame` timestamps each phase (layout → a11y → paint) and passes a `FrameTiming` to the runtime dev hook. The agent puts `phases` into `CommitMeta` (durationMs stays = total). The panel's `renderPerf` draws a phase flame for the slowest frame in the current window and adds Record (capture/freeze) + Reload.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, esbuild (extension), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-05-dt4d-performance-design.md`

---

## File Structure

**Core:**
- `packages/runtime/src/devtools-hook.ts` — `FrameTiming` type; widen `onCommit`/`emitCommit` to take it.
- `packages/runtime/src/mount.ts` — phase timestamps; call `emitCommit` with a `FrameTiming`.
- `packages/runtime/src/index.ts` — export `FrameTiming`.

**`@cairn/devtools`:**
- `protocol.ts` — `CommitMeta.phases`.
- `agent.ts` — consume `timing`: `durationMs = timing.total`, `phases` from timing; get-snapshot fallback phases.

**Extension:** `src/panel/panel.ts` — `renderPerf` phase flame + Record/Reload; `README.md` checklist.

**Tests:** runtime `devtools-commit.test.ts` (timing), agent test (phases), Playwright e2e (phases in meta).

---

## Task 1: Measure frame phases + widen the runtime hook

**Files:**
- Modify: `packages/runtime/src/devtools-hook.ts`
- Modify: `packages/runtime/src/mount.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/devtools-commit.test.ts`

- [ ] **Step 1: Widen the hook type**

In `packages/runtime/src/devtools-hook.ts`, replace the `durationMs: number` signature with a `FrameTiming`:
```ts
import type { Instance } from './instance';

export interface FrameTiming {
  total: number;
  layout: number;
  a11y: number;
  paint: number;
}

export interface RuntimeDevHooks {
  onCommit(root: Instance, viewport: { w: number; h: number }, timing: FrameTiming): void;
}

let hooks: RuntimeDevHooks | null = null;

export function setRuntimeDevHooks(h: RuntimeDevHooks | null): void {
  hooks = h;
}

export function emitCommit(root: Instance, viewport: { w: number; h: number }, timing: FrameTiming): void {
  if (hooks) hooks.onCommit(root, viewport, timing);
}
```

- [ ] **Step 2: Export `FrameTiming` from runtime index**

In `packages/runtime/src/index.ts`, extend the devtools-hook export:
```ts
export type { RuntimeDevHooks, FrameTiming } from './devtools-hook';
```
(Keep the existing `setRuntimeDevHooks` value export.)

- [ ] **Step 3: Write the failing test**

Rewrite the timing assertion in `packages/runtime/test/devtools-commit.test.ts`. Add this test (and update any existing one that expected a numeric third arg — the third arg is now a `FrameTiming` object; the existing `onCommit: (root, viewport) => ...` callbacks still work since they ignore the third arg):
```ts
import { vi } from 'vitest';

  it('passes per-phase FrameTiming to onCommit', () => {
    // Fake performance.now to a fixed sequence: t0, tLayout, tA11y, tPaint
    const seq = [0, 5, 5, 12];
    let i = 0;
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);

    let timing: any = null;
    setRuntimeDevHooks({ onCommit: (_r, _v, t) => { timing = t; } });
    const { host } = createFakeHost(); // no a11y bridge
    const app: Instance = { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, layout: () => ({ w: 200, h: 100 }) } as any, children: [], paintSelf() {} };
    const dispose = mount(() => app, host);

    expect(timing).toBeTruthy();
    expect(timing.total).toBe(12);
    expect(timing.layout).toBe(5);
    expect(timing.a11y).toBe(0);   // no host.a11y → measured immediately after layout
    expect(timing.paint).toBe(7);
    dispose();
    spy.mockRestore();
  });
```
> Note: `renderFrame` calls `now()` exactly 4 times per frame (t0, tLayout, tA11y, tPaint). `createFakeHost` has no `a11y`, so the a11y block is skipped and `tA11y` is taken right after `tLayout` (same clamped value → a11y = 0). If the existing file's other test constructs the fake host differently, mirror it; `vi` must be imported.

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm test -- packages/runtime/test/devtools-commit.test.ts`
Expected: FAIL (timing is currently a number, not a FrameTiming object).

- [ ] **Step 5: Add phase timestamps in `mount.renderFrame`**

In `packages/runtime/src/mount.ts`, edit `renderFrame` to timestamp phases. The current body is: `t0` → layout block → a11y block → paint block → `emitCommit(root, ctx.viewport, now() - t0)`. Change to:
```ts
    const renderFrame = (): void => {
      const t0 = now();
      const w = host.metrics.width;
      const h = host.metrics.height;
      ctx.viewport = { w, h };
      root.layout.layout({ minW: w, maxW: w, minH: h, maxH: h }, ctx);
      const list = overlays.list();
      for (const o of list) o.layout.layout({ minW: 0, maxW: w, minH: 0, maxH: h }, ctx);
      flushAfterLayout();
      const tLayout = now();
      if (host.a11y) {
        const nodes = collectSemantics(root);
        for (const o of list) nodes.push(...collectSemantics(o));
        host.a11y.sync(nodes);
      }
      const tA11y = now();
      host.renderer.beginFrame();
      host.renderer.clear();
      paint(root, host.renderer);
      for (const o of list) paint(o, host.renderer);
      host.renderer.endFrame();
      const tPaint = now();
      emitCommit(root, ctx.viewport, {
        total: tPaint - t0,
        layout: tLayout - t0,
        a11y: tA11y - tLayout,
        paint: tPaint - tA11y,
      });
    };
```
(Keep the surrounding comments; only the timing marks + the `emitCommit` argument change.)

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm test -- packages/runtime/test/devtools-commit.test.ts`
Expected: PASS.
Run: `pnpm test -- packages/runtime`
Expected: existing runtime tests still pass (callbacks ignoring the 3rd arg are unaffected).
Run: `pnpm typecheck`
Expected: FAIL only in `@cairn/devtools/agent.ts` (it still treats the 3rd arg as `durationMs: number`) — that's fixed in Task 2. If you want a green typecheck at this commit, proceed to Task 2 before running the repo-wide typecheck; the runtime package itself typechecks clean.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/devtools-hook.ts packages/runtime/src/mount.ts packages/runtime/src/index.ts packages/runtime/test/devtools-commit.test.ts
git commit -m "feat(runtime): measure per-phase FrameTiming (layout/a11y/paint) for devtools"
```

---

## Task 2: `CommitMeta.phases` + agent threading

**Files:**
- Modify: `packages/devtools/src/protocol.ts`
- Modify: `packages/devtools/src/agent.ts`
- Test: `packages/devtools/test/agent.test.ts` (extend)

- [ ] **Step 1: Add `phases` to `CommitMeta`**

In `packages/devtools/src/protocol.ts`, extend `CommitMeta`:
```ts
export interface CommitMeta {
  frame: number;
  signalWrites: number;
  effectRuns: number;
  signals: SignalRef[];
  durationMs: number;
  phases: { layout: number; a11y: number; paint: number };
}
```

- [ ] **Step 2: Write the failing test**

Add to `packages/devtools/test/agent.test.ts`:
```ts
  it('commit meta carries per-phase timing', () => {
    installDevtools();
    const hook = (globalThis as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: AgentEvent[] = [];
    hook.subscribe((e: AgentEvent) => events.push(e));
    const { host } = createFakeHost();
    const dispose = mount(() => appRoot(), host);
    const commit = events.find((e) => e.type === 'commit');
    expect(commit && commit.type === 'commit').toBe(true);
    if (commit && commit.type === 'commit') {
      expect(typeof commit.meta.phases.layout).toBe('number');
      expect(typeof commit.meta.phases.a11y).toBe('number');
      expect(typeof commit.meta.phases.paint).toBe('number');
      expect(commit.meta.durationMs).toBeGreaterThanOrEqual(0);
    }
    dispose();
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- packages/devtools/test/agent.test.ts`
Expected: FAIL (agent's `onCommit` still uses `durationMs` number; `meta.phases` undefined; and TS errors until the signature is updated).

- [ ] **Step 4: Consume `timing` in the agent**

In `packages/devtools/src/agent.ts`, the `onCommit` handler signature is currently `(root, viewport, durationMs) => {...}`. Change it to accept `timing` and derive both fields:
```ts
    onCommit: (root, viewport, timing) => {
      s.viewport = viewport;
      s.lastRoot = root;
      if (s.subscribers.size === 0) { why.take(); return; }
      const snapshot = serialize(root);
      const changed = diffSnapshots(s.last, snapshot);
      const counts = why.take();
      s.frame++;
      const phases = { layout: timing.layout, a11y: timing.a11y, paint: timing.paint };
      s.log.push({ frame: s.frame, changedIds: changed.map((c) => c.id), ...counts, durationMs: timing.total });
      s.last = snapshot;
      if (s.pick) s.pick.update(snapshot);
      s.lastMeta = { frame: s.frame, ...counts, durationMs: timing.total, phases };
      emit({ type: 'commit', snapshot, changed, meta: s.lastMeta });
      emitSignals();
    },
```
> Preserve whatever else the current `onCommit` body does (lazy guard, pick update, emitSignals). Only the third param name and the `durationMs`/`phases` derivation change. `CommitEntry` in `commit-log.ts` does NOT need `phases` (the log only feeds the strip/counters); if `commit-log.ts`'s `CommitEntry` type is structurally checked and rejects the spread, leave it as-is — `s.log.push` already omits phases. If TypeScript complains that `CommitMeta` requires `phases` at other construction sites, fix them per the next step.

- [ ] **Step 5: Add `phases` to the get-snapshot fallback meta**

In `handleCommand`'s `get-snapshot` case, the fallback `meta` literal (used when `state.lastMeta` is null) must satisfy the new `CommitMeta`. Update it:
```ts
        emit({ type: 'commit', snapshot, changed: [], meta: state.lastMeta ?? { frame: state.frame, signalWrites: 0, effectRuns: 0, signals: [], durationMs: 0, phases: { layout: 0, a11y: 0, paint: 0 } } });
```

- [ ] **Step 6: Run + typecheck**

Run: `pnpm test -- packages/devtools`
Expected: all pass (new phases test green).
Run: `pnpm typecheck`
Expected: clean across all packages now (runtime from Task 1 + devtools).

- [ ] **Step 7: Commit**

```bash
git add packages/devtools/src/protocol.ts packages/devtools/src/agent.ts packages/devtools/test/agent.test.ts
git commit -m "feat(devtools): thread per-phase timing into CommitMeta.phases"
```

---

## Task 3: Panel — phase flame + Record/Reload

**Files:**
- Modify: `devtools-extension/src/panel/panel.ts`

XSS rule: `textContent`/DOM builders only.

- [ ] **Step 1: Add record state + capture on commit**

In `panel.ts`, add near the other state:
```ts
let recording = false;
const recorded: CommitMeta[] = [];
```
In `handleEvent`'s `commit` branch, after pushing to `commitLog`, capture while recording:
```ts
    if (recording) recorded.push(e.meta);
```
(Place this right after the existing `commitLog.push(e.meta)` line.)

- [ ] **Step 2: Wire the Record / Reload buttons**

Add near the bottom of panel.ts (after the maintab wiring), guarded for element presence:
```ts
const recBtn = document.getElementById('recBtn');
if (recBtn) recBtn.onclick = () => {
  recording = !recording;
  recBtn.classList.toggle('recording', recording);
  recBtn.textContent = recording ? '● Stop' : '● Record';
  if (recording) recorded.length = 0;   // start a fresh capture
  renderPerf();
};
const reloadBtn = document.getElementById('reloadBtn');
if (reloadBtn) reloadBtn.onclick = () => renderPerf();
```
> The mockup's `recBtn` contains a `<span class="cd">` dot + text; using `textContent` here replaces that inner markup with a plain label — acceptable and DOM-safe. If you want to keep the dot, build it with `createElement` instead; a plain text label is fine for D4d.

- [ ] **Step 3: Rewrite `renderPerf` to use the window + draw the phase flame**

Replace the existing `renderPerf`:
```ts
function renderPerf(): void {
  const budget = 16.7;
  const windowLog = recording || recorded.length ? recorded : commitLog;
  const frames = windowLog.map((m) => m.durationMs);
  const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
  const worst = windowLog.reduce<CommitMeta | null>((a, m) => (!a || m.durationMs > a.durationMs ? m : a), null);
  const worstMs = worst ? worst.durationMs : 0;
  const jank = frames.filter((d) => d > budget).length;
  const totalEff = windowLog.reduce((a, m) => a + m.effectRuns, 0);

  const stats = $('perfStats'); stats.replaceChildren();
  stats.append(
    statEl(avg.toFixed(1), 'ms', 'avg commit', avg > budget ? 'warn' : 'good'),
    statEl(worstMs.toFixed(1), 'ms', 'slowest frame', worstMs > budget ? 'bad' : 'good'),
    statEl(String(jank), '', 'frames over budget', jank ? 'warn' : 'good'),
    statEl(String(totalEff), '', 'effects run', ''),
  );

  const maxMs = Math.max(budget * 1.4, ...frames, 1);
  const fps = $('fps'); fps.replaceChildren();
  for (const d of frames.slice(-60)) {
    const bar = document.createElement('div');
    bar.className = 'frame' + (d > budget ? ' jank' : d > budget * 0.6 ? ' slow' : '');
    bar.style.height = `${Math.max(4, d / maxMs * 60)}px`; bar.title = `${d.toFixed(1)}ms`;
    fps.appendChild(bar);
  }
  $('perfRange').textContent = recording ? `recording… ${frames.length} frames`
    : recorded.length ? `recorded ${frames.length} frames`
    : `last ${frames.length} commits`;

  renderPhaseFlame(worst);
}

function renderPhaseFlame(worst: CommitMeta | null): void {
  const flame = $('flame'); flame.replaceChildren();
  const scale = $('flameScale'); scale.replaceChildren();
  if (!worst || worst.durationMs <= 0) {
    const note = document.createElement('div'); note.className = 'tip';
    note.textContent = worst ? 'Slowest frame took ~0ms — nothing to profile.' : 'No frames yet — interact with the app (or Record).';
    flame.appendChild(note);
    return;
  }
  const total = worst.durationMs;
  const segs: { label: string; kind: string; ms: number }[] = [
    { label: 'layout', kind: 'layout', ms: worst.phases.layout },
    { label: 'a11y', kind: 'signal', ms: worst.phases.a11y },
    { label: 'paint', kind: 'paint', ms: worst.phases.paint },
  ];
  const track = document.createElement('div'); track.className = 'track';
  const tname = document.createElement('div'); tname.className = 'tname'; tname.textContent = `frame #${worst.frame}`;
  const lane = document.createElement('div'); lane.className = 'lane';
  for (const s of segs) {
    if (s.ms <= 0) continue;
    const span = document.createElement('div'); span.className = `span ${s.kind}`;
    span.style.width = `${(s.ms / total) * 100}%`;
    span.title = `${s.label} · ${s.ms.toFixed(1)}ms`;
    span.textContent = s.ms / total > 0.12 ? s.label : '';
    lane.appendChild(span);
  }
  track.append(tname, lane);
  flame.appendChild(track);
  const mk = (t: string) => { const el = document.createElement('span'); el.textContent = t; return el; };
  scale.append(mk('0ms'), mk(`${(total / 2).toFixed(1)}ms`), mk(`${total.toFixed(1)}ms`));

  const tip = document.createElement('div'); tip.className = 'tip';
  tip.textContent = 'Per-effect flame + span→node arrives in a later cycle (needs effect→node attribution).';
  flame.appendChild(tip);
}
```
> The mockup's `.span` CSS positions spans with `position:absolute;left:…`. This implementation instead lays the segments out inline (each a flex/inline block with a `%` width) inside `.lane`. To make inline widths render, ensure the `.lane` uses normal flow — if the mockup CSS forces `position:absolute` on `.span`, add a small style override on the created spans: `span.style.position = 'relative'; span.style.display = 'inline-block'; span.style.height = '100%';` and remove `top/bottom` reliance. Verify visually in Task-4 browser check; adjust the inline styles until the three segments sit side-by-side filling the lane.

- [ ] **Step 4: Build**

Run: `cd devtools-extension && pnpm build`
Expected: builds clean; `grep -n "innerHTML" devtools-extension/src/panel/panel.ts` → no matches; `@cairn/devtools` import stays `import type` (CommitMeta already imported).

- [ ] **Step 5: Commit**

```bash
git add devtools-extension/src/panel/panel.ts
git commit -m "feat(extension): Performance phase flame + Record/Reload"
```

---

## Task 4: e2e + docs + browser verify

**Files:**
- Modify: `packages/devtools/test/integration/agent-browser.spec.ts`
- Modify: `devtools-extension/README.md`
- Modify: `docs/superpowers/specs/2026-07-05-dt4d-performance-design.md`

- [ ] **Step 1: Add the e2e test**

Append to `packages/devtools/test/integration/agent-browser.spec.ts`:
```ts
test('commit meta carries per-phase timing that sums to durationMs', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async () => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: any[] = []; hook.subscribe((e: any) => events.push(e));
    // trigger a fresh frame so a real (subscribed) commit with timing flows
    hook.send({ type: 'set-style', id: 1, prop: 'opacity', value: '1' }); // harmless nudge; id 1 = root
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const commit = [...events].reverse().find((e) => e.type === 'commit');
    if (!commit) return { ok: false };
    const p = commit.meta.phases;
    return { ok: true, phases: p, total: commit.meta.durationMs, sum: p.layout + p.a11y + p.paint };
  });
  expect(res.ok).toBe(true);
  expect(typeof res.phases.layout).toBe('number');
  expect(typeof res.phases.paint).toBe('number');
  // phases should account for (approximately) the whole frame — allow slack for measurement gaps
  expect(res.sum).toBeGreaterThan(0);
  expect(res.total).toBeGreaterThanOrEqual(res.sum - 0.001);
});
```
> If the harmless `set-style` nudge doesn't produce a subscribed commit reliably, replace it with a real interaction that causes a frame (e.g. `hook.send({type:'set-signal', id: <count id>, value:'1'})` after fetching the count id via get-signals), or just assert on the `get-snapshot` commit's meta.phases being numeric (the initial frame's phases may be 0 in a very fast headless run — in that case assert `>= 0` and drop the `sum > 0` check). The core assertion is that `meta.phases` exists with numeric layout/a11y/paint and `durationMs >= sum`.

- [ ] **Step 2: Run e2e**

Run: `pnpm test:e2e`
Expected: all prior e2e + this one pass. Adjust the nudge per the note if the phase sum is flaky at 0.

- [ ] **Step 3: Browser-verify the flame (manual, quick)**

Serve the demo (`pnpm exec vite --config examples/devtools-demo/vite.config.ts examples/devtools-demo --port 5199 --strictPort`), open it, and in the console confirm `__CAIRN_DEVTOOLS_HOOK__` commits carry `meta.phases`. (The panel flame itself is only visible in the loaded extension — document the manual check in the README.) Stop the server after.

- [ ] **Step 4: README checklist + spec status**

In `devtools-extension/README.md` add under the checklist:
```markdown
- [ ] Performance tab shows a phase flame (layout/a11y/paint) for the slowest frame with a ms scale.
- [ ] Record captures a window of frames; Stop freezes it; Reload re-renders.
- [ ] Stats show avg commit / slowest frame / frames over budget / effects run.
```
Change the spec status line to `**Статус:** реализовано (DT4d)`.

- [ ] **Step 5: Full sweep + commit**

Run: `pnpm test` (all green), `pnpm typecheck` (clean), `pnpm test:e2e` (green).
```bash
git add packages/devtools/test/integration/agent-browser.spec.ts devtools-extension/README.md docs/superpowers/specs/2026-07-05-dt4d-performance-design.md
git commit -m "test(devtools): e2e phase timing; docs DT4d checklist + spec status"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** phase measurement (T1), `FrameTiming` hook (T1), `CommitMeta.phases` + agent (T2), panel phase flame + Record/Reload (T3), e2e + docs (T4). Frame-strip/stats already existed (D4a) and keep working on the window.
- **Type consistency:** `FrameTiming { total, layout, a11y, paint }` (T1) is consumed by the agent (T2) which maps `total`→`durationMs` and the three phases→`CommitMeta.phases`. Panel reads `meta.phases` + `meta.durationMs` (T3). Every `CommitMeta` construction site (agent onCommit + get-snapshot fallback) sets `phases` (T2).
- **Cross-task typecheck note:** after T1 alone the repo-wide typecheck fails in agent.ts (still expects a number); T2 fixes it. Run repo-wide typecheck after T2. The runtime package typechecks clean at T1.
- **Prod cost:** 3 extra `now()` calls per frame; `emitCommit` no-op without hooks.
- **XSS:** panel uses `textContent`/DOM builders; `recBtn.textContent` label is safe.
- **Adaptation points:** the `.span` absolute-vs-inline layout (T3 note — verify visually and add inline style overrides if the mockup CSS forces absolute positioning); the e2e nudge that guarantees a subscribed commit with real phases (T4 note).
```
