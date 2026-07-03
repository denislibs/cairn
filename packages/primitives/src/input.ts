import type { Renderer, TextInputConnection, TextEditingValue } from '@cairn/host';
import { BoxNode, toEdgeInsets } from '@cairn/layout';
import { type Instance, bind, useHost, type MaybeReactive } from '@cairn/runtime';
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
  style?: StyleInput;
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
      conn?.close(); // guard re-entrant focus: never orphan a live session
      conn = host.textInput.start(client, {
        text: untrack(text),
        selectionStart: untrack(caret),
        selectionEnd: untrack(caret),
      });
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

  return {
    layout,
    children: [],
    focusable: true,
    handlers,
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
      r.save();
      r.clipRect({
        x: pad.left,
        y: pad.top,
        width: Math.max(0, w - pad.left - pad.right),
        height: Math.max(0, h - pad.top - pad.bottom),
      });
      if (displayText.length === 0 && placeholder) {
        r.drawText(placeholder, { x: pad.left, y: pad.top }, { font, color: PLACEHOLDER_COLOR, baseline: 'top' });
      } else {
        r.drawText(displayText, { x: pad.left, y: pad.top }, { font, color, baseline: 'top' });
      }
      if (isFocused) {
        const prefixWidth = host.renderer.measureText(displayText.slice(0, caretIndex), { font }).width;
        r.fillRect(
          { x: pad.left + prefixWidth, y: pad.top, width: 1, height: fontSizeOf(font) },
          { color },
        );
      }
      r.restore();
    },
  };
}
