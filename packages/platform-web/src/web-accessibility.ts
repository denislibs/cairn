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
  private lastAutoFocusId: number | null = null;
  private livePolite: HTMLElement | null = null;
  private liveAssertive: HTMLElement | null = null;
  /** The id of the currently active modal group, or null if no modal is open. */
  private activeModalId: number | null = null;
  /** Whether the focusin trap listener is currently attached. */
  private trapActive = false;

  private onModalityKeyDown = (): void => { this.modality = 'keyboard'; };
  private onPointerDown = (): void => { this.modality = 'pointer'; };

  private onFocusTrap = (e: FocusEvent): void => {
    const target = e.target as HTMLElement | null;
    if (!target || !this.container || this.activeModalId === null) return;
    // Find the element state for this target
    let targetId: number | null = null;
    for (const [id, state] of this.elementMap) {
      if (state.el === target) { targetId = id; break; }
    }
    // If focus landed outside the active modal group, redirect to the first
    // focusable element in the group.
    const targetNode = targetId !== null ? this.elementMap.get(targetId)?.node : undefined;
    const inGroup = targetNode?.modalGroup === this.activeModalId ||
      targetNode?.modal === true && targetNode?.modalGroup === this.activeModalId;
    if (!inGroup) {
      this.focusFirstInGroup(this.activeModalId);
    }
  };

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
    win.addEventListener('keydown', this.onModalityKeyDown, true);
    win.addEventListener('pointerdown', this.onPointerDown, true);
  }

  private getDoc(): Document {
    return this.doc ?? (typeof document !== 'undefined' ? document : (globalThis as any).document);
  }

  sync(nodes: SemanticsNodeData[]): void {
    if (!this.container) return;

    const visible = nodes;
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
        el = this.createElement(node.role, node);
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

    // ── Modal focus-trap logic ──────────────────────────────────────────────
    // Determine if there is an active modal. The last node with modal:true wins
    // (in practice there is only one at a time).
    const modalNode = [...visible].reverse().find((n) => n.modal === true);
    const newModalId = modalNode ? modalNode.id : null;
    this.activeModalId = newModalId;

    if (newModalId !== null) {
      // Apply inert to elements outside the modal group, and remove inert from
      // elements that ARE inside the group.
      for (const [id, state] of this.elementMap) {
        const inGroup = state.node.modalGroup === newModalId;
        if (inGroup) {
          // Restore normal tabindex for group elements (updateAttributes already set it).
          // Remove aria-hidden if present.
          state.el.removeAttribute('aria-hidden');
        } else {
          // Background inert: tabindex=-1 + aria-hidden=true.
          state.el.setAttribute('tabindex', '-1');
          state.el.setAttribute('aria-hidden', 'true');
        }
      }
      // Attach focusin trap if not already active.
      if (!this.trapActive) {
        this.getDoc().addEventListener('focusin', this.onFocusTrap, true);
        this.trapActive = true;
      }
    } else {
      // No modal: remove trap listener and restore normal state.
      if (this.trapActive) {
        this.getDoc().removeEventListener('focusin', this.onFocusTrap, true);
        this.trapActive = false;
      }
      // Remove aria-hidden from all elements (updateAttributes restores tabindex).
      for (const [, state] of this.elementMap) {
        state.el.removeAttribute('aria-hidden');
      }
    }

    // autoFocus — edge-triggered: only focus when the autoFocus target changes
    const autoFocusNode = visible.find((n) => n.autoFocus === true);
    if (autoFocusNode) {
      if (autoFocusNode.id !== this.lastAutoFocusId) {
        this.elementMap.get(autoFocusNode.id)?.el.focus();
        this.lastAutoFocusId = autoFocusNode.id;
      }
    } else {
      this.lastAutoFocusId = null;
    }
  }

  /** Focus the first focusable element whose modalGroup === groupId. */
  private focusFirstInGroup(groupId: number): void {
    for (const [, state] of this.elementMap) {
      if (state.node.modalGroup === groupId && state.node.focusable !== false && !state.node.disabled) {
        state.el.focus();
        return;
      }
    }
  }

  private createElement(role: SemanticsNodeData['role'], node?: SemanticsNodeData): HTMLElement {
    const doc = this.getDoc();
    if (role === 'button') {
      return doc.createElement('button');
    }
    if (role === 'link') {
      // An <a> without href is exposed as generic, not link — set the role
      // explicitly so AT (and the a11y tree) treats it as an activatable link.
      const a = doc.createElement('a');
      a.setAttribute('role', 'link');
      return a;
    }
    if (role === 'textbox' || role === 'combobox') {
      if (node?.multiline) {
        return doc.createElement('textarea');
      }
      const input = doc.createElement('input');
      input.setAttribute('type', 'text');
      // A combobox is an <input role="combobox"> (editable + a popup); textbox is
      // the implicit input role.
      if (role === 'combobox') input.setAttribute('role', 'combobox');
      return input;
    }
    const el = doc.createElement('div');
    // Map our semantic role names to valid ARIA role tokens where they differ
    // ('image' is not a valid ARIA role — the ARIA token is 'img').
    el.setAttribute('role', role === 'image' ? 'img' : role);
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

    // Editable roles (textbox/combobox): wire the native input event to onInput.
    if (isEditableRole(nodeRef.role)) {
      el.addEventListener('input', () => {
        const node = getState()?.node;
        if (!node) return;
        const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
        node.onInput?.(inputEl.value);
      });
    }

    // Non-button roles use <div role="..."> which don't get native Enter/Space
    // activation — wire it up manually. Buttons already handle this natively.
    // Textbox elements handle Enter natively (or via onKeyDown forwarding below).
    if (el.tagName !== 'BUTTON') {
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        const node = getState()?.node;
        if (!node) return;

        // Forward to onKeyDown first; if handled, preventDefault and skip activation
        const handled = node.onKeyDown?.(e.key, {
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          meta: e.metaKey,
        }) ?? false;

        if (handled) {
          e.preventDefault();
          return; // skip Enter/Space activation
        }

        // Editable elements (textbox/combobox) handle typing natively — do not
        // synthesize activation on Enter/Space (those are editing keys).
        if (isEditableRole(nodeRef.role)) return;

        // Synthesize activation for Enter and Space (screen-reader convention).
        // Only prevent Space's default scroll when there is an activate handler.
        if (e.key === 'Enter') {
          node.onActivate?.();
        } else if (e.key === ' ' && node.onActivate) {
          e.preventDefault();
          node.onActivate();
        }
      });
    }
  }

  private updateAttributes(el: HTMLElement, node: SemanticsNodeData): void {
    // aria-label (not needed for native <input>/<textarea> which use aria-label directly,
    // but set it universally for AT compatibility)
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

    // aria-current
    const currentVal = node.current;
    if (currentVal !== undefined && currentVal !== false) {
      el.setAttribute('aria-current', currentVal === true ? 'true' : currentVal);
    } else {
      el.removeAttribute('aria-current');
    }
    this.setOrRemoveAttr(el, 'aria-disabled', node.disabled ? 'true' : undefined);
    this.setOrRemoveAttr(el, 'aria-readonly', node.readonly !== undefined ? String(node.readonly) : undefined);

    // Slider / progressbar range values
    if (node.role === 'slider' || node.role === 'progressbar') {
      this.setOrRemoveAttr(el, 'aria-valuemin', node.min !== undefined ? String(node.min) : undefined);
      this.setOrRemoveAttr(el, 'aria-valuemax', node.max !== undefined ? String(node.max) : undefined);
      this.setOrRemoveAttr(el, 'aria-valuenow', node.now !== undefined ? String(node.now) : undefined);
    }

    // Heading level
    if (node.role === 'heading' && node.level !== undefined) {
      el.setAttribute('aria-level', String(node.level));
    }

    // Editable roles: sync native input properties
    if (isEditableRole(node.role)) {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;

      // Placeholder
      if (node.placeholder !== undefined) {
        inputEl.placeholder = node.placeholder;
      }

      // readOnly / disabled (native attributes take precedence over ARIA for inputs)
      inputEl.readOnly = node.readonly === true;
      inputEl.disabled = node.disabled === true;

      // Sync value ONLY when the element is not focused — don't clobber the caret
      const doc = this.getDoc();
      if (el !== doc.activeElement) {
        inputEl.value = node.value ?? '';
      }
    }

    // Position + size from rect
    el.style.position = 'absolute';
    el.style.left = `${node.rect.x}px`;
    el.style.top = `${node.rect.y}px`;
    el.style.width = `${node.rect.width}px`;
    el.style.height = `${node.rect.height}px`;
    el.style.pointerEvents = 'auto'; // textbox needs pointer events to accept clicks

    // Make the element visually transparent but present in the a11y tree
    el.style.opacity = '0';

    // Restore pointer-events:none for non-editable elements (canvas handles those)
    if (!isEditableRole(node.role)) {
      el.style.pointerEvents = 'none';
    }
  }

  focus(id: number): void {
    this.elementMap.get(id)?.el.focus();
  }

  announce(message: string, assertive = false): void {
    if (!this.container) return; // guard against post-dispose calls
    const region = assertive ? this.getAssertiveRegion() : this.getPoliteRegion();
    region.textContent = '';
    Promise.resolve().then(() => { region.textContent = message; });
  }

  private getPoliteRegion(): HTMLElement {
    if (!this.livePolite) {
      this.livePolite = this.createLiveRegion('polite');
    }
    return this.livePolite;
  }

  private getAssertiveRegion(): HTMLElement {
    if (!this.liveAssertive) {
      this.liveAssertive = this.createLiveRegion('assertive');
    }
    return this.liveAssertive;
  }

  private createLiveRegion(politeness: 'polite' | 'assertive'): HTMLElement {
    const doc = this.getDoc();
    const el = doc.createElement('div');
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    el.style.position = 'absolute';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.overflow = 'hidden';
    el.style.clip = 'rect(0,0,0,0)';
    // Append directly to the container's parent so it persists across syncs
    (this.container?.parentElement ?? doc.body).appendChild(el);
    return el;
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
    win.removeEventListener('keydown', this.onModalityKeyDown, true);
    win.removeEventListener('pointerdown', this.onPointerDown, true);
    if (this.trapActive) {
      this.getDoc().removeEventListener('focusin', this.onFocusTrap, true);
      this.trapActive = false;
    }
    this.activeModalId = null;

    this.container.remove();
    this.container = null;
    this.elementMap.clear();
    this.livePolite?.remove();
    this.livePolite = null;
    this.liveAssertive?.remove();
    this.liveAssertive = null;
    this.lastAutoFocusId = null;
  }
}

// Roles backed by a real editable <input>/<textarea> (native typing/IME/selection).
function isEditableRole(role: string): boolean {
  return role === 'textbox' || role === 'combobox';
}
