// Recording fake of the subset of CanvasRenderingContext2D the renderer uses.
export interface FakeContext {
  calls: unknown[][];
  [key: string]: unknown;
}

const METHODS = [
  'save',
  'restore',
  'setTransform',
  'translate',
  'scale',
  'clearRect',
  'fillRect',
  'strokeRect',
  'beginPath',
  'rect',
  'roundRect',
  'moveTo',
  'lineTo',
  'arc',
  'quadraticCurveTo',
  'closePath',
  'fill',
  'stroke',
  'clip',
  'fillText',
  'drawImage',
] as const;

const PROPS = [
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'font',
  'textAlign',
  'textBaseline',
  'shadowColor',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
] as const;

export function createFakeContext(): FakeContext {
  const calls: unknown[][] = [];
  const ctx = { calls } as FakeContext;

  for (const name of METHODS) {
    ctx[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  }

  ctx.measureText = (text: string) => {
    calls.push(['measureText', text]);
    return { width: text.length * 7 };
  };

  const makeGradient = (kind: string, ...coords: unknown[]) => {
    calls.push([kind, ...coords]);
    const g = {
      addColorStop: (offset: number, color: string) => {
        calls.push(['addColorStop', offset, color]);
      },
    };
    return g;
  };
  ctx.createLinearGradient = (...c: unknown[]) => makeGradient('createLinearGradient', ...c);
  ctx.createRadialGradient = (...c: unknown[]) => makeGradient('createRadialGradient', ...c);

  for (const prop of PROPS) {
    let value: unknown;
    Object.defineProperty(ctx, prop, {
      get() {
        return value;
      },
      set(next) {
        value = next;
        calls.push(['set:' + prop, next]);
      },
    });
  }

  return ctx;
}

export function createFakeSurface() {
  const ctx = createFakeContext();
  const sizes: Array<[number, number]> = [];
  const surface = {
    context: ctx as unknown as CanvasRenderingContext2D,
    setBackingSize(w: number, h: number) {
      sizes.push([w, h]);
    },
  };
  return { surface, ctx, sizes };
}
