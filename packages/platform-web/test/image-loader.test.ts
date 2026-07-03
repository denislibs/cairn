import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createImageLoader, clearImageCache } from '../src/image-loader';

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 0; height = 0; naturalWidth = 0; naturalHeight = 0;
  private _src = '';
  set src(v: string) { this._src = v; FakeImage.instances.push(this); }
  get src() { return this._src; }
  static instances: FakeImage[] = [];
}

beforeEach(() => { clearImageCache(); FakeImage.instances = []; (globalThis as any).Image = FakeImage as any; });

describe('createImageLoader', () => {
  it('caches by url (same promise for same url)', () => {
    const load = createImageLoader();
    const a = load('u1');
    const b = load('u1');
    expect(a).toBe(b);
    const c = load('u2');
    expect(c).not.toBe(a);
  });
  it('resolves with the loaded image handle', async () => {
    const load = createImageLoader();
    const p = load('u1');
    const img = FakeImage.instances[0];
    img.naturalWidth = 200; img.naturalHeight = 100; img.onload!();
    const handle = await p;
    expect(handle.width).toBe(200);
    expect(handle.height).toBe(100);
  });
  it('rejects on error', async () => {
    const load = createImageLoader();
    const p = load('bad');
    FakeImage.instances[0].onerror!();
    await expect(p).rejects.toBeTruthy();
  });
});
