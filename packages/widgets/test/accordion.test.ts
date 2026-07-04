import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { Box, Text } from '@cairn/primitives';
import { Accordion, accordionContext, accordionItemContext } from '../src/accordion';

describe('Accordion — roles', () => {
  it('Trigger has role button with aria-expanded', () => {
    createRoot(() => {
      const acc = Accordion({ defaultValue: null, children: () => Box({}) });
      runWithContext(accordionContext.context, acc._ctx, () => {
        runWithContext(accordionItemContext.context, { value: 'a' }, () => {
          const trigger = Accordion.Trigger({ children: 'Section A' });
          expect(trigger.semantics!.role).toBe('button');
          expect(trigger.semantics!.expanded).toBe(false);
        });
      });
    });
  });

  it('Content has role region', () => {
    createRoot(() => {
      const acc = Accordion({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(accordionContext.context, acc._ctx, () => {
        runWithContext(accordionItemContext.context, { value: 'a' }, () => {
          const content = Accordion.Content({ children: () => Box({}) });
          expect(content.semantics!.role).toBe('region');
        });
      });
    });
  });
});

describe('Accordion — toggle behavior', () => {
  it('trigger toggles content open/close (single)', () => {
    createRoot(() => {
      const acc = Accordion({ type: 'single', collapsible: true, defaultValue: null, children: () => Box({}) });
      runWithContext(accordionContext.context, acc._ctx, () => {
        runWithContext(accordionItemContext.context, { value: 'a' }, () => {
          const trigger = Accordion.Trigger({ children: 'A' });
          expect(acc._ctx.isOpen('a')).toBe(false);
          trigger.semantics!.onActivate!();
          expect(acc._ctx.isOpen('a')).toBe(true);
          trigger.semantics!.onActivate!();
          expect(acc._ctx.isOpen('a')).toBe(false);
        });
      });
    });
  });

  it('single type closes others when new one opens', () => {
    createRoot(() => {
      const acc = Accordion({ type: 'single', defaultValue: 'a', children: () => Box({}) });
      // Open 'a', then toggle 'b' — 'a' should close
      runWithContext(accordionContext.context, acc._ctx, () => {
        expect(acc._ctx.isOpen('a')).toBe(true);
        acc._ctx.toggle('b');
        expect(acc._ctx.isOpen('b')).toBe(true);
        expect(acc._ctx.isOpen('a')).toBe(false);
      });
    });
  });

  it('multiple type keeps several open', () => {
    createRoot(() => {
      const acc = Accordion({ type: 'multiple', defaultValue: ['a'], children: () => Box({}) });
      runWithContext(accordionContext.context, acc._ctx, () => {
        expect(acc._ctx.isOpen('a')).toBe(true);
        acc._ctx.toggle('b');
        expect(acc._ctx.isOpen('a')).toBe(true);
        expect(acc._ctx.isOpen('b')).toBe(true);
      });
    });
  });

  it('aria-expanded reflects open state reactively', () => {
    createRoot(() => {
      const acc = Accordion({ type: 'single', collapsible: true, defaultValue: null, children: () => Box({}) });
      runWithContext(accordionContext.context, acc._ctx, () => {
        runWithContext(accordionItemContext.context, { value: 'x' }, () => {
          const trigger = Accordion.Trigger({ children: 'X' });
          expect(trigger.semantics!.expanded).toBe(false);
          trigger.semantics!.onActivate!();
          expect(trigger.semantics!.expanded).toBe(true);
        });
      });
    });
  });

  it('Content renders only when open', () => {
    createRoot(() => {
      const acc = Accordion({ type: 'single', defaultValue: 'a', children: () => Box({}) });
      runWithContext(accordionContext.context, acc._ctx, () => {
        runWithContext(accordionItemContext.context, { value: 'a' }, () => {
          const content = Accordion.Content({ children: () => Box({}) });
          expect(content.children.length).toBe(1); // open
        });
        runWithContext(accordionItemContext.context, { value: 'b' }, () => {
          const content = Accordion.Content({ children: () => Box({}) });
          expect(content.children.length).toBe(0); // closed
        });
      });
    });
  });
});

describe('Accordion — onChange', () => {
  it('onChange fires with the opened value (single)', () => {
    createRoot(() => {
      const seen: any[] = [];
      const acc = Accordion({ type: 'single', defaultValue: null, onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(accordionContext.context, acc._ctx, () => {
        acc._ctx.toggle('a');
        expect(seen).toEqual(['a']);
      });
    });
  });

  it('onChange fires with array (multiple)', () => {
    createRoot(() => {
      const seen: any[] = [];
      const acc = Accordion({ type: 'multiple', defaultValue: [], onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(accordionContext.context, acc._ctx, () => {
        acc._ctx.toggle('a');
        expect(seen[0]).toEqual(['a']);
        acc._ctx.toggle('b');
        expect(seen[1]).toEqual(['a', 'b']);
      });
    });
  });
});
