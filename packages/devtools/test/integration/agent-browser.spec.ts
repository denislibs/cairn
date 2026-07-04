import { test, expect } from '@playwright/test';

// Assumes examples/devtools-demo is served at baseURL (see playwright.config webServer).
test('agent hook emits a commit snapshot', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    if (!hook) return { ok: false };
    const events: any[] = [];
    hook.subscribe((e: any) => events.push(e));
    hook.send({ type: 'get-snapshot' });
    const commit = events.find((e) => e.type === 'commit');
    return { ok: true, rootName: commit?.snapshot?.name, hasChildren: (commit?.snapshot?.children?.length ?? 0) > 0 };
  });
  expect(result.ok).toBe(true);
  expect(result.rootName).toBe('Column');
  expect(result.hasChildren).toBe(true);
});

test('pick highlights a node on canvas hover', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    hook.subscribe(() => {});
    hook.send({ type: 'get-snapshot' });   // populates the pick controller
    hook.send({ type: 'inspect-start' });
  });
  await page.mouse.move(60, 60);
  const overlay = page.locator('div[style*="z-index:2147483646"], div[style*="z-index: 2147483646"]');
  await expect(overlay.first()).toBeVisible();
});
