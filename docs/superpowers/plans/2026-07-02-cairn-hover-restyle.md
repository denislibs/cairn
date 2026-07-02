# Cairn Phase 7b — Hover + Pressed + Reactive Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire live pointer state (hover, pressed) to Phase 6 style state variants so primitives restyle reactively while hovered/pressed and revert on leave/release.

**Architecture:** The events dispatcher tracks a hover-path and fires non-bubbling synthetic `pointerenter`/`pointerleave` per node. Each primitive owns `hovered`/`pressed` signals (hover fed by enter/leave; pressed derived locally from bubbled down/up + leave), resolves its style through a reactive accessor over those signals, and applies it via `bind()` to both layout-node fields and paint props — repainting through the existing full-frame scheduler.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vitest. Reactivity: `createSignal`/`bind` (function-valued bind = repaint-on-change effect). Effects flush synchronously on signal set.

**Spec:** `docs/superpowers/specs/2026-07-02-cairn-hover-restyle-design.md`

---

## File Structure

**`@cairn/events`:**
- Modify `packages/events/src/event.ts` — add enter/leave to the event type + `EventHandlers`
- Modify `packages/events/src/dispatch.ts` — map enter/leave keys; add non-bubbling `dispatchTo`
- Modify `packages/events/src/pointer-dispatcher.ts` — `hoverPath` + `syncHover` (enter/leave diff)
- Modify `packages/events/src/index.ts` — export `dispatchTo`

**`@cairn/layout`:**
- Modify `packages/layout/src/box.ts` — export the padding normalizer as `toEdgeInsets`
- Modify `packages/layout/src/index.ts` — re-export `toEdgeInsets`

**`@cairn/primitives`:**
- Modify `packages/primitives/src/events.ts` — `EventProps` gains `onPointerEnter`/`onPointerLeave`
- Create `packages/primitives/src/interactive.ts` — `createInteractive(props)`
- Modify `packages/primitives/src/box.ts`, `text.ts`, `flex.ts` — reactive restyle via `createInteractive` + `bind`
- Modify `packages/primitives/src/index.ts` — export `createInteractive`

**`@cairn/platform-web`:**
- Modify `packages/platform-web/src/web-input-source.ts` — canvas `pointerleave` → out-of-bounds `pointermove`

**example:**
- Modify `examples/counter/main.tsx` — add hover/pressed variants to the button style

---

## Task 1: Events — enter/leave event model + non-bubbling `dispatchTo`

**Files:**
- Modify: `packages/events/src/event.ts`
- Modify: `packages/events/src/dispatch.ts`
- Modify: `packages/events/src/index.ts`
- Test: `packages/events/test/dispatch-to.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/events/test/dispatch-to.test.ts`:

```ts
import { test, expect } from 'vitest';
import { dispatchTo } from '../src/index';
import type { HitNode, CairnPointerEvent } from '../src/index';

function node(handlers?: HitNode['handlers']): HitNode {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } }, children: [], handlers };
}

test('dispatchTo invokes only the given node handler with target set', () => {
  let seen: CairnPointerEvent | undefined;
  const n = node({ onPointerEnter: (e) => (seen = e) });
  dispatchTo(n, { type: 'pointerenter', x: 1, y: 2, button: 0, pointerType: 'mouse' });
  expect(seen?.type).toBe('pointerenter');
  expect(seen?.target).toBe(n);
  expect(seen?.x).toBe(1);
});

test('dispatchTo maps pointerleave to onPointerLeave', () => {
  const log: string[] = [];
  const n = node({ onPointerLeave: () => log.push('leave') });
  dispatchTo(n, { type: 'pointerleave', x: 0, y: 0, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['leave']);
});

test('dispatchTo is a no-op when the node lacks the handler', () => {
  const n = node({ onPointerEnter: () => {} });
  expect(() =>
    dispatchTo(n, { type: 'pointerleave', x: 0, y: 0, button: 0, pointerType: 'mouse' }),
  ).not.toThrow();
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/events/test/dispatch-to.test.ts`
Expected: FAIL — `dispatchTo` not exported (and `pointerenter` not a valid type).

