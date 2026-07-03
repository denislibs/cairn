import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Examples live outside the pnpm workspace, so resolve @cairn/* to package source
// directly (the jsx-runtime alias must precede the bare @cairn/runtime alias).
const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@cairn/runtime',
    jsxDev: false, // @cairn/runtime ships jsx-runtime only (no jsx-dev-runtime)
  },
  resolve: {
    alias: {
      '@cairn/runtime/jsx-runtime': pkg('runtime/src/jsx-runtime.ts'),
      '@cairn/reactivity': pkg('reactivity/src/index.ts'),
      '@cairn/host': pkg('host/src/index.ts'),
      '@cairn/layout': pkg('layout/src/index.ts'),
      '@cairn/runtime': pkg('runtime/src/index.ts'),
      '@cairn/primitives': pkg('primitives/src/index.ts'),
      '@cairn/style': pkg('style/src/index.ts'),
      '@cairn/events': pkg('events/src/index.ts'),
      '@cairn/platform-web': pkg('platform-web/src/index.ts'),
      '@cairn/widgets': pkg('widgets/src/index.ts'),
      '@cairn/material': pkg('material/src/index.ts'),
    },
  },
});
