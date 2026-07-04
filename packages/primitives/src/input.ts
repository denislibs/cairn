import type { Renderer, TextInputConnection, TextEditingValue } from '@cairn/host';
import { BoxNode, toEdgeInsets } from '@cairn/layout';
import { type Instance, bind, useHost, type MaybeReactive } from '@cairn/runtime';
import type { SemanticsNode } from '@cairn/runtime';
import { createSignal, createEffect, untrack } from '@cairn/reactivity';
import { type BaseStyle } from '@cairn/style';
import type { CairnFocusEvent } from '@cairn/events';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';

const PLACEHOLDER_COLOR = '#9ca3af';
const DEFAULT_FONT = '16px sans-serif';

/** Parse the pixel size out of a CSS-ish font shorthand, defaulting to 16. */
function fontSizeOf(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 16;
}

export interface InputProps extends EventProps {
  value?: MaybeReactive<string>;
  onInput?: (text: string) => void;
  onSubmit?: (text: string) => void;
  placeholder?: MaybeReactive<string>;
  /** Accessible label for the field (aria-label). Falls back to placeholder when omitted. */
  label?: string;
  style?: StyleInput;
  /** Override the a11y role (default 'textbox'). e.g. 'combobox' for autocomplete. */
  role?: SemanticsNode['role'];
  /** Reactive aria-expanded (for combobox). */
  expanded?: MaybeReactive<boolean>;
  /** Semantics keydown override (return true if handled). Replaces the default Enter→submit. */
  onKey?: (key: string, mods: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => boolean;
}

/** A single-line text input backed by the host's platform text-input seam. */
export function Input(props: InputProps = {}): Instance {
  const host = useHost();
  const controlled = props.value !== undefined;
  const readValue = (): string => {
    const v = props.value;
    return typeof v === 'function' ? String((v as () => string | number)()) : String(v ?? '');
  };
  const seed = controlled ? untrack(readValue) : '';
  const [text, setText] = createSignal(seed);
  const [caret, setCaret] = createSignal(seed.length);
  const [focused, setFocused] = createSignal(false);

  let conn: TextInputConnection | null = null;
  const client = {
    onChange(v: TextEditingValue) {
      setText(v.text);
      setCaret(v.selectionEnd);
      props.onInput?.(v.text);
    },
    onSubmit() {
      props.onSubmit?.(untrack(text));
    },
    onCancel() {},
  };

  const interactiveProps = {
    ...props,
    onFocus: (e: CairnFocusEvent) => {
      if (!host.a11y) {
        // No a11y bridge: use the platform text-input seam for editing.
        conn?.close(); // guard re-entrant focus: never orphan a live session
        conn = host.textInput.start(client, {
          text: untrack(text),
          selectionStart: untrack(caret),
          selectionEnd: untrack(caret),
        });
      }
      // With a11y bridge: the bridge's real <input> is the editor; seam not started.
      setFocused(true);
      props.onFocus?.(e);
    },
    onBlur: (e: CairnFocusEvent) => {
      conn?.close();
      conn = null;
      setFocused(false);
      props.onBlur?.(e);
    },
  };
  const { resolved, handlers } = createInteractive(interactiveProps);

  // Controlled: sync external value changes into display + DOM proxy (guarded, no loop).
  if (controlled) {
    createEffect(() => {
      const ext = readValue();
      if (ext !== untrack(text)) {
        setText(ext);
        setCaret(ext.length);
        conn?.setValue({ text: ext, selectionStart: ext.length, selectionEnd: ext.length });
      }
    });
  }

  const layout = new BoxNode({});
  let current: BaseStyle = {};
  bind(resolved, (s) => {
    current = s;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pad = toEdgeInsets(s.padding as any);
    layout.padding = s.padding ?? 0;
    layout.width = s.width;
    const fs = fontSizeOf(s.font ?? DEFAULT_FONT);
    layout.height = s.height ?? fs + pad.top + pad.bottom;
  });

  // Mirror reactive state into plain fields and schedule a repaint on change.
  let displayText = seed;
  let caretIndex = seed.length;
  let isFocused = false;
  bind(
    () => ({ t: text(), c: caret(), f: focused() }),
    (v) => {
      displayText = v.t;
      caretIndex = v.c;
      isFocused = v.f;
    },
  );

  let placeholder = '';
  bind(props.placeholder ?? '', (v) => {
    placeholder = String(v);
  });

  // ── A11y: textbox semantics ────────────────────────────────────────────────
  // Build a mutable SemanticsNode; createEffect keeps reactive fields in sync.
  const readExpanded = (): boolean | undefined => {
    const e = props.expanded;
    return e === undefined ? undefined : typeof e === 'function' ? (e as () => boolean)() : (e as boolean);
  };
  const semantics: SemanticsNode = {
    role: props.role ?? 'textbox',
    label: props.label ?? (typeof props.placeholder === 'string' ? props.placeholder : undefined),
    value: seed,
    placeholder: typeof props.placeholder === 'string' ? props.placeholder : undefined,
    expanded: readExpanded(),
    onInput: (v: string) => {
      setText(v);
      setCaret(v.length);
      props.onInput?.(v);
    },
    onKeyDown: props.onKey ?? ((key: string) => {
      if (key === 'Enter') {
        props.onSubmit?.(untrack(text));
        return true;
      }
      return false;
    }),
    onFocus: (_kb: boolean) => {
      setFocused(true);
    },
    onBlur: () => {
      setFocused(false);
    },
  };

  // Keep reactive fields in sync via createEffect
  createEffect(() => {
    semantics.value = text();
    semantics.placeholder = placeholder || undefined;
    semantics.expanded = readExpanded();
    // label: explicit prop takes priority; else re-read reactive placeholder
    if (!props.label) {
      semantics.label = placeholder || undefined;
    }
  });

  const instance: Instance = {
    layout,
    children: [],
    focusable: true,
    handlers,
    semantics,
    paintSelf(r: Renderer) {
      const s = current;
      const font = s.font ?? DEFAULT_FONT;
      const color = s.color ?? '#000';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pad = toEdgeInsets(s.padding as any);
      const w = layout.size.w;
      const h = layout.size.h;
      if (s.backgroundColor) {
        r.fillRoundRect({ x: 0, y: 0, width: w, height: h }, s.borderRadius ?? 0, { color: s.backgroundColor });
      }
      // Single-line: vertically centre the text within the content box so glyph
      // ascenders/descenders are never clipped by a tight content height.
      const fs = fontSizeOf(font);
      const contentH = Math.max(0, h - pad.top - pad.bottom);
      const textY = pad.top + Math.max(0, (contentH - fs) / 2);
      r.save();
      r.clipRect({
        x: pad.left,
        y: 0,
        width: Math.max(0, w - pad.left - pad.right),
        height: h,
      });
      if (displayText.length === 0 && placeholder) {
        r.drawText(placeholder, { x: pad.left, y: textY }, { font, color: PLACEHOLDER_COLOR, baseline: 'top' });
      } else {
        r.drawText(displayText, { x: pad.left, y: textY }, { font, color, baseline: 'top' });
      }
      if (isFocused) {
        const prefixWidth = host.renderer.measureText(displayText.slice(0, caretIndex), { font }).width;
        r.fillRect(
          { x: pad.left + prefixWidth, y: textY, width: 1, height: fs },
          { color },
        );
      }
      r.restore();
    },
  };
  return instance;
}