- [ ] **Step 3: Extend the event model**

In `packages/events/src/event.ts`, change the `CairnPointerEvent` `type` union and add two handlers to `EventHandlers`:

```ts
export interface CairnPointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'click' | 'pointerenter' | 'pointerleave';
  x: number;
  y: number;
  button: number;
  pointerType: 'mouse' | 'touch' | 'pen';
  target: HitNode;
  stopPropagation(): void;
}
```

```ts
export interface EventHandlers {
  onPointerDown?(e: CairnPointerEvent): void;
  onPointerMove?(e: CairnPointerEvent): void;
  onPointerUp?(e: CairnPointerEvent): void;
  onPointerEnter?(e: CairnPointerEvent): void;
  onPointerLeave?(e: CairnPointerEvent): void;
  onClick?(e: CairnPointerEvent): void;
  onWheel?(e: CairnWheelEvent): void;
}
```

- [ ] **Step 4: Map the new keys + add `dispatchTo`**

In `packages/events/src/dispatch.ts`, extend `POINTER_HANDLERS`:

```ts
const POINTER_HANDLERS: Record<CairnPointerEvent['type'], keyof EventHandlers> = {
  pointerdown: 'onPointerDown',
  pointermove: 'onPointerMove',
  pointerup: 'onPointerUp',
  pointerenter: 'onPointerEnter',
  pointerleave: 'onPointerLeave',
  click: 'onClick',
};
```

Add at the end of the file:

```ts
/** Non-bubbling dispatch to a single node (used for enter/leave). */
export function dispatchTo(
  node: HitNode,
  init: Omit<CairnPointerEvent, 'target' | 'stopPropagation'>,
): void {
  const event: CairnPointerEvent = {
    ...init,
    target: node,
    stopPropagation() {
      // single-node dispatch: nothing to stop
    },
  };
  const key = POINTER_HANDLERS[init.type];
  const fn = node.handlers?.[key] as ((e: CairnPointerEvent) => void) | undefined;
  fn?.(event);
}
```

- [ ] **Step 5: Export `dispatchTo`**

In `packages/events/src/index.ts`, change the dispatch export line to:

```ts
export { dispatch, dispatchWheel, dispatchTo } from './dispatch';
```

- [ ] **Step 6: Run to verify PASS + typecheck**

Run: `pnpm vitest run packages/events/test/dispatch-to.test.ts`
Expected: PASS (3 tests).
Run: `pnpm typecheck`
Expected: PASS (the `POINTER_HANDLERS` record is exhaustive over the widened union).

- [ ] **Step 7: Commit**

```bash
git add packages/events/src/event.ts packages/events/src/dispatch.ts packages/events/src/index.ts packages/events/test/dispatch-to.test.ts
git commit -m "feat(events): enter/leave event model + non-bubbling dispatchTo"
```

---

## Task 2: Events — hover-path tracking (`syncHover`) in the dispatcher

