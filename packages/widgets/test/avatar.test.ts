import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { Avatar } from '../src/avatar';
import { recordingRenderer } from './recording-renderer';

function fakeHost() {
  return {
    scheduler: { requestFrame() { return 1; }, cancelFrame() {} },
    renderer: {},
    metrics: {},
    input: {},
    loadImage: (_url: string) => new Promise(() => {}), // never resolves (stays loading)
  } as any;
}

describe('Avatar — initials (no src)', () => {
  it('renders a Text child with the provided initials when no src given', () => {
    createRoot(() => {
      const a = Avatar({ initials: 'AB' });
      expect(a.children.length).toBeGreaterThan(0);
    });
  });

  it('does not crash when neither src nor initials given', () => {
    createRoot(() => {
      expect(() => Avatar({})).not.toThrow();
    });
  });
});

describe('Avatar — Image (src given)', () => {
  it('renders an Image child when src is provided', () => {
    createRoot(() => runWithContext(hostContext, fakeHost(), () => {
      const a = Avatar({ src: 'https://example.com/avatar.png', size: 40 });
      expect(a.children.length).toBe(1);
    }));
  });

  it('Image child dimensions match the size prop', () => {
    createRoot(() => runWithContext(hostContext, fakeHost(), () => {
      const size = 56;
      const a = Avatar({ src: 'https://example.com/avatar.png', size });
      const img = a.children[0];
      expect((img.layout as any).width).toBe(size);
      expect((img.layout as any).height).toBe(size);
    }));
  });
});

describe('Avatar — size prop', () => {
  it('defaults to size 40', () => {
    createRoot(() => {
      const a = Avatar({});
      expect((a.layout as any).width).toBe(40);
      expect((a.layout as any).height).toBe(40);
    });
  });

  it('applies custom size to layout', () => {
    createRoot(() => {
      const a = Avatar({ size: 64 });
      expect((a.layout as any).width).toBe(64);
      expect((a.layout as any).height).toBe(64);
    });
  });
});

describe('Avatar — shape via paint output', () => {
  it('circle shape paints a fillRoundRect with borderRadius = size/2', () => {
    createRoot(() => {
      const size = 40;
      const a = Avatar({ shape: 'circle', size, initials: 'AB' });
      a.layout.size = { w: size, h: size };
      const { r, calls } = recordingRenderer();
      a.paintSelf(r);
      const roundRect = calls.find((c) => c.name === 'fillRoundRect');
      expect(roundRect).toBeDefined();
      expect(roundRect!.args[1]).toBe(size / 2);
    });
  });

  it('square shape paints a fillRoundRect with borderRadius smaller than size/2', () => {
    createRoot(() => {
      const size = 40;
      const a = Avatar({ shape: 'square', size, initials: 'AB' });
      a.layout.size = { w: size, h: size };
      const { r, calls } = recordingRenderer();
      a.paintSelf(r);
      const roundRect = calls.find((c) => c.name === 'fillRoundRect');
      expect(roundRect).toBeDefined();
      expect(roundRect!.args[1]).toBeLessThan(size / 2);
    });
  });

  it('defaults to circle shape', () => {
    createRoot(() => {
      const size = 40;
      const a = Avatar({ size, initials: 'AB' });
      a.layout.size = { w: size, h: size };
      const { r, calls } = recordingRenderer();
      a.paintSelf(r);
      const roundRect = calls.find((c) => c.name === 'fillRoundRect');
      expect(roundRect).toBeDefined();
      expect(roundRect!.args[1]).toBe(size / 2);
    });
  });
});

describe('Avatar — semantics', () => {
  it('has role image', () => {
    createRoot(() => {
      const a = Avatar({ initials: 'JD' });
      expect(a.semantics!.role).toBe('image');
    });
  });

  it('label is alt when alt is provided', () => {
    createRoot(() => {
      const a = Avatar({ alt: 'Jane Doe', initials: 'JD' });
      expect(a.semantics!.label).toBe('Jane Doe');
    });
  });

  it('label falls back to initials when no alt', () => {
    createRoot(() => {
      const a = Avatar({ initials: 'JD' });
      expect(a.semantics!.label).toBe('JD');
    });
  });

  it('semantics is always defined with role image', () => {
    createRoot(() => {
      const a = Avatar({});
      expect(a.semantics).toBeDefined();
      expect(a.semantics!.role).toBe('image');
    });
  });
});

describe('Avatar — applyLayoutChildProps', () => {
  it('forwards flex prop to layout node', () => {
    createRoot(() => {
      const a = Avatar({ flex: 1 });
      expect((a.layout as any).flex).toBe(1);
    });
  });

  it('forwards margin prop to layout node', () => {
    createRoot(() => {
      const a = Avatar({ margin: 8 });
      const m = (a.layout as any).margin;
      expect(m).toBeDefined();
    });
  });
});

describe('Avatar — style merging', () => {
  it('accepts a style prop without throwing', () => {
    createRoot(() => {
      expect(() => Avatar({ style: { opacity: 0.5 }, size: 40 })).not.toThrow();
    });
  });

  it('style prop can override backgroundColor', () => {
    createRoot(() => {
      const size = 40;
      const a = Avatar({ size, initials: 'AB', style: { backgroundColor: '#ff0000' } });
      a.layout.size = { w: size, h: size };
      const { r, calls } = recordingRenderer();
      a.paintSelf(r);
      const roundRect = calls.find((c) => c.name === 'fillRoundRect');
      expect(roundRect).toBeDefined();
      expect(roundRect!.args[2].color).toBe('#ff0000');
    });
  });
});
