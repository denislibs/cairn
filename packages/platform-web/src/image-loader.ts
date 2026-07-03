import type { ImageHandle } from '@cairn/host';

let cache = new Map<string, Promise<ImageHandle>>();

export function clearImageCache(): void { cache = new Map(); }

export function createImageLoader(): (url: string) => Promise<ImageHandle> {
  return (url: string) => {
    const existing = cache.get(url);
    if (existing) return existing;
    const p = new Promise<ImageHandle>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Reflect natural size onto the handle; the element itself is the drawable.
        const handle = img as unknown as { width: number; height: number };
        if (!handle.width) handle.width = (img as any).naturalWidth;
        if (!handle.height) handle.height = (img as any).naturalHeight;
        resolve(img as unknown as ImageHandle);
      };
      img.onerror = () => reject(new Error('cairn: failed to load image ' + url));
      img.src = url;
    });
    cache.set(url, p);
    return p;
  };
}
