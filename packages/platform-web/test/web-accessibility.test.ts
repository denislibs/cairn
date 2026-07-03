// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest';
import { WebAccessibilityBridge } from '../src/web-accessibility';
import type { SemanticsNodeData } from '@cairn/host';

function makeRect(x = 10, y = 20, width = 80, height = 40) {
  return { x, y, width, height };
}

function makeCanvas(): HTMLCanvasElement {
  const parent = document.createElement('div');
  parent.style.position = 'relative';
  document.body.appendChild(parent);
  const canvas = document.createElement('canvas');
  parent.appendChild(canvas);
  return canvas;
}

beforeEach(() => {
  // Remove all child nodes without using innerHTML
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
});

test('sync a button node creates a button with aria-label and tabindex 0', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  const rect = makeRect();
  bridge.sync([{ id: 1, role: 'button', label: 'OK', rect, focusable: true }]);

  const btn = canvas.parentElement!.querySelector('button');
  expect(btn).not.toBeNull();
  expect(btn!.getAttribute('aria-label')).toBe('OK');
  expect(btn!.getAttribute('tabindex')).toBe('0');

  bridge.dispose();
});

test('button positioned correctly from rect', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  const rect = makeRect(5, 10, 60, 30);
  bridge.sync([{ id: 1, role: 'button', label: 'X', rect }]);

  const btn = canvas.parentElement!.querySelector('button')!;
  expect(btn.style.left).toBe('5px');
  expect(btn.style.top).toBe('10px');
  expect(btn.style.width).toBe('60px');
  expect(btn.style.height).toBe('30px');

  bridge.dispose();
});

test('clicking a button calls onActivate', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  let activated = false;
  bridge.sync([{ id: 1, role: 'button', label: 'OK', rect: makeRect(), onActivate: () => { activated = true; } }]);

  const btn = canvas.parentElement!.querySelector('button')!;
  btn.click();
  expect(activated).toBe(true);

  bridge.dispose();
});

test('focus after keydown calls onFocus(true)', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  let focusedKb: boolean | undefined;
  bridge.sync([{ id: 1, role: 'button', label: 'OK', rect: makeRect(), onFocus: (kb) => { focusedKb = kb; } }]);

  // Simulate keydown to set modality to keyboard
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

  const btn = canvas.parentElement!.querySelector('button')!;
  btn.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

  expect(focusedKb).toBe(true);

  bridge.dispose();
});

test('focus after pointerdown calls onFocus(false)', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  let focusedKb: boolean | undefined;
  bridge.sync([{ id: 1, role: 'button', label: 'OK', rect: makeRect(), onFocus: (kb) => { focusedKb = kb; } }]);

  // Simulate pointerdown to set modality to pointer
  window.dispatchEvent(new MouseEvent('pointerdown'));

  const btn = canvas.parentElement!.querySelector('button')!;
  btn.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

  expect(focusedKb).toBe(false);

  bridge.dispose();
});

test('blur calls onBlur', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  let blurred = false;
  bridge.sync([{ id: 1, role: 'button', label: 'OK', rect: makeRect(), onBlur: () => { blurred = true; } }]);

  const btn = canvas.parentElement!.querySelector('button')!;
  btn.dispatchEvent(new FocusEvent('blur', { bubbles: false }));

  expect(blurred).toBe(true);

  bridge.dispose();
});

test('re-sync a checkbox with checked true sets aria-checked to true', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  const baseNode: SemanticsNodeData = { id: 2, role: 'checkbox', label: 'Accept', rect: makeRect() };
  bridge.sync([baseNode]);

  bridge.sync([{ ...baseNode, checked: true }]);

  const el = canvas.parentElement!.querySelector('[role="checkbox"]')!;
  expect(el.getAttribute('aria-checked')).toBe('true');

  bridge.dispose();
});

test('re-sync with checked mixed sets aria-checked to mixed', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  bridge.sync([{ id: 3, role: 'checkbox', label: 'Mixed', rect: makeRect(), checked: 'mixed' }]);

  const el = canvas.parentElement!.querySelector('[role="checkbox"]')!;
  expect(el.getAttribute('aria-checked')).toBe('mixed');

  bridge.dispose();
});