**Files:**
- Modify: `packages/events/src/pointer-dispatcher.ts`
- Test: `packages/events/test/hover.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/events/test/hover.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createPointerDispatcher } from '../src/index';
import type { HitNode, PointerInput } from '../src/index';

// root(100x100) > [ A(0,0 50x100) > a1(0,0 50x50), B(50,0 50x100) > b1(0,0 50x50) ]
function tree() {
  const log: string[] = [];
  const leaf = (tag: string, w: number, h: number, ox = 0, oy = 0): HitNode => ({
    layout: { offsetX: ox, offsetY: oy, size: { w, h } },
    children: [],
    handlers: {
      onPointerEnter: () => log.push(`enter:${tag}`),
      onPointerLeave: () => log.push(`leave:${tag}`),
    },
  });
  const a1 = leaf('a1', 50, 50);
  const b1 = leaf('b1', 50, 50);
  const A: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 100 } }, children: [a1], handlers: { onPointerEnter: () => log.push('enter:A'), onPointerLeave: () => log.push('leave:A') } };
  const B: HitNode = { layout: { offsetX: 50, offsetY: 0, size: { w: 50, h: 100 } }, children: [b1], handlers: { onPointerEnter: () => log.push('enter:B'), onPointerLeave: () => log.push('leave:B') } };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [A, B], handlers: { onPointerEnter: () => log.push('enter:root'), onPointerLeave: () => log.push('leave:root') } };
  return { root, log };
}

const move = (x: number, y: number): PointerInput => ({
  type: 'pointermove', x, y, button: 0, pointerType: 'mouse',
});

test('entering a nested node fires enter for the whole path', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(move(10, 10)); // over a1
  expect(log).toEqual(['enter:a1', 'enter:A', 'enter:root']);
});

test('moving to a sibling leaves the old branch and enters the new; shared ancestor stays', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(move(10, 10)); // a1
  log.length = 0;
  d.handlePointer(move(60, 10)); // b1
  expect(log).toEqual(['leave:a1', 'leave:A', 'enter:b1', 'enter:B']); // root neither leaves nor re-enters
});

test('moving off the tree leaves every hovered node', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(move(10, 10)); // a1
  log.length = 0;
  d.handlePointer(move(-1, -1)); // off-surface
  expect(log).toEqual(['leave:a1', 'leave:A', 'leave:root']);
});

test('staying over the same node fires nothing on repeat move', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(move(10, 10));
  log.length = 0;
  d.handlePointer(move(12, 12)); // still a1
  expect(log).toEqual([]);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/events/test/hover.test.ts`
Expected: FAIL — no enter/leave fired (dispatcher has no hover tracking yet).

- [ ] **Step 3: Add `hoverPath` + `syncHover` and restructure `handlePointer`**

In `packages/events/src/pointer-dispatcher.ts`:

Change the imports line to include `dispatchTo`:

```ts
import { dispatch, dispatchWheel, dispatchTo } from './dispatch';
```

Inside `createPointerDispatcher`, add hover state next to `downPath`:

```ts
  let downPath: HitNode[] | null = null;
  let hoverPath: HitNode[] = [];

  // Diff the previous hover path against the new one and fire non-bubbling
  // enter/leave. A node stays hovered while the pointer is over a descendant
  // (CSS :hover semantics). Empty newPath fires leave for every hovered node.
  const syncHover = (newPath: HitNode[], input: PointerInput): void => {
    const newSet = new Set(newPath);
    const oldSet = new Set(hoverPath);
    const coords = { x: input.x, y: input.y, button: input.button, pointerType: input.pointerType };
    for (const n of hoverPath) {
      if (!newSet.has(n)) dispatchTo(n, { type: 'pointerleave', ...coords });
    }
    for (const n of newPath) {
      if (!oldSet.has(n)) dispatchTo(n, { type: 'pointerenter', ...coords });
    }
    hoverPath = newPath;
  };
```

Replace the `handlePointer` body's opening (up to the empty-path guard) so `syncHover` runs first:

```ts
    handlePointer(input: PointerInput): void {
      const path = hitTest(getRoot(), input.x, input.y);
      syncHover(path, input);
      if (path.length === 0) {
        // Missing the surface on release drops any pending down.
        if (input.type === 'pointerup') downPath = null;
        return;
      }

      dispatch(path, {
```

(The rest of `handlePointer` — the `dispatch`, pointerdown/pointerup click synthesis — is unchanged.)

- [ ] **Step 4: Run to verify PASS + typecheck**

