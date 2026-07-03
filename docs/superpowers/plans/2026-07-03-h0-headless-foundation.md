# H0 — Headless foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. TDD: write the failing test first, then code.

**Goal:** Foundation utilities in `@cairn/widgets` (defaultTheme + merge + compound context + control), headless `Button`/`Toggle`, and Material `Button`/`IconButton`/`Fab` rebuilt on top.

Design ref: `docs/superpowers/specs/2026-07-03-h0-headless-foundation-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: widgets, material, primitives.

Key existing APIs (verified):
- `StyleInput = Style | Style[] | ((theme: Theme) => Style | Style[])` in `@cairn/primitives` (`resolve-input.ts`).
- `resolveStyle(styleOrArray, activeStates?)` merges arrays (later wins) + state variants; state sub-objects are `Style.hover/pressed/focus/disabled` etc. `StyleSheet.create(obj)` is a typed identity registry (`@cairn/style`).
- `useTheme<T>()` reads a theme accessor from `themeContext` (default `() => ({})`); `Theme = ThemeTokens & Record<string, unknown>` with optional flat `colors/spacing/radii/fontSizes`.
- `createContext`/`useContext`/`Provider` (runtime) for compound. `createSignal`/`Accessor` (reactivity). `Box`/`Text`/`Row`/`Stack`/`Icon`/`applyLayoutChildProps`/`LayoutChildProps` (primitives). `createInteractive` in Box already tracks its own hover/pressed/focus for style-variant resolution and calls user pointer/focus handlers too.
- Material: `createMaterialTheme()` (`theme.ts`), `createRipple({color,radius,duration})` → `{instance, trigger(x,y)}` (`ripple.ts`), `stateOverlay(color,state)` (`state-layer.ts`), `alpha/darken/lighten/contrastText` (`colors.ts`).

---

### Task 1: `mergeStyles` util (in primitives)
- File: extend `packages/primitives/src/resolve-input.ts` with `mergeStyles(...inputs: (StyleInput|undefined)[]): StyleInput`; export from `packages/primitives/src/index.ts`. Test `packages/primitives/test/merge-styles.test.ts`.
- Behaviour: returns `(theme) => Style[]` that resolves each input (call fn inputs with `theme`), flattens `Style|Style[]` to `Style[]`, drops `undefined`, preserves order (later wins when passed to `resolveStyle`).
- TDD: `mergeStyles({a:1} as any, [{b:2}] as any)` → fn returns `[{a:1},{b:2}]`; a function input `(t)=>({c:3})` is invoked with the theme; `undefined` inputs skipped; empty → `[]`.
- Commit: `feat(primitives): mergeStyles — flatten/merge StyleInputs (incl. fn form)`.

### Task 2: `defaultTheme` + `useWidgetTheme` (widgets)
- File: `packages/widgets/src/theme.ts`; export from `packages/widgets/src/index.ts`. Test `packages/widgets/test/theme.test.ts`.
- `export interface WidgetTheme extends Theme`: flat `colors: Record<string,string>` with keys: `primary, primaryHover, primaryActive, onPrimary, secondary, secondaryHover, secondaryActive, onSecondary, danger, dangerHover, onDanger, success, warning, info, background, surface, surfaceAlt, overlay, text, textMuted, textDisabled, border, borderStrong, focusRing, trackOff, trackOn`. Flat `radii: Record<string,number>` (`none:0, sm:4, md:8, lg:12, xl:16, pill:9999`). Flat `spacing: Record<string,number>` (`xs:4, sm:8, md:12, lg:16, xl:24, '2xl':32`). Flat `fontSizes: Record<string,number>` (`xs:12, sm:14, md:16, lg:20, xl:24, '2xl':32`). Extra: `fontWeights: {regular:400,medium:500,semibold:600,bold:700}`, `control: { height:{sm:32,md:40,lg:48}, padX:{sm:12,md:16,lg:20} }`, `motion: { fast:120, normal:200 }`.
- `export const defaultTheme: WidgetTheme = { ...neutral light values... }`. Pick a clean neutral palette (primary a calm blue `#3b82f6`/hover `#2f74ee`/active `#2563eb`, onPrimary `#ffffff`; surface `#ffffff`, background `#f7f7f8`, text `#1f2937`, textMuted `#6b7280`, textDisabled `#9ca3af`, border `#e5e7eb`, borderStrong `#d1d5db`, focusRing `#3b82f6`, danger `#ef4444`, success `#22c55e`, warning `#f59e0b`, info `#0ea5e9`, overlay `rgba(0,0,0,0.5)`, trackOff `#cbd5e1`, trackOn primary).
- `export function useWidgetTheme(): WidgetTheme` — reads `useTheme()` and **deep-merges** the user theme over `defaultTheme` section-by-section (for each of `colors,radii,spacing,fontSizes,fontWeights,control,motion`: `{...default[section], ...(user[section]||{})}`; `control` nested one more level for `height`/`padX`). Non-section extra keys on the user theme copied over. Return a `WidgetTheme`.
- TDD: no provider → `useWidgetTheme()` deep-equals `defaultTheme` (build under an owner; there's no themeContext so it returns defaults). Provide (via `runWithContext(themeContext, () => ({colors:{primary:'#f00'}}))`) → result `.colors.primary==='#f00'` and `.colors.surface===defaultTheme.colors.surface` (others intact) and `.radii===defaultTheme.radii`. Check how existing style/primitives tests provide `themeContext` as an accessor `() => theme`.
- Commit: `feat(widgets): defaultTheme + useWidgetTheme (deep-merge over defaults)`.

### Task 3: `createCompoundContext` (widgets)
- File: `packages/widgets/src/context.ts`; export from index. Test `packages/widgets/test/context.test.ts`.
- `export function createCompoundContext<T>(name: string): { context: Context<T|null>; use: () => T }` — `context = createContext<T|null>(null)`; `use()` reads `useContext(context)`, throws `Error('[cairn] '+name+' must be used within its <Root>')` if `null`, else returns it.
- TDD: under `runWithContext(ctx.context, {v:1}, () => ctx.use())` returns `{v:1}`; calling `ctx.use()` with no provider throws with the name in the message.
- Commit: `feat(widgets): createCompoundContext helper`.

### Task 4: `createControl` (widgets)
- File: `packages/widgets/src/control.ts`; export from index. Test `packages/widgets/test/control.test.ts`.
- `export interface ControlState { hovered: Accessor<boolean>; pressed: Accessor<boolean>; focused: Accessor<boolean>; disabled: boolean }`.
- `export interface ControlProps extends EventProps { disabled?: boolean; onClick?: () => void }` (EventProps from primitives).
- `export function createControl(props: ControlProps): { state: ControlState; handlers: EventProps }`:
  - signals hovered/pressed/focused (createSignal). `disabled = !!props.disabled`.
  - handlers (as an `EventProps` object to spread into a `Box`): `onPointerEnter`→setHovered(true)+call user; `onPointerLeave`→setHovered(false),setPressed(false)+user; `onPointerDown`→ if !disabled setPressed(true) +user; `onPointerUp`→setPressed(false)+user; `onFocus`→setFocused(true)+user; `onBlur`→setFocused(false)+user; `onClick`→ if !disabled props.onClick?.() then user onClick; `onKeyDown`→ if !disabled && (key===' '||key==='Enter') props.onClick?.(); then user onKeyDown.
  - `state = { hovered, pressed, focused, disabled }`.
- TDD (call handlers directly with fake events): pointerdown sets pressed; disabled → pointerdown does NOT set pressed and onClick not called; Enter/Space call onClick; user-supplied onPointerEnter still invoked.
- Commit: `feat(widgets): createControl — interaction state + handlers (disabled-aware)`.

### Task 5: headless `Button` (widgets, refactor)
- File: rewrite `packages/widgets/src/button.ts`. Test rewrite `packages/widgets/test/button.test.ts`.
- Props: `interface ButtonProps extends LayoutChildProps { variant?: 'solid'|'soft'|'outline'|'ghost'|'link'; size?: 'sm'|'md'|'lg'; color?: string /* WidgetTheme.colors key base, default 'primary' */; disabled?: boolean; fullWidth?: boolean; onClick?: () => void; style?: StyleInput; label?: string; children?: Instance | ((s: ControlState) => Instance) }`.
- Impl: `const t = useWidgetTheme()`; `const { state, handlers } = createControl(props)`. Build default `StyleSheet.create` styles keyed by variant, parameterized by theme+size+color: base = `{ borderRadius: t.radii.md, alignX:'center', alignY:'center', padding: {x: t.control.padX[size], y: ...}, height: t.control.height[size], overflow:'hidden', cursor: disabled?'default':'pointer', transition:{properties:['backgroundColor','borderColor','opacity'],duration:t.motion.fast}, opacity: disabled?0.5:1 }`. Variant colors resolved from `t.colors[color]`/`[color+'Hover']`/`[color+'Active']`/`on+Capitalized` (fallback to primary set / text). solid: bg color, text onColor, hover bg colorHover, pressed bg colorActive. soft: translucent bg (alpha of color ~0.12), text color. outline: transparent bg, border {1, border/color}, text color, hover bg subtle. ghost: transparent, text color, hover subtle bg. link: transparent, text color, underline-ish (no bg). (alpha helper: inline small util or import from material? material depends on widgets? NO — widgets must not import material. Add a tiny local `withAlpha(hex,a)` in button or a shared widgets util.)
  - `const style = mergeStyles(variantStyle, props.fullWidth ? {width:'100%'} : undefined, props.style)`.
  - content: if `typeof props.children === 'function'` → `child = props.children(state)` and render a bare `Box({ style: mergeStyles(props.fullWidth?{width:'100%'}:undefined, props.style), focusable:true, ...handlers, children: child })` (no default visual — the fn owns look; still keyboard/focus/disabled). else child = `props.children ?? Text({ style: (th)=>({ color: <labelColor>, fontWeight: t.fontWeights.medium, fontSize: t.fontSizes[size==='sm'?'sm':'md'] }), children: props.label ?? '' })` and render `Box({ style, focusable:true, ...handlers, children })`.
  - `applyLayoutChildProps(instance, props)`; return.
- TDD: onClick on `handlers.onClick`; Enter/Space via onKeyDown; disabled blocks; `focusable===true`; default resolves a bg equal to theme primary for solid (resolve the style fn under defaultTheme and assert backgroundColor); a `style:{backgroundColor:'#123'}` override wins; render-fn form receives a `ControlState` (assert the child returned is the fn's output — e.g. pass `(s)=>Text({children:'x'})` and assert the tree contains it, and that no default bg is applied).
- Commit: `refactor(widgets): headless Button (variant/size/color, style override, render-fn slot)`.

### Task 6: headless `Toggle` (widgets, new)
- File: `packages/widgets/src/toggle.ts`; export from index. Test `packages/widgets/test/toggle.test.ts`.
- Props: `interface ToggleProps extends LayoutChildProps { pressed?: boolean|Accessor<boolean>; defaultPressed?: boolean; onChange?: (v:boolean)=>void; disabled?: boolean; style?: StyleInput; children?: Instance | ((s: ControlState & { pressed: Accessor<boolean> }) => Instance); label?: string }`.
- Impl: controlled/uncontrolled `pressed` (mirror Checkbox pattern: `controlled = props.pressed!==undefined`, internal signal from defaultPressed, `read()` accessor). `toggle()`: if disabled return; next=!read(); if !controlled setInternal(next); onChange(next). `createControl({ disabled, onClick: toggle, ...eventprops })`. Default style: like ghost button but with a `pressed`-driven active look — since Box can't read our `read()` for a variant automatically, drive it: `style: mergeStyles((th)=>({ ...ghostBase, backgroundColor: read()? withAlpha(primary,0.16):'transparent' }), props.style)` (the style fn re-reads `read()` reactively via Box's bind). children: fn form gets `{...state, pressed: read}`; else label/instance.
- TDD: uncontrolled: click toggles + onChange(true) then (false); controlled `pressed:()=>true` + onChange fired but internal not used; disabled blocks.
- Commit: `feat(widgets): headless Toggle (controlled/uncontrolled two-state button)`.

### Task 7: Material `Button`/`IconButton`/`Fab` on headless
- Files: `packages/material/src/button.ts`, `icon-button.ts`, `fab.ts`; export from `packages/material/src/index.ts`. Tests under `packages/material/test/`.
- **Material Button** wraps the **headless `Button`** (`@cairn/widgets`) using the **render-fn slot** so it keeps our behaviour but supplies the full Material look: reads `useTheme() as unknown as MaterialTheme` for palette/elevation/typography; `variant: 'contained'|'outlined'|'text'`, `color: MaterialColor`. Pass `style` (Material variant style: contained bg `c.main`+`boxShadow: elevation[2]`, hover elevation[4]+darken, pressed elevation[8]; outlined border `alpha(c.main,0.5)`; text transparent+stateOverlay) and a `children:(state)=>Instance` that renders `Stack([ Row([startIcon?, label uppercased with typography.button]), ripple.instance ])`, wiring `onPointerDown` via the headless Button's handler path. IMPORTANT: ripple.trigger needs local coords — the Material Button can attach its own `onPointerDown` by passing it through (headless Button forwards pointer handlers via createControl). If passing pointer handlers through the headless Button is awkward, the Material Button may instead compose directly: call the headless `Button` with `style` + a normal (non-fn) child `Stack([content, ripple.instance])` and add `onPointerDown` — check the headless Button forwards `onPointerDown` (it does via createControl handlers spread). Prefer the simplest wiring that (a) reuses headless keyboard/disabled/click and (b) triggers ripple on pointer down.
- **IconButton**: headless `Button` with `variant:'ghost'`, circular style (size 40, borderRadius 20), ripple, `stateOverlay(text,'hover'/'pressed')`, icon child.
- **Fab**: headless `Button`, circular size 56, bg `c.main`, `boxShadow: elevation[6]` (hover[8] pressed[12]), ripple, `c.contrastText` icon.
- Keep `MaterialColor`, `ButtonProps`, etc. exported. Do NOT duplicate keyboard/disabled logic — it comes from the headless Button.
- TDD: onClick + disabled (blocks) + focusable via the headless base; ripple child present (Stack has the ripple instance); Fab resolved style has a boxShadow; contained resolves bg = palette main.
- Commit: `feat(material): Button/IconButton/Fab rebuilt on headless widgets Button`.

### Task 8: README + demo + browser verify
- `packages/widgets/README.md`: title `@cairn/widgets — Headless component library`; sections: **What is this** (headless standard lib, platform-agnostic, no DOM), **The 3-layer customization model** (tokens / style override / slot), **Theming** (`defaultTheme`, `ThemeProvider`, `useWidgetTheme`), **Compound convention**, and a **Component catalog** table grouped (Forms, Actions, Overlays, Navigation, Data, Utility) with columns Name | Kind (flat/compound) | Status. Mark `Button`, `Toggle` ✅ Stable with short usage snippets; everything else `⏳ planned`. Keep it accurate to what exists.
- Extend `examples/material/main.tsx` (or the material example) to show: default-styled widgets `Button`s (variants solid/soft/outline/ghost/link), a `style`-overridden button, a render-fn button with a totally custom look, plus Material `Button`/`IconButton`/`Fab`. Wrap in `ThemeProvider({ theme: createMaterialTheme() })` for the Material ones (widgets ones use defaults or the provided theme).
- Browser (Playwright): build with vite, load, screenshot; click a button → ripple; confirm the style-override and render-fn buttons look different. Full `pnpm test` + `pnpm typecheck` green.
- Commit: `docs(widgets): README + headless foundation demo (H0)`.

---

## Self-review
- Coverage: mergeStyles(T1), theme(T2), context(T3), control(T4), Button(T5), Toggle(T6), Material buttons(T7), README+demo+browser(T8).
- Platform-agnostic: widgets imports only reactivity/style/primitives/runtime/events — never platform-web. No `window`/`document`.
- LESSON applied: ripple already handles host-context + scheduleFrame (MT2). Material reuses headless behaviour via slot — no duplicated keyboard/disabled.
- Risk: wiring ripple's pointer coords through the headless Button. Mitigation noted in T7 — headless Button forwards pointer handlers via createControl, so Material can pass `onPointerDown`.
