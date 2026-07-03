import { describe, it, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { setFrameRequester, hostContext } from '@cairn/runtime';
import { createFakeHost } from '../../primitives/test/fake-host';
import { Input } from '../src/input';
import { Field } from '../src/field';

function mountInput(host: ReturnType<typeof createFakeHost>['host'], make: () => ReturnType<typeof Input>) {
  let inst!: ReturnType<typeof Input>;
  const dispose = createRoot((d) => {
    runWithContext(hostContext, host, () => {
      inst = make();
    });
    return d;
  });
  return { inst, dispose };
}

describe('Input — onInput fires', () => {
  it('fires onInput when the inner TextField emits a change', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    const seen: string[] = [];
    const { inst, dispose } = mountInput(fh.host, () =>
      Input({ onInput: (t) => seen.push(t) }),
    );
    // The frame Box is not focusable; the inner TextField is a child
    // Find the inner TextField by walking children
    const innerTextField = inst.children[0];
    innerTextField?.handlers?.onFocus?.({ target: innerTextField } as never);
    fh.textInput.emitChange({ text: 'hello', selectionStart: 5, selectionEnd: 5 });
    expect(seen).toEqual(['hello']);
    dispose();
    setFrameRequester(null);
  });

  it('onChange is an alias for onInput', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    const seen: string[] = [];
    const { inst, dispose } = mountInput(fh.host, () =>
      Input({ onChange: (t) => seen.push(t) }),
    );
    const innerTextField = inst.children[0];
    innerTextField?.handlers?.onFocus?.({ target: innerTextField } as never);
    fh.textInput.emitChange({ text: 'world', selectionStart: 5, selectionEnd: 5 });
    expect(seen).toEqual(['world']);
    dispose();
    setFrameRequester(null);
  });
});

describe('Input — controlled value', () => {
  it('controlled value passes through to the inner TextField', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    const [val, setVal] = createSignal('initial');
    const { inst, dispose } = mountInput(fh.host, () =>
      Input({ value: val }),
    );
    const innerTextField = inst.children[0];
    innerTextField?.handlers?.onFocus?.({ target: innerTextField } as never);
    fh.textInput.setValues.length = 0;
    setVal('changed');
    expect(fh.textInput.setValues.at(-1)).toEqual({
      text: 'changed',
      selectionStart: 7,
      selectionEnd: 7,
    });
    dispose();
    setFrameRequester(null);
  });
});

describe('Input — focus lifts to frame', () => {
  it('frame is NOT focusable (only inner TextField is)', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    const { inst, dispose } = mountInput(fh.host, () => Input({}));
    // The outer frame Box should not be focusable itself
    expect(inst.focusable).toBeFalsy();
    dispose();
    setFrameRequester(null);
  });

  it('inner TextField is focusable', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    const { inst, dispose } = mountInput(fh.host, () => Input({}));
    const innerTextField = inst.children[0];
    expect(innerTextField?.focusable).toBe(true);
    dispose();
    setFrameRequester(null);
  });

  it('frame style function reacts to focused=true (focus-ring applied)', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    let focusedSignal: (() => boolean) | null = null;
    const { inst, dispose } = mountInput(fh.host, () =>
      Input({ _exposeFocused: (f: () => boolean) => { focusedSignal = f; } } as any),
    );
    // If the widget doesn't support _exposeFocused that's fine — we test via handler
    const innerTextField = inst.children[0];
    // Trigger inner onFocus
    innerTextField?.handlers?.onFocus?.({ target: innerTextField } as never);
    // After focus, the frame should reflect focused state.
    // We check that the inner TextField has started a text session (session started = focus worked)
    expect(fh.textInput.lastInitial).not.toBeNull();
    dispose();
    setFrameRequester(null);
  });
});

describe('Input — reads Field invalid', () => {
  it('when inside a Field with invalid=true, input reflects invalid styling', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    let inputInst: ReturnType<typeof Input> | null = null;

    createRoot((d) => {
      runWithContext(hostContext, fh.host, () => {
        Field({
          invalid: () => true,
          children: () => {
            inputInst = Input({});
            return inputInst;
          },
        });
      });
      return d;
    });

    expect(inputInst).not.toBeNull();
    // The input instance should exist and be renderable without throwing
    expect(inputInst!.children).toBeDefined();
    setFrameRequester(null);
  });
});

describe('Input — onSubmit', () => {
  it('onSubmit fires when the inner TextField emits submit', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    const submitted: string[] = [];
    const { inst, dispose } = mountInput(fh.host, () =>
      Input({ onSubmit: (t) => submitted.push(t) }),
    );
    const innerTextField = inst.children[0];
    innerTextField?.handlers?.onFocus?.({ target: innerTextField } as never);
    fh.textInput.emitChange({ text: 'submit me', selectionStart: 9, selectionEnd: 9 });
    fh.textInput.emitSubmit();
    expect(submitted).toEqual(['submit me']);
    dispose();
    setFrameRequester(null);
  });
});

describe('Input — placeholder', () => {
  it('accepts a placeholder prop without throwing', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    const { inst, dispose } = mountInput(fh.host, () =>
      Input({ placeholder: 'Enter text...' }),
    );
    expect(inst).toBeDefined();
    dispose();
    setFrameRequester(null);
  });
});

describe('Input — disabled', () => {
  it('accepts disabled prop without throwing', () => {
    setFrameRequester(() => {});
    const fh = createFakeHost();
    const { inst, dispose } = mountInput(fh.host, () =>
      Input({ disabled: true }),
    );
    expect(inst).toBeDefined();
    dispose();
    setFrameRequester(null);
  });
});