Run: `pnpm vitest run packages/events/test/hover.test.ts`
Expected: PASS (4 tests).
Run: `pnpm vitest run packages/events`
Expected: PASS (existing dispatcher/click tests still green).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/events/src/pointer-dispatcher.ts packages/events/test/hover.test.ts
git commit -m "feat(events): hover-path tracking with synthetic enter/leave"
```

---

## Task 3: Layout — export `toEdgeInsets`

**Files:**
- Modify: `packages/layout/src/box.ts`
- Modify: `packages/layout/src/index.ts`
- Test: `packages/layout/test/edge-insets.test.ts`

Box needs to write `BoxNode.padding` (an `EdgeInsets`) from a style `padding` (`number | Partial<EdgeInsets>`). Export the existing normalizer so primitives reuse it (DRY).

- [ ] **Step 1: Write the failing test** — `packages/layout/test/edge-insets.test.ts`:

```ts
import { test, expect } from 'vitest';
import { toEdgeInsets } from '../src/index';

test('number expands to all four sides', () => {
  expect(toEdgeInsets(4)).toEqual({ top: 4, right: 4, bottom: 4, left: 4 });
});

test('partial fills missing sides with 0', () => {
  expect(toEdgeInsets({ left: 8 })).toEqual({ top: 0, right: 0, bottom: 0, left: 8 });
});

