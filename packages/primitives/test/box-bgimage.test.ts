import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
import { recordingRenderer } from './recording-renderer';

const img = { width: 200, height: 100 } as any; // ImageHandle

function paintBox(style: any) {
  return createRoot(() => {
    const inst = Box({ style });
    inst.layout.size = { w: 100, h: 100 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    return calls;
  });
}

describe('Box backgroundImage', () => {
  it('clips and draws the image when backgroundImage set', () => {
    const calls = paintBox({ borderRadius: 8, backgroundImage: img, backgroundSize: 'cover' });
    expect(calls.some((c) => c.name === 'clipRoundRect')).toBe(true);
    expect(calls.some((c) => c.name === 'drawImage')).toBe(true);
  });

  it('no backgroundImage → no drawImage', () => {
    const calls = paintBox({ backgroundColor: '#fff' });
    expect(calls.some((c) => c.name === 'drawImage')).toBe(false);
  });
});
