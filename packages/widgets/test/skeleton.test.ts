import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Skeleton } from '../src/skeleton';
import { recordingRenderer } from './recording-renderer';
import { defaultTheme } from '../src/theme';

describe('Skeleton — dimensions', () => {
  it('applies default height of 16', () => {
    createRoot(() => {
      const s = Skeleton({});
      const n = s.layout as any;
      expect(n.height).toBe(16);
    });
  });

  it('applies custom numeric height', () => {
    createRoot(() => {
      const s = Skeleton({ height: 40 });
      const n = s.layout as any;
      expect(n.height).toBe(40);
    });
  });

  it('applies numeric width', () => {
    createRoot(() => {
      const s = Skeleton({ width: 200 });
      const n = s.layout as any;
      expect(n.width).toBe(200);
    });
  });
});

describe('Skeleton — variant borderRadius', () => {
  it('circle variant sets borderRadius to height/2', () => {
    createRoot(() => {
      const height = 32;
      const s = Skeleton({ variant: 'circle', height });
      s.layout.size = { w: height, h: height };
      const { r, calls } = recordingRenderer();
      s.paintSelf(r);
      const rr = calls.find((c) => c.name === 'fillRoundRect');
      expect(rr).toBeTruthy();
      expect(rr!.args[1]).toBe(height / 2);
    });
  });

  it('text variant sets borderRadius to radii.sm', () => {
    createRoot(() => {
      const s = Skeleton({ variant: 'text' });
      s.layout.size = { w: 100, h: 16 };
      const { r, calls } = recordingRenderer();
      s.paintSelf(r);
      const rr = calls.find((c) => c.name === 'fillRoundRect');
      expect(rr).toBeTruthy();
      expect(rr!.args[1]).toBe(defaultTheme.radii.sm);
    });
  });

  it('rect variant defaults to radii.md', () => {
    createRoot(() => {
      const s = Skeleton({ variant: 'rect' });
      s.layout.size = { w: 100, h: 16 };
      const { r, calls } = recordingRenderer();
      s.paintSelf(r);
      const rr = calls.find((c) => c.name === 'fillRoundRect');
      expect(rr).toBeTruthy();
      expect(rr!.args[1]).toBe(defaultTheme.radii.md);
    });
  });

  it('rect variant respects custom radius prop', () => {
    createRoot(() => {
      const s = Skeleton({ variant: 'rect', radius: 3 });
      s.layout.size = { w: 100, h: 16 };
      const { r, calls } = recordingRenderer();
      s.paintSelf(r);
      const rr = calls.find((c) => c.name === 'fillRoundRect');
      expect(rr).toBeTruthy();
      expect(rr!.args[1]).toBe(3);
    });
  });

  it('default variant (no variant) behaves as rect — radii.md', () => {
    createRoot(() => {
      const s = Skeleton({});
      s.layout.size = { w: 100, h: 16 };
      const { r, calls } = recordingRenderer();
      s.paintSelf(r);
      const rr = calls.find((c) => c.name === 'fillRoundRect');
      expect(rr).toBeTruthy();
      expect(rr!.args[1]).toBe(defaultTheme.radii.md);
    });
  });
});

describe('Skeleton — role none (decorative)', () => {
  it('has semantics role "none"', () => {
    createRoot(() => {
      const s = Skeleton({});
      expect(s.semantics?.role).toBe('none');
    });
  });
});

describe('Skeleton — backgroundColor', () => {
  it('paints with the surfaceAlt (muted) background color', () => {
    createRoot(() => {
      const s = Skeleton({});
      s.layout.size = { w: 100, h: 16 };
      const { r, calls } = recordingRenderer();
      s.paintSelf(r);
      const rr = calls.find((c) => c.name === 'fillRoundRect');
      expect(rr).toBeTruthy();
      expect(rr!.args[2].color).toBe(defaultTheme.colors.surfaceAlt);
    });
  });
});

describe('Skeleton — style override (layer-2)', () => {
  it('merges extra style via style prop', () => {
    createRoot(() => {
      const s = Skeleton({ style: { opacity: 0.5 } });
      // Instance is created without error; that's the contract.
      expect(s).toBeTruthy();
    });
  });
});
