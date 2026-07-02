export type PathCommand =
  | { type: 'moveTo'; x: number; y: number }
  | { type: 'lineTo'; x: number; y: number }
  | { type: 'arc'; cx: number; cy: number; r: number; start: number; end: number }
  | { type: 'quadTo'; cx: number; cy: number; x: number; y: number }
  | { type: 'cubicTo'; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number }
  | { type: 'close' };

export interface Path {
  readonly commands: ReadonlyArray<PathCommand>;
}

export interface PathBuilder {
  moveTo(x: number, y: number): PathBuilder;
  lineTo(x: number, y: number): PathBuilder;
  arc(cx: number, cy: number, r: number, start: number, end: number): PathBuilder;
  quadTo(cx: number, cy: number, x: number, y: number): PathBuilder;
  cubicTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): PathBuilder;
  close(): PathBuilder;
  build(): Path;
}

export function createPath(): PathBuilder {
  const commands: PathCommand[] = [];
  const builder: PathBuilder = {
    moveTo(x, y) {
      commands.push({ type: 'moveTo', x, y });
      return builder;
    },
    lineTo(x, y) {
      commands.push({ type: 'lineTo', x, y });
      return builder;
    },
    arc(cx, cy, r, start, end) {
      commands.push({ type: 'arc', cx, cy, r, start, end });
      return builder;
    },
    quadTo(cx, cy, x, y) {
      commands.push({ type: 'quadTo', cx, cy, x, y });
      return builder;
    },
    cubicTo(c1x, c1y, c2x, c2y, x, y) {
      commands.push({ type: 'cubicTo', c1x, c1y, c2x, c2y, x, y });
      return builder;
    },
    close() {
      commands.push({ type: 'close' });
      return builder;
    },
    // Snapshot so later builder mutations don't affect a previously built Path.
    build() {
      return { commands: commands.slice() };
    },
  };
  return builder;
}
