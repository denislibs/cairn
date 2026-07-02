import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Path } from '../src/svg';
import { recordingRenderer } from './recording-renderer';

describe('Path / Svg primitive', () => {
  it('fills a path scaled to size', () => {
    createRoot(() => {
      const inst = Path({ d: 'M0 0 L24 0 L24 24 Z', fill: '#f00', width: 48, height: 48, viewBox: [0, 0, 24, 24] });
      inst.layout.size = { w: 48, h: 48 };
      const { r, calls } = recordingRenderer();
      inst.paintSelf(r);
      expect(calls.some((c) => c.name === 'scale' && c.args[0] === 2 && c.args[1] === 2)).toBe(true);
      expect(calls.some((c) => c.name === 'fillPath')).toBe(true);
    });
  });

  it('strokes a path with strokeWidth', () => {
    createRoot(() => {
      const inst = Path({ d: 'M0 0 L10 10', stroke: '#00f', strokeWidth: 3, width: 20, height: 20 });
      inst.layout.size = { w: 20, h: 20 };
      const { r, calls } = recordingRenderer();
      inst.paintSelf(r);
      expect(calls.some((c) => c.name === 'strokePath')).toBe(true);
      expect(calls.some((c) => c.name === 'strokePath' && c.args[1]?.width === 3)).toBe(true);
    });
  });

  it('defaults to identity scale when no viewBox provided', () => {
    createRoot(() => {
      const inst = Path({ d: 'M0 0 L10 10', fill: '#0f0', width: 10, height: 10 });
      inst.layout.size = { w: 10, h: 10 };
      const { r, calls } = recordingRenderer();
      inst.paintSelf(r);
      expect(calls.some((c) => c.name === 'scale' && c.args[0] === 1 && c.args[1] === 1)).toBe(true);
    });
  });

  it('wraps save/restore around paint operations', () => {
    createRoot(() => {
      const inst = Path({ d: 'M0 0 L5 5', fill: '#fff', width: 10, height: 10 });
      inst.layout.size = { w: 10, h: 10 };
      const { r, calls } = recordingRenderer();
      inst.paintSelf(r);
      const names = calls.map((c) => c.name);
      expect(names[0]).toBe('save');
      expect(names[names.length - 1]).toBe('restore');
    });
  });
});