test('undefined yields all zeros', () => {
  expect(toEdgeInsets(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/layout/test/edge-insets.test.ts`
Expected: FAIL — `toEdgeInsets` not exported.

- [ ] **Step 3: Rename + export the normalizer**

In `packages/layout/src/box.ts`, change the private `toInsets` into an exported `toEdgeInsets` and update its one call site in the constructor:

```ts
export function toEdgeInsets(p?: number | Partial<EdgeInsets>): EdgeInsets {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === 'number') return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };
}
```

In the `BoxNode` constructor, change `this.padding = toInsets(props.padding);` to:

```ts
    this.padding = toEdgeInsets(props.padding);
```

- [ ] **Step 4: Re-export from the layout barrel**

In `packages/layout/src/index.ts`, change the BoxNode export line group to also export the function:

```ts
export { BoxNode, toEdgeInsets } from './box';
```

- [ ] **Step 5: Run to verify PASS + typecheck**

Run: `pnpm vitest run packages/layout/test/edge-insets.test.ts`
Expected: PASS (3 tests).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/layout/src/box.ts packages/layout/src/index.ts packages/layout/test/edge-insets.test.ts
git commit -m "feat(layout): export toEdgeInsets padding normalizer"
```

---

## Task 4: Primitives — `EventProps` enter/leave + `createInteractive`

**Files:**
- Modify: `packages/primitives/src/events.ts`
- Create: `packages/primitives/src/interactive.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/interactive.test.ts`

- [ ] **Step 1: Add enter/leave to `EventProps`**

In `packages/primitives/src/events.ts`, add two props to the `EventProps` interface (after `onPointerUp`):

```ts
  onPointerEnter?: (e: CairnPointerEvent) => void;
  onPointerLeave?: (e: CairnPointerEvent) => void;
```

- [ ] **Step 2: Write the failing test** — `packages/primitives/test/interactive.test.ts`:

```ts
import { test, expect } from 'vitest';
import type { CairnPointerEvent } from '@cairn/events';
import { createInteractive } from '../src/index';

const ev = {} as CairnPointerEvent;

test('resolved reflects the base style with no active state', () => {
  const { resolved } = createInteractive({ style: { backgroundColor: '#fff', hover: { backgroundColor: '#eee' } } });
  expect(resolved().backgroundColor).toBe('#fff');
});

test('onPointerEnter activates the hover variant; leave reverts', () => {
  const { resolved, handlers } = createInteractive({ style: { backgroundColor: '#fff', hover: { backgroundColor: '#eee' } } });
  handlers.onPointerEnter!(ev);
  expect(resolved().backgroundColor).toBe('#eee');
  handlers.onPointerLeave!(ev);
  expect(resolved().backgroundColor).toBe('#fff');
});

test('pointerdown activates the pressed variant; pointerup reverts', () => {
  const { resolved, handlers } = createInteractive({ style: { backgroundColor: '#fff', pressed: { backgroundColor: '#333' } } });
  handlers.onPointerDown!(ev);
  expect(resolved().backgroundColor).toBe('#333');
  handlers.onPointerUp!(ev);
  expect(resolved().backgroundColor).toBe('#fff');
});

test('leave clears a pending pressed (drag-off cancels press)', () => {
  const { resolved, handlers } = createInteractive({ style: { backgroundColor: '#fff', pressed: { backgroundColor: '#333' } } });
  handlers.onPointerDown!(ev);
  handlers.onPointerLeave!(ev);
  expect(resolved().backgroundColor).toBe('#fff');
});

test('user handlers still fire alongside the internal toggles', () => {
  const log: string[] = [];
  const { handlers } = createInteractive({
    style: {},
    onPointerEnter: () => log.push('user-enter'),
    onPointerDown: () => log.push('user-down'),
    onClick: () => log.push('user-click'),
  });
  handlers.onPointerEnter!(ev);
  handlers.onPointerDown!(ev);
  handlers.onClick!(ev);
  expect(log).toEqual(['user-enter', 'user-down', 'user-click']);
});
```

- [ ] **Step 3: Run to verify FAIL**

Run: `pnpm vitest run packages/primitives/test/interactive.test.ts`
Expected: FAIL — `createInteractive` not exported.

- [ ] **Step 4: Create `createInteractive`** — `packages/primitives/src/interactive.ts`:

```ts
import { createSignal } from '@cairn/reactivity';
import { useTheme, type BaseStyle, type StateName } from '@cairn/style';
import type { EventHandlers } from '@cairn/events';
import { resolveStyleInput, type StyleInput } from './resolve-input';
import type { EventProps } from './events';

export interface InteractiveProps extends EventProps {
  style?: StyleInput;
}

export interface Interactive {
  resolved: () => BaseStyle; // reactive: re-reads hovered()/pressed()
  handlers: EventHandlers;
}

// Owns the hovered/pressed signals for a primitive, exposes a reactive resolved
// style, and returns handlers that toggle those signals while still calling the
// user's own handlers. pressed is derived locally from bubbled down/up + leave.
export function createInteractive(props: InteractiveProps): Interactive {
  const theme = useTheme();
  const [hovered, setHovered] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);

  const resolved = (): BaseStyle => {
    const states: StateName[] = [];
    if (hovered()) states.push('hover');
    if (pressed()) states.push('pressed');
    return resolveStyleInput(props.style, theme, states);
  };

  const handlers: EventHandlers = {
    onPointerEnter(e) {
      setHovered(true);
      props.onPointerEnter?.(e);
    },
    onPointerLeave(e) {
      setHovered(false);
      setPressed(false);
      props.onPointerLeave?.(e);
    },
    onPointerDown(e) {
      setPressed(true);
      props.onPointerDown?.(e);
    },
    onPointerUp(e) {
      setPressed(false);
      props.onPointerUp?.(e);
    },
  };
  if (props.onClick) handlers.onClick = props.onClick;
  if (props.onPointerMove) handlers.onPointerMove = props.onPointerMove;
  if (props.onWheel) handlers.onWheel = props.onWheel;

  return { resolved, handlers };
}
```

- [ ] **Step 5: Export from the barrel**

In `packages/primitives/src/index.ts`, add:

```ts
export { createInteractive } from './interactive';
export type { InteractiveProps, Interactive } from './interactive';
```

- [ ] **Step 6: Run to verify PASS + typecheck**

Run: `pnpm vitest run packages/primitives/test/interactive.test.ts`
Expected: PASS (5 tests).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/primitives/src/events.ts packages/primitives/src/interactive.ts packages/primitives/src/index.ts packages/primitives/test/interactive.test.ts
git commit -m "feat(primitives): createInteractive — hovered/pressed signals + reactive style"
```

---

## Task 5: Primitives — reactive restyle in `Box`

**Files:**
- Modify: `packages/primitives/src/box.ts`
- Test: `packages/primitives/test/box-hover.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/primitives/test/box-hover.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import type { CairnPointerEvent } from '@cairn/events';
import { BoxNode } from '@cairn/layout';
import { Box } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

const ev = {} as CairnPointerEvent;
const bgOf = (r: { calls: unknown[][] }) => {
  const call = r.calls.find((c) => c[0] === 'fillRoundRect');
  return call ? (call[3] as { color: string }).color : undefined;
};

test('hover swaps the resolved paint style and reverts on leave', () => {
  setFrameRequester(() => {});
  let box!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    box = Box({ style: { backgroundColor: '#fff', hover: { backgroundColor: '#eee' } } });
    return d;
  });

  box.layout.layout(LOOSE, fakeCtx);
  let r = createFakeRenderer();
  box.paintSelf(r);
  expect(bgOf(r)).toBe('#fff');

  box.handlers!.onPointerEnter!(ev);
  r = createFakeRenderer();
  box.paintSelf(r);
  expect(bgOf(r)).toBe('#eee');

  box.handlers!.onPointerLeave!(ev);
  r = createFakeRenderer();
  box.paintSelf(r);
  expect(bgOf(r)).toBe('#fff');

  dispose();
  setFrameRequester(null);
});

