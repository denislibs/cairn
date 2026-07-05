import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: ['packages/devtools/test/integration/**/*.spec.ts'],
  use: {
    baseURL: 'http://localhost:5199',
  },
  webServer: {
    command:
      'pnpm exec vite --config examples/devtools-demo/vite.config.ts examples/devtools-demo --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
