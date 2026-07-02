import type {
  TextInputService,
  TextInputClient,
  TextInputConnection,
  TextEditingValue,
} from '@cairn/host';

// A hidden DOM <input> proxy: native typing/IME/backspace/selection captured off-canvas
// and mirrored back to the framework. One reusable element, one active session.
export class WebTextInputService implements TextInputService {
  private input: HTMLInputElement | null = null;
  private active: {
    client: TextInputClient;
    onInput: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
  } | null = null;

  // doc is optional so constructing the service never touches the DOM global
  // (createWebHost is exercised in a node test env); the real document is resolved
  // lazily, only when an editing session starts.
  constructor(private doc?: Document) {}

  private ensureInput(): HTMLInputElement {
    if (this.input) return this.input;
    const doc = this.doc ?? globalThis.document;
    const el = doc.createElement('input');
    el.type = 'text';
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', 'false');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    el.style.left = '0';
    el.style.top = '0';
    el.style.pointerEvents = 'none';
    doc.body.appendChild(el);
    this.input = el;
    return el;
  }

  start(client: TextInputClient, initial: TextEditingValue): TextInputConnection {
    this.closeActive();
    const el = this.ensureInput();
    el.value = initial.text;
    el.setSelectionRange(initial.selectionStart, initial.selectionEnd);

    const onInput = (): void => {
      client.onChange({
        text: el.value,
        selectionStart: el.selectionStart ?? el.value.length,
        selectionEnd: el.selectionEnd ?? el.value.length,
      });
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        client.onSubmit?.();
      } else if (e.key === 'Escape') {
        client.onCancel?.();
      }
    };
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKeyDown);
    el.focus();
    this.active = { client, onInput, onKeyDown };

    return {
      setValue: (v: TextEditingValue) => {
        el.value = v.text;
        el.setSelectionRange(v.selectionStart, v.selectionEnd);
      },
      close: () => this.closeActive(),
    };
  }

  private closeActive(): void {
    const el = this.input;
    if (!this.active || !el) return;
    el.removeEventListener('input', this.active.onInput);
    el.removeEventListener('keydown', this.active.onKeyDown);
    el.blur();
    this.active = null;
  }
}