test('hover can change layout (padding) and trigger a size change', () => {
  setFrameRequester(() => {});
  let box!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    box = Box({
      style: { width: 20, height: 20, hover: { width: 40 } },
    });
    return d;
  });

  box.layout.layout(LOOSE, fakeCtx);
  expect((box.layout as BoxNode).size.w).toBe(20);

  box.handlers!.onPointerEnter!(ev);
  box.layout.layout(LOOSE, fakeCtx);
  expect((box.layout as BoxNode).size.w).toBe(40);

  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/primitives/test/box-hover.test.ts`
Expected: FAIL — Box does not restyle on hover (static style captured at construction).

- [ ] **Step 3: Rewrite `Box` for reactive restyle** — replace `packages/primitives/src/box.ts` with:

```ts
import type { Renderer } from '@cairn/host';
import { BoxNode, toEdgeInsets } from '@cairn/layout';
import { type Instance, bind } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';

export interface BoxProps extends EventProps {
  style?: StyleInput;
  children?: Instance;
}

export function Box(props: BoxProps = {}): Instance {
  const child = props.children;
  const { resolved, handlers } = createInteractive(props);
  const layout = new BoxNode({ child: child?.layout });
  let current: BaseStyle = {};

  // Reactive: re-applies (and schedules a frame) when hovered/pressed change.
  bind(resolved, (s) => {
    current = s;
    layout.width = s.width;
    layout.height = s.height;
    layout.padding = toEdgeInsets(s.padding);
  });

  return {
    layout,
    children: child ? [child] : [],
    handlers,
    paintSelf(r: Renderer) {
      if (current.backgroundColor) {
        r.fillRoundRect(
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          current.borderRadius ?? 0,
          { color: current.backgroundColor },
        );
      }
    },
  };
}
```

- [ ] **Step 4: Run to verify PASS + full primitives suite + typecheck**

Run: `pnpm vitest run packages/primitives/test/box-hover.test.ts`
Expected: PASS (2 tests).
Run: `pnpm vitest run packages/primitives`
Expected: PASS — existing box tests still pass (the `bind` effect runs once synchronously at construction, so static styles resolve exactly as before).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/primitives/src/box.ts packages/primitives/test/box-hover.test.ts
git commit -m "feat(primitives): reactive hover/pressed restyle in Box"
```

---

## Task 6: Primitives — reactive restyle in `Text` and `Row`/`Column`

