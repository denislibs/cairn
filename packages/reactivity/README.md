# @cairn/reactivity

Fine-grained reactive core for the Cairn framework. SolidJS-style primitives,
built from scratch, with no DOM dependencies.

## API

- `createSignal(value, options?)` → `[read, write]`
- `createMemo(fn, value?, options?)` → `read` (lazy, cached)
- `createEffect(fn)` — runs immediately and re-runs when tracked deps change
- `createRoot(fn)` — creates a disposal scope; `fn` receives a `dispose()`
- `onCleanup(fn)` — register a cleanup for the current scope
- `batch(fn)` — coalesce multiple writes into one update
- `untrack(fn)` — read without subscribing

## Example

```ts
import { createSignal, createMemo, createEffect, createRoot } from '@cairn/reactivity';

createRoot((dispose) => {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2);

  createEffect(() => {
    console.log(count(), doubled());
  });

  setCount(1); // logs: 1 2
  setCount(2); // logs: 2 4

  dispose(); // stops the effect
});
```

## Guarantees

- **Glitch-free:** a diamond dependency triggers each effect once per update.
- **Lazy memos:** a memo is only computed when read, and cached until a dep changes.
- **Automatic batching:** all writes triggered by one signal update are coalesced.
