import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Grid } from '../src/grid';
import { Box } from '../src/box';

it('Grid forwards template columns + gaps to the node', () => {
  createRoot(() => {
    const g = Grid({ style: { gridTemplateColumns: '1fr 1fr', columnGap: 8 } });
    const n = g.layout as any;
    expect(n.templateColumns.length).toBe(2);
    expect(n.columnGap).toBe(8);
  });
});

it('child gridColumn string maps to node parent-data', () => {
  createRoot(() => {
    const child = Box({ gridColumn: '1 / span 2' } as any);
    const n = child.layout as any;
    expect(n.gridColumnStart).toBe(1);
    expect(n.gridColumnSpan).toBe(2);
  });
});

it('child gridArea maps through', () => {
  createRoot(() => {
    const child = Box({ gridArea: 'header' } as any);
    expect((child.layout as any).gridArea).toBe('header');
  });
});