**Files:**
- Modify: `packages/primitives/src/text.ts`
- Modify: `packages/primitives/src/flex.ts`
- Test: `packages/primitives/test/flex-hover.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/primitives/test/flex-hover.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import type { CairnPointerEvent } from '@cairn/events';
import { FlexNode } from '@cairn/layout';
import { Row, Text } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

const ev = {} as CairnPointerEvent;

test('Row hover changes gap on the FlexNode', () => {
  setFrameRequester(() => {});
  let row!: ReturnType<typeof Row>;
  const dispose = createRoot((d) => {
    row = Row({ style: { gap: 4, hover: { gap: 16 } } });
    return d;
  });
  expect((row.layout as FlexNode).gap).toBe(4);
  row.handlers!.onPointerEnter!(ev);
  expect((row.layout as FlexNode).gap).toBe(16);
  dispose();
  setFrameRequester(null);
});

test('Text hover changes the painted color', () => {
  setFrameRequester(() => {});
  let t!: ReturnType<typeof Text>;
  const dispose = createRoot((d) => {
    t = Text({ children: 'hi', style: { color: '#111', hover: { color: '#f00' } } });
    return d;
  });
  t.layout.layout(LOOSE, fakeCtx);

  let r = createFakeRenderer();
  t.paintSelf(r);
  let call = r.calls.find((c) => c[0] === 'drawText')!;
  expect((call[3] as { color: string }).color).toBe('#111');

  t.handlers!.onPointerEnter!(ev);
  r = createFakeRenderer();
  t.paintSelf(r);
  call = r.calls.find((c) => c[0] === 'drawText')!;
  expect((call[3] as { color: string }).color).toBe('#f00');

  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/primitives/test/flex-hover.test.ts`
Expected: FAIL — Row/Text do not restyle on hover.

- [ ] **Step 3: Rewrite `Text`** — replace `packages/primitives/src/text.ts` with:

```ts
import type { Renderer } from '@cairn/host';
import { TextNode } from '@cairn/layout';
import { type Instance, bind, type MaybeReactive } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';

export interface TextProps extends EventProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: StyleInput;
}

export function Text(props: TextProps = {}): Instance {
  const { resolved, handlers } = createInteractive(props);
  const layout = new TextNode({ text: '', style: { font: '16px sans-serif' } });
  let current: BaseStyle = {};

  // Reactive style: font drives both layout (measure) and paint; color is paint-only.
  bind(resolved, (s) => {
    current = s;
    layout.style = { ...layout.style, font: s.font ?? '16px sans-serif' };
  });

  const content = props.value ?? props.children ?? '';
  bind(content, (v) => {
    layout.text = String(v);
  });

  return {
    layout,
    children: [],
    handlers,
    paintSelf(r: Renderer) {
      r.drawText(
        layout.text,
        { x: 0, y: 0 },
        { font: current.font ?? '16px sans-serif', color: current.color ?? '#000', baseline: 'top' },
      );
    },
  };
}
```

- [ ] **Step 4: Rewrite `flex.ts`** — replace `packages/primitives/src/flex.ts` with:

```ts
import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type Instance, bind } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';

export interface FlexProps extends EventProps {
  style?: StyleInput;
  children?: Instance | Instance[];
}

function flex(direction: FlexDirection, props: FlexProps): Instance {
  const { resolved, handlers } = createInteractive(props);
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new FlexNode({ direction, children: children.map((c) => c.layout) });

  bind(resolved, (s: BaseStyle) => {
    layout.gap = s.gap ?? 0;
    layout.justify = s.justify ?? 'start';
    layout.align = s.align ?? 'start';
  });

  return {
    layout,
    children,
    handlers,
    paintSelf() {
      // containers have no own visuals
    },
  };
}

export function Row(props: FlexProps = {}): Instance {
  return flex('row', props);
}

export function Column(props: FlexProps = {}): Instance {
  return flex('column', props);
}
```

- [ ] **Step 5: Run to verify PASS + full primitives suite + typecheck**

