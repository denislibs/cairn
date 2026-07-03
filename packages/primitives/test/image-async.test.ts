import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { Image } from '../src/image';
import { recordingRenderer } from './recording-renderer';

function fakeHost(loadImage: any) {
  return { scheduler: { requestFrame(){ return 1; }, cancelFrame(){} }, renderer:{}, metrics:{}, input:{}, loadImage } as any;
}

it('URL src: shows spinner while loading, draws after load', async () => {
  let resolveLoad: (h: any) => void = () => {};
  const loadImage = (_url: string) => new Promise((res) => { resolveLoad = res; });
  await new Promise<void>((done) => {
    createRoot(() => runWithContext(hostContext, fakeHost(loadImage), () => {
      const img = Image({ src: 'u1', width: 100, height: 100 });
      expect(img.children.length).toBe(1); // spinner while loading
      resolveLoad({ width: 200, height: 100 });
      // flush microtasks
      Promise.resolve().then(() => {
        expect(img.children.length).toBe(0); // spinner gone
        img.layout.size = { w: 100, h: 100 };
        const { r, calls } = recordingRenderer();
        img.paintSelf(r);
        expect(calls.some((c) => c.name === 'drawImage')).toBe(true);
        done();
      });
    }));
  });
});

it('URL src error: no spinner, no drawImage, no throw', async () => {
  const loadImage = (_url: string) => Promise.reject(new Error('fail'));
  await new Promise<void>((done) => {
    createRoot(() => runWithContext(hostContext, fakeHost(loadImage), () => {
      const img = Image({ src: 'bad', width: 100, height: 100 });
      Promise.resolve().then(() => Promise.resolve()).then(() => {
        expect(img.children.length).toBe(0);
        img.layout.size = { w: 100, h: 100 };
        const { r, calls } = recordingRenderer();
        expect(() => img.paintSelf(r)).not.toThrow();
        expect(calls.some((c) => c.name === 'drawImage')).toBe(false);
        done();
      });
    }));
  });
});

it('ImageHandle src draws immediately, no children', () => {
  createRoot(() => {
    const img = Image({ src: { width: 10, height: 10 } as any, width: 50, height: 50 });
    expect(img.children.length).toBe(0);
    img.layout.size = { w: 50, h: 50 };
    const { r, calls } = recordingRenderer();
    img.paintSelf(r);
    expect(calls.some((c) => c.name === 'drawImage')).toBe(true);
  });
});
