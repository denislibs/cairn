import { test, expect } from 'vitest';
import { createContext, useContext, createRoot, createSignal, createEffect, runWithContext } from '../src/index';

test('createContext returns a context with a unique id and default', () => {
  const a = createContext('x');
  const b = createContext('y');
  expect(a.defaultValue).toBe('x');
  expect(typeof a.id).toBe('symbol');
  expect(a.id).not.toBe(b.id);
});

test('useContext returns the default when nothing is provided', () => {
  const ctx = createContext(42);
  expect(useContext(ctx)).toBe(42);
});

test('two distinct contexts do not interfere at their defaults', () => {
  const theme = createContext('light');
  const lang = createContext('en');
  expect(useContext(theme)).toBe('light');
  expect(useContext(lang)).toBe('en');
});

test('runWithContext makes useContext return the provided value inside fn', () => {
  const ctx = createContext('default');
  let inside = '';
  const outside = runWithContext(ctx, 'provided', () => {
    inside = useContext(ctx);
    return useContext(ctx);
  });
  expect(inside).toBe('provided');
  expect(outside).toBe('provided');
  // reverts outside the scope
  expect(useContext(ctx)).toBe('default');
});

test('nested runWithContext overrides for the same context', () => {
  const ctx = createContext('a');
  const seen: string[] = [];
  runWithContext(ctx, 'b', () => {
    seen.push(useContext(ctx));
    runWithContext(ctx, 'c', () => {
      seen.push(useContext(ctx));
    });
    seen.push(useContext(ctx));
  });
  expect(seen).toEqual(['b', 'c', 'b']);
});

test('runWithContext inherits outer contexts for other keys', () => {
  const theme = createContext('light');
  const lang = createContext('en');
  let seenLang = '';
  runWithContext(theme, 'dark', () => {
    runWithContext(lang, 'fr', () => {
      seenLang = useContext(lang);
      expect(useContext(theme)).toBe('dark'); // inherited from the outer scope
    });
  });
  expect(seenLang).toBe('fr');
});

test('an effect created inside a provider sees the context value, incl. on re-run', () => {
  const ctx = createContext('default');
  const [n, setN] = createSignal(0);
  const seen: string[] = [];
  const dispose = createRoot((d) => {
    runWithContext(ctx, 'provided', () => {
      createEffect(() => {
        n(); // track
        seen.push(useContext(ctx));
      });
    });
    return d;
  });
  expect(seen).toEqual(['provided']); // initial run
  setN(1);
  expect(seen).toEqual(['provided', 'provided']); // re-run still sees the context
  dispose();
});

test('disposing the parent root disposes effects created inside a provider', () => {
  const ctx = createContext(0);
  const [n, setN] = createSignal(0);
  let runs = 0;
  const dispose = createRoot((d) => {
    runWithContext(ctx, 1, () => {
      createEffect(() => {
        n();
        runs++;
      });
    });
    return d;
  });
  expect(runs).toBe(1);
  setN(1);
  expect(runs).toBe(2);
  dispose();
  setN(2);
  expect(runs).toBe(2); // effect inside the provider was disposed with the root
});
