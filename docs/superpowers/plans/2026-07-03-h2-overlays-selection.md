# H2 — Headless overlays & selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD: failing test first.

**Goal:** `Popover`, `Tooltip`, `Menu`+`MenuItem`, `Select`+`Option` in `@cairn/widgets`, headless (H0 pattern).

Design: `docs/superpowers/specs/2026-07-03-h2-overlays-selection-design.md`.

**MUST reuse / read first:**
- Existing `packages/widgets/src/popover.ts`, `tooltip.ts`, `modal.ts` — the current overlay wiring (useOverlays, Portal, computePlacement, getAbsRect, catcher, `createEffect(() => { if(open()) portalContent() })`). You are rebuilding Popover/Tooltip on the headless pattern; reuse this wiring.
- `packages/primitives` exports: `Portal`, `computePlacement`, `getAbsRect`, `Side`, `Box`, `Column`, `Row`, `Text`, `Icon`, `mergeStyles`, `Presence`. `useOverlays`, `hostContext` from `@cairn/runtime`.
- H0/H1: `useWidgetTheme` (colors.{surface,text,textMuted,border,borderStrong,primary,onPrimary,focusRing,...}, radii, spacing, fontSizes, control), `createControl`, `createCompoundContext`, `Button` (for Select trigger you may use a headless Button or a Box), `Input` frame styling (Select trigger mirrors it).
- CRITICAL LESSONS: `mainAxisSize` is a Row/Column **prop** not a style key (hugging lists/menus must set it); a `Stack` fills finite constraints (don't wrap triggers/menus in Stack — the overlay content menu should be a `Column({mainAxisSize:'min'})` inside a themed Box); tweens read only in paintSelf need scheduleFrame (n/a here mostly).
- Viewport: get `{w,h}` from `useContext(hostContext)?.metrics` (null-safe, see current popover `safeViewport`).
- Test harness: copy from existing widgets/overlay tests (themeContext accessor, fake host with `metrics`, `overlayContext`/useOverlays). For overlay tests, see how the current popover/tooltip/modal are tested (if not tested, test the open/close signal + that content mounts via the Portal effect; you can assert `open()` toggles and that the portal content builder returns an instance).

---

### Task 1: `Popover` (rebuild headless)
- Rewrite `packages/widgets/src/popover.ts`. Props: `{ trigger: Instance; children: Instance /* content */; side?: Side; align?: 'start'|'center'|'end'; offset?: number; open?: boolean|Accessor<boolean>; defaultOpen?: boolean; onOpenChange?: (o:boolean)=>void; style?: StyleInput }`. Controlled/uncontrolled open. Trigger inline, chain its onClick to toggle. Portal content = themed surface Box (bg surface, border borderStrong, radii.md, boxShadow/elevation, padding spacing.sm) wrapping `children`, positioned via computePlacement (flip). Full-surface transparent catcher closes on click/Escape. Test `packages/widgets/test/popover.test.ts`.
- Commit: `refactor(widgets): headless Popover (controlled/uncontrolled, themed surface)`.

### Task 2: `Tooltip` (rebuild headless)
- Rewrite `packages/widgets/src/tooltip.ts`. Props: `{ trigger: Instance; label?: string; children?: Instance; side?: Side; delay?: number; style? }`. Show on hover (enter → setTimeout-free: use the host scheduler or a simple `delay` via `animate`/timeout? — there is no setTimeout ban, but prefer platform-agnostic: use a small `animate` timer or just show immediately if delay unsupported; keep it simple — a `delay` via `host.scheduler` is ideal but immediate-show is acceptable if documented). Hide on leave. Dark themed bubble (bg text color inverted, small padding, radii.sm, fontSizes.sm), `pointerEvents:'none'`. Test `packages/widgets/test/tooltip.test.ts`.
- Commit: `refactor(widgets): headless Tooltip (hover bubble)`.

### Task 3: `Menu` + `MenuItem` (compound)
- New `packages/widgets/src/menu.ts`. `createCompoundContext('Menu')` value `{ close: ()=>void; active: Accessor<number>; setActive:(i:number)=>void; register:(item)=>number }` (roving). `Menu({ trigger, children, side?, align?, open?, defaultOpen?, onOpenChange? })`: opens a Popover-like surface containing a `Column({mainAxisSize:'min'})` of items; provides context. `MenuItem({ onSelect?, disabled?, label?, children?, style? })`: reads menu ctx, registers for roving, click/Enter → onSelect()+close, ArrowUp/Down move active, hover sets active, disabled skipped. Default item: Row padded, hover/active highlight (theme surfaceAlt/primary alpha), text color. Export both from index. Test `packages/widgets/test/menu.test.ts`.
- Commit: `feat(widgets): Menu + MenuItem (compound, roving, close-on-select)`.

### Task 4: `Select` + `Option` (compound)
- New `packages/widgets/src/select.ts`. `createCompoundContext('Select')` value `{ value: Accessor<any>; setValue:(v:any)=>void; close:()=>void; register:(opt:{value:any,label:string})=>void; selectedLabel: Accessor<string> }`. `Select({ value?, defaultValue?, onChange?, placeholder?, disabled?, children, style? })`: controlled/uncontrolled value; trigger = themed field-frame Box (mirror the Input frame: bg surface, border, radii.md, padding, focus ring) showing the selected option's label or the placeholder (muted) + a chevron Icon; clicking opens a listbox (Menu-like surface) of the `Option` children; provides context. `Option({ value, disabled?, label?, children? })`: on select → ctx.setValue(value)+close; selected option shows a check Icon / highlight. Keyboard: Enter/Space/ArrowDown open; roving; Enter selects; Escape closes. Export both from index. Test `packages/widgets/test/select.test.ts` (selecting sets value+onChange+closes; controlled; placeholder when empty; one selected; keyboard).
- Commit: `feat(widgets): Select + Option (compound listbox, keyboard)`.

### Task 5: README + demo + browser verify
- README catalog: Popover/Tooltip/Menu/Select/Option → ✅ (+ short snippets).
- New `examples/overlays-kit/` (copy example scaffold): a Popover (button → panel), a Tooltip (hover a button), a Menu (button → items, pick one updates a label), a Select (pick an option → trigger label updates). Default-styled + one `style` override.
- Browser (Playwright): open each overlay, pick items, confirm positioning + close-on-outside-click + no greedy-fill. Full `pnpm test` + `pnpm typecheck` green.
- Commit: `docs(widgets): H2 overlays/selection README + demo`.

---

## Self-review
- Coverage: Popover(T1), Tooltip(T2), Menu(T3), Select(T4), README+demo+browser(T5).
- Reuses Portal/computePlacement/useOverlays + H0/H1 primitives. Overlay content menus/lists use `Column({mainAxisSize:'min'})` inside a themed Box (avoid greedy Stack/Column fill).
- LESSONS applied: trigger inline (no Stack wrap); catcher for outside-close; mainAxisSize is a prop; null-safe viewport from host metrics.
- Risk: overlay tests without a real mount. Mitigation: test the open/close signal + that the portal content builder produces an instance; keep DOM-free.
