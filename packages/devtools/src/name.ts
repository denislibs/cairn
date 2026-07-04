import type { Instance } from '@cairn/runtime';

export function inferName(inst: Instance): string {
  const dbg = (inst as { debugName?: string }).debugName;
  if (dbg) return dbg;
  const layout = inst.layout as { direction?: string; constructor?: { name?: string } };
  const cls = layout?.constructor?.name;
  switch (cls) {
    case 'FlexNode': return layout.direction === 'column' ? 'Column' : 'Row';
    case 'BoxNode': return 'Box';
    case 'TextNode': return 'Text';
    case 'StackNode': return 'Stack';
    case 'ScrollNode': return 'ScrollView';
    case 'GridNode': return 'Grid';
    default: return cls ?? 'Node';
  }
}
