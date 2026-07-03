import type { AccessibilityBridge, SemanticsNodeData } from '@cairn/host';

// Per-element bookkeeping so we can update callbacks without re-attaching listeners.
interface ElementState {
  el: HTMLElement;
  node: SemanticsNodeData;
}

/**
 * WebAccessibilityBridge — a hidden overlay of real DOM elements that mirrors
 * the canvas UI for screen readers, keyboard navigation, and OS assistive tech.
 *
 * The overlay is pointer-events:none so it never steals mouse interactions from
 * the canvas; elements ARE keyboard-focusable and readable by AT.
 */
export class WebAccessibilityBridge implements AccessibilityBridge {
  private container: HTMLElement | null = null;
  private elementMap = new Map<number, ElementState>();
  private modality: 'keyboard' | 'pointer' = 'pointer';

  private onKeyDown = (): void => { this.modality = 'keyboard'; };
  private onPointerDown = (): void => { this.modality = 'pointer'; };

  constructor(private canvas: HTMLCanvasElement, private doc?: Document) {
    const document = this.getDoc();
    const parent = canvas.parentElement;
    if (!parent) return;

    const container = document.createElement('div');
    container.setAttribute('data-cairn-a11y', '');
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.overflow = 'hidden';
    parent.appendChild(container);
    this.container = container;

    // Track input modality via window listeners
    const win = document.defaultView ?? globalThis;
    win.addEventListener('keydown', this.onKeyDown, true);
    win.addEventListener('pointerdown', this.onPointerDown, true);
  }

  private getDoc(): Document {
    return this.doc ?? (typeof document !== 'undefined' ? document : (globalThis as any).document);
  }

  sync(nodes: SemanticsNodeData[]): void {
    if (!this.container) return;

    const visible = nodes.filter((n) => n.role !== 'textbox'); // SA3: text input owns its own hidden input
    const incoming = new Set(visible.map((n) => n.id));

    // Remove stale elements
    for (const [id, state] of this.elementMap) {
      if (!incoming.has(id)) {
        state.el.remove();
        this.elementMap.delete(id);
      }
    }

    // Create or update elements (attributes only — do NOT move them in the DOM here)
    for (const node of visible) {
      const existing = this.elementMap.get(node.id);
      let el: HTMLElement;
      if (existing) {
        el = existing.el;
        existing.node = node; // keep listeners' callbacks fresh
      } else {
        el = this.createElement(node.role);
        this.attachListeners(el, node);
        this.elementMap.set(node.id, { el, node });
      }
      this.updateAttributes(el, node);
    }

    // Reconcile DOM order to match `nodes` (= tab order) ONLY when it actually
    // differs. Re-appending an element moves it in the DOM, which BLURS it if it
    // is focused — and we sync every frame, so an unconditional re-append would
    // steal focus/keyboard from the user constantly. Preserve focus across a reorder.
    const desired = visible.map((n) => this.elementMap.get(n.id)!.el);
    const current = Array.from(this.container.children);
    let ordered = desired.length === current.length;
    if (ordered) {
      for (let i = 0; i < desired.length; i++) {
        if (desired[i] !== current[i]) { ordered = false; break; }
      }
    }
    if (!ordered) {
      const doc = this.getDoc();
      const active = doc.activeElement as HTMLElement | null;
      for (const el of desired) this.container.appendChild(el);
      if (active && active !== doc.body && this.container.contains(active) && active.focus) {
        active.focus();
      }
    }
  }

  private createElement(role: SemanticsNodeData['role']): HTMLElement {
    const doc = this.getDoc();
    if (role === 'button') {
      return doc.createElement('button');
    }
    if (role === 'link') {
      return doc.createElement('a');
    }
    const el = doc.createElement('div');
    el.setAttribute('role', role);
    return el;
  }

  private attachListeners(el: HTMLElement, nodeRef: SemanticsNodeData): void {
    // Retrieve the LATEST node from the map when events fire, so callbacks are
    // never stale after a re-sync.
    const getState = (): ElementState | undefined => this.elementMap.get(nodeRef.id);

    el.addEventListener('click', () => {
      getState()?.node.onActivate?.();
    });

    el.addEventListener('focus', () => {
      getState()?.node.onFocus?.(this.modality === 'keyboard');
    });

    el.addEventListener('blur', () => {
      getState()?.node.onBlur?.();
    });
  }

  private updateAttributes(el: HTMLElement, node: SemanticsNodeData): void {
    // aria-label
    if (node.label !== undefined) {
      el.setAttribute('aria-label', node.label);
    } else {
      el.removeAttribute('aria-label');
    }

    // tabindex
    const focusable = node.focusable !== false && !node.disabled;
    el.setAttribute('tabindex', focusable ? '0' : '-1');

    // Conditional ARIA attributes — only set when the field is defined
    this.setOrRemoveAttr(el, 'aria-checked', node.checked !== undefined ? String(node.checked) : undefined);
    this.setOrRemoveAttr(el, 'aria-selected', node.selected !== undefined ? String(node.selected) : undefined);
    this.setOrRemoveAttr(el, 'aria-expanded', node.expanded !== undefined ? String(node.expanded) : undefined);
    this.setOrRemoveAttr(el, 'aria-disabled', node.disabled ? 'true' : undefined);
    this.setOrRemoveAttr(el, 'aria-readonly', node.readonly !== undefined ? String(node.readonly) : undefined);

    // Slider range values
    if (node.role === 'slider') {
      this.setOrRemoveAttr(el, 'aria-valuemin', node.min !== undefined ? String(node.min) : undefined);
      this.setOrRemoveAttr(el, 'aria-valuemax', node.max !== undefined ? String(node.max) : undefined);
      this.setOrRemoveAttr(el, 'aria-valuenow', node.now !== undefined ? String(node.now) : undefined);
    }

    // Heading level
    if (node.role === 'heading' && node.level !== undefined) {
      el.setAttribute('aria-level', String(node.level));
    }

    // Position + size from rect
    el.style.position = 'absolute';
    el.style.left = `${node.rect.x}px`;
    el.style.top = `${node.rect.y}px`;
    el.style.width = `${node.rect.width}px`;
    el.style.height = `${node.rect.height}px`;
    el.style.pointerEvents = 'none';

    // Make the element visually transparent but present in the a11y tree
    el.style.opacity = '0';
  }

  private setOrRemoveAttr(el: HTMLElement, attr: string, value: string | undefined): void {
    if (value !== undefined) {
      el.setAttribute(attr, value);
    } else {
      el.removeAttribute(attr);
    }
  }

  dispose(): void {
    if (!this.container) return;

    const win = this.getDoc().defaultView ?? globalThis;
    win.removeEventListener('keydown', this.onKeyDown, true);
    win.removeEventListener('pointerdown', this.onPointerDown, true);

    this.container.remove();
    this.container = null;
    this.elementMap.clear();
  }
}
