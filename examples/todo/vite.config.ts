import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@cairn/runtime',
    jsxDev: false,
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
    },
  },
});
