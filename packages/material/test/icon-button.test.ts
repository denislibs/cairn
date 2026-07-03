import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Stack } from '@cairn/primitives';
import { IconButton } from '../src/icon-button';
import { createMaterialTheme } from '../src/theme';
import type { Instance } from '@cairn/runtime';

function fakeHost() {
  const host: any = {
    scheduler: {
      requestFrame(_cb: any) { return 1; },
      cancelFrame() {},
    },
    renderer: {},
    metrics: {},
    input: {},
  };
  return host;
}

function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  return runWithContext(hostContext, fakeHost(), () =>
    runWithContext(themeContext, () => theme as any, fn),
  );
}

function fakeIcon(): Instance {
  return Stack({});
}

describe('IconButton — onClick', () => {
  it('calls onClick when handler fires', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = IconButton({ icon: fakeIcon(), onClick: () => clicked++ });
      inst.handlers!.onClick!({} as any);
      expect(clicked).toBe(1);
    }));
  });

  it('calls onClick via Enter key', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = IconButton({ icon: fakeIcon(), onClick: () => clicked++ });
      inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(clicked).toBe(1);
    }));
  });
});

describe('IconButton — disabled', () => {
  it('disabled blocks onClick', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = IconButton({ icon: fakeIcon(), disabled: true, onClick: () => clicked++ });
      inst.handlers!.onClick?.({} as any);
      expect(clicked).toBe(0);
    }));
  });
});

describe('IconButton — focusable', () => {
  it('is focusable (from headless base)', () => {
    createRoot(() => withContext(() => {
      const inst = IconButton({ icon: fakeIcon() });
      expect(inst.focusable).toBe(true);
    }));
  });
});

describe('IconButton — ripple child present', () => {
  it('tree contains a ripple instance (leaf node with custom paintSelf)', () => {
    createRoot(() => withContext(() => {
      const inst = IconButton({ icon: fakeIcon() });
      function findRippleLike(node: any): boolean {
        if (!node) return false;
        if (typeof node.paintSelf === 'function' && (node.children ?? []).length === 0) {
          return true;
        }
        for (const c of (node.children ?? [])) {
          if (findRippleLike(c)) return true;
        }
        return false;
      }
      expect(findRippleLike(inst)).toBe(true);
    }));
  });
});
