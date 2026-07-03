import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import type { CairnPointerEvent, CairnKeyboardEvent, CairnFocusEvent } from '@cairn/events';
import { createControl } from '../src/control';

const pe = {} as CairnPointerEvent;
const fe = {} as CairnFocusEvent;
const ke = (key: string) => ({ key } as CairnKeyboardEvent);

it('pointerEnter sets hovered', () => {
  createRoot(() => {
    const { state, handlers } = createControl({});
    expect(state.hovered()).toBe(false);
    handlers.onPointerEnter!(pe);
    expect(state.hovered()).toBe(true);
  });
});

it('pointerLeave clears hovered and pressed', () => {
  createRoot(() => {
    const { state, handlers } = createControl({});
    handlers.onPointerEnter!(pe);
    handlers.onPointerDown!(pe);
    handlers.onPointerLeave!(pe);
    expect(state.hovered()).toBe(false);
    expect(state.pressed()).toBe(false);
  });
});

it('pointerDown sets pressed when not disabled', () => {
  createRoot(() => {
    const { state, handlers } = createControl({});
    handlers.onPointerDown!(pe);
    expect(state.pressed()).toBe(true);
  });
});

it('disabled: pointerDown does NOT set pressed', () => {
  createRoot(() => {
    const { state, handlers } = createControl({ disabled: true });
    handlers.onPointerDown!(pe);
    expect(state.pressed()).toBe(false);
  });
});

it('disabled: onClick not called', () => {
  createRoot(() => {
    let clicked = 0;
    const { handlers } = createControl({ disabled: true, onClick: () => clicked++ });
    handlers.onClick!(pe);
    expect(clicked).toBe(0);
  });
});

it('onClick is called when not disabled', () => {
  createRoot(() => {
    let clicked = 0;
    const { handlers } = createControl({ onClick: () => clicked++ });
    handlers.onClick!(pe);
    expect(clicked).toBe(1);
  });
});

it('Enter key calls onClick', () => {
  createRoot(() => {
    let clicked = 0;
    const { handlers } = createControl({ onClick: () => clicked++ });
    handlers.onKeyDown!(ke('Enter'));
    expect(clicked).toBe(1);
  });
});

it('Space key calls onClick on keyup, not keydown', () => {
  createRoot(() => {
    let clicked = 0;
    const { handlers } = createControl({ onClick: () => clicked++ });
    handlers.onKeyDown!(ke(' ')); // should NOT activate on keydown
    expect(clicked).toBe(0);
    handlers.onKeyUp!(ke(' ')); // SHOULD activate on keyup
    expect(clicked).toBe(1);
  });
});

it('disabled: Enter key does NOT call onClick', () => {
  createRoot(() => {
    let clicked = 0;
    const { handlers } = createControl({ disabled: true, onClick: () => clicked++ });
    handlers.onKeyDown!(ke('Enter'));
    expect(clicked).toBe(0);
  });
});

it('focus sets focused; blur clears it', () => {
  createRoot(() => {
    const { state, handlers } = createControl({});
    handlers.onFocus!(fe);
    expect(state.focused()).toBe(true);
    handlers.onBlur!(fe);
    expect(state.focused()).toBe(false);
  });
});

it('user-supplied onPointerEnter is still invoked', () => {
  createRoot(() => {
    let called = 0;
    const { handlers } = createControl({ onPointerEnter: () => called++ });
    handlers.onPointerEnter!(pe);
    expect(called).toBe(1);
  });
});

it('state.disabled reflects the disabled prop', () => {
  createRoot(() => {
    const { state } = createControl({ disabled: true });
    expect(state.disabled).toBe(true);
  });
});

it('Enter key activates on keydown (explicit)', () => {
  createRoot(() => {
    let clicked = 0;
    const { handlers } = createControl({ onClick: () => clicked++ });
    handlers.onKeyDown!(ke('Enter'));
    expect(clicked).toBe(1);
  });
});

it('Space keydown calls preventDefault', () => {
  createRoot(() => {
    let prevented = false;
    const { handlers } = createControl({});
    const event = { key: ' ', preventDefault: () => { prevented = true; } } as any;
    handlers.onKeyDown!(event);
    expect(prevented).toBe(true);
  });
});

it('disabled: Space keyup does NOT call onClick', () => {
  createRoot(() => {
    let clicked = 0;
    const { handlers } = createControl({ disabled: true, onClick: () => clicked++ });
    handlers.onKeyUp!(ke(' '));
    expect(clicked).toBe(0);
  });
});

it('re-entering while pointer button held restores pressed state', () => {
  createRoot(() => {
    const { state, handlers } = createControl({});
    handlers.onPointerDown!(pe);
    expect(state.pressed()).toBe(true);
    handlers.onPointerLeave!(pe);
    expect(state.pressed()).toBe(false); // visual cleared on leave
    handlers.onPointerEnter!(pe); // re-enter while still holding button
    expect(state.pressed()).toBe(true); // restored
  });
});