Run: `pnpm vitest run packages/primitives/test/flex-hover.test.ts`
Expected: PASS (2 tests).
Run: `pnpm vitest run packages/primitives`
Expected: PASS — existing text/flex tests still pass (static styles resolve at the synchronous first `bind` run).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/primitives/src/text.ts packages/primitives/src/flex.ts packages/primitives/test/flex-hover.test.ts
git commit -m "feat(primitives): reactive hover/pressed restyle in Text and Row/Column"
```

---

## Task 7: platform-web — clear hover on canvas exit + example polish

**Files:**
- Modify: `packages/platform-web/src/web-input-source.ts`
- Modify: `examples/counter/main.tsx`
- Test: `packages/platform-web/test/web-input-source.test.ts`

- [ ] **Step 1: Add the failing test** — append to `packages/platform-web/test/web-input-source.test.ts`:

```ts
test('canvas pointerleave emits an out-of-bounds pointermove to clear hover', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: PointerInput[] = [];
  src.onPointer((e) => seen.push(e));
  listeners.pointerleave({ clientX: 100, clientY: 50, button: 0, pointerType: 'mouse' });
  expect(seen).toEqual([{ type: 'pointermove', x: -1, y: -1, button: 0, pointerType: 'mouse' }]);
});
```

Note: the existing `fakeCanvas()` helper in this file already records listeners by type and its `addEventListener` stores any type, so `listeners.pointerleave` will be populated once the constructor subscribes.

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/platform-web/test/web-input-source.test.ts`
Expected: FAIL — `listeners.pointerleave` is undefined (not subscribed), so calling it throws.

- [ ] **Step 3: Subscribe to `pointerleave`** — in `packages/platform-web/src/web-input-source.ts`:

In the constructor, add after the `wheel` listener:

```ts
    canvas.addEventListener('pointerleave', this.leave);
```

In `dispose()`, add:

```ts
    this.canvas.removeEventListener('pointerleave', this.leave);
```

Add this arrow field next to `down`/`move`/`up` (emits an out-of-bounds move so the dispatcher's empty-path branch clears hover; `-1,-1`, not `NaN`, because NaN comparisons read as "inside"):

```ts
  private leave = (ev: PointerEvent) => {
    const input: PointerInput = {
      type: 'pointermove',
      x: -1,
      y: -1,
      button: 0,
      pointerType: (ev.pointerType as PointerInput['pointerType']) || 'mouse',
    };
    for (const cb of this.pointerCbs) cb(input);
  };
```

- [ ] **Step 4: Run to verify PASS + typecheck**

Run: `pnpm vitest run packages/platform-web/test/web-input-source.test.ts`
Expected: PASS (6 tests total).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Add hover/pressed variants to the counter button** — in `examples/counter/main.tsx`, change the `Box` style to include state variants:

```tsx
      <Box
        style={{
          backgroundColor: '#3b82f6',
          borderRadius: 16,
          padding: 24,
          hover: { backgroundColor: '#2563eb' },
          pressed: { backgroundColor: '#1d4ed8' },
        }}
        onClick={() => setCount(count() + 1)}
      >
```

- [ ] **Step 6: Full workspace green**

Run: `pnpm vitest run`
Expected: PASS (all packages).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/platform-web/src/web-input-source.ts packages/platform-web/test/web-input-source.test.ts examples/counter/main.tsx
git commit -m "feat(platform-web): clear hover on canvas exit + hover/pressed counter button"
```

---

## Exit Criteria

- Hover and pressed style variants activate/deactivate live via pointer input, restyling both paint and layout.
- Enter/leave are non-bubbling with CSS `:hover` semantics (parent stays hovered over a child); leaving the surface clears all hover.
- `pnpm vitest run` + `pnpm typecheck` green across the workspace.
- Counter button visibly changes on hover/press (manual browser check).

## Out of Scope (7c and later)

- `focus` state, Tab order, focus ring, keyboard (7c).
- `disabled` (prop-driven) and `active` state wiring.
- Skipping interaction wiring for primitives without state variants (perf pass, Phase 12).
- Capture phase, pointer capture / drag, overflow-aware hit-testing.