test('dropping an id removes its element', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  bridge.sync([
    { id: 1, role: 'button', label: 'A', rect: makeRect() },
    { id: 2, role: 'button', label: 'B', rect: makeRect() },
  ]);

  expect(canvas.parentElement!.querySelectorAll('button').length).toBe(2);

  // Remove id 1
  bridge.sync([{ id: 2, role: 'button', label: 'B', rect: makeRect() }]);

  expect(canvas.parentElement!.querySelectorAll('button').length).toBe(1);
  expect(canvas.parentElement!.querySelector('button')!.getAttribute('aria-label')).toBe('B');

  bridge.dispose();
});

test('disabled true sets tabindex -1 and aria-disabled true', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  bridge.sync([{ id: 1, role: 'button', label: 'Disabled', rect: makeRect(), disabled: true }]);

  const btn = canvas.parentElement!.querySelector('button')!;
  expect(btn.getAttribute('tabindex')).toBe('-1');
  expect(btn.getAttribute('aria-disabled')).toBe('true');

  bridge.dispose();
});

test('focusable false sets tabindex -1', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  bridge.sync([{ id: 1, role: 'button', label: 'Skip', rect: makeRect(), focusable: false }]);

  const btn = canvas.parentElement!.querySelector('button')!;
  expect(btn.getAttribute('tabindex')).toBe('-1');

  bridge.dispose();
});

test('link node creates an anchor element', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  bridge.sync([{ id: 1, role: 'link', label: 'Click me', rect: makeRect() }]);

  const link = canvas.parentElement!.querySelector('a');
  expect(link).not.toBeNull();
  expect(link!.getAttribute('aria-label')).toBe('Click me');

  bridge.dispose();
});

test('slider sets aria-valuemin valuemax valuenow', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  bridge.sync([{ id: 1, role: 'slider', label: 'Volume', rect: makeRect(), min: 0, max: 100, now: 42 }]);

  const el = canvas.parentElement!.querySelector('[role="slider"]')!;
  expect(el.getAttribute('aria-valuemin')).toBe('0');
  expect(el.getAttribute('aria-valuemax')).toBe('100');
  expect(el.getAttribute('aria-valuenow')).toBe('42');

  bridge.dispose();
});

test('dispose removes the overlay container', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  bridge.sync([{ id: 1, role: 'button', label: 'X', rect: makeRect() }]);
  expect(canvas.parentElement!.children.length).toBeGreaterThan(1);

  bridge.dispose();
  expect(canvas.parentElement!.querySelectorAll('[data-cairn-a11y]').length).toBe(0);
});

test('textbox role is skipped', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  bridge.sync([{ id: 1, role: 'textbox', label: 'Name', rect: makeRect() }]);

  const container = canvas.parentElement!.querySelector('[data-cairn-a11y]')!;
  expect(container.children.length).toBe(0);

  bridge.dispose();
});

test('onActivate callback updates when re-synced without recreating the element', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);

  let count = 0;
  bridge.sync([{ id: 1, role: 'button', label: 'X', rect: makeRect(), onActivate: () => { count += 1; } }]);
  const btn1 = canvas.parentElement!.querySelector('button')!;

  // Re-sync with new callback
  bridge.sync([{ id: 1, role: 'button', label: 'X', rect: makeRect(), onActivate: () => { count += 10; } }]);
  const btn2 = canvas.parentElement!.querySelector('button')!;

  // Same DOM element (not recreated)
  expect(btn1).toBe(btn2);

  btn2.click();
  // New callback should fire (count += 10)
  expect(count).toBe(10);

  bridge.dispose();
});

test('re-syncing the same nodes does not move elements — focus is preserved', () => {
  const canvas = makeCanvas();
  const bridge = new WebAccessibilityBridge(canvas);
  const nodes: SemanticsNodeData[] = [
    { id: 1, role: 'button', label: 'A', rect: makeRect(), focusable: true },
    { id: 2, role: 'button', label: 'B', rect: makeRect(100), focusable: true },
  ];
  bridge.sync(nodes);
  const a = canvas.parentElement!.querySelector('[aria-label="A"]') as HTMLElement;
  a.focus();
  expect(document.activeElement).toBe(a);

  // A re-sync with the same nodes (same order) must NOT re-append/move elements,
  // which would blur the focused one. Sync several times (as the frame loop does).
  bridge.sync(nodes);
  bridge.sync(nodes);
  expect(document.activeElement).toBe(a); // still focused

  bridge.dispose();
});
