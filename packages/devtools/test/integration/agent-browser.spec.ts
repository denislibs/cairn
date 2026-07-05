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

test('tree shows material component names', async ({ page }) => {
  await page.goto('/');
  const names = await page.evaluate(() => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const evts: any[] = []; hook.subscribe((e: any) => evts.push(e));
    hook.send({ type: 'get-snapshot' });
    const commit = evts.find((e) => e.type === 'commit');
    const out: string[] = [];
    const walk = (n: any) => { out.push(n.name); n.children.forEach(walk); };
    if (commit) walk(commit.snapshot);
    return out;
  });
  expect(names).toContain('Button');
});

test('nodes carry resolved style', async ({ page }) => {
  await page.goto('/');
  const hasStyle = await page.evaluate(() => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const evts: any[] = []; hook.subscribe((e: any) => evts.push(e));
    hook.send({ type: 'get-snapshot' });
    const commit = evts.find((e) => e.type === 'commit');
    let found = false;
    const walk = (n: any) => { if (n.style && (n.style.backgroundColor || n.style.padding)) found = true; n.children.forEach(walk); };
    if (commit) walk(commit.snapshot);
    return found;
  });
  expect(hasStyle).toBe(true);
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

test('set-style applies to the live instance and repaints the canvas', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async () => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: any[] = []; hook.subscribe((e: any) => events.push(e));
    hook.send({ type: 'get-snapshot' });
    const commit = events.find((e) => e.type === 'commit');
    let btn: any = null; const walk = (n: any) => { if (n.name === 'Button') btn = n; n.children.forEach(walk); };
    walk(commit.snapshot);
    if (!btn) return { ok: false };

    const canvas = document.getElementById('stage') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    // Sample a pixel inside the button fill: left edge + 6px, vertical centre.
    const sx = Math.round(btn.rect.x + 6), sy = Math.round(btn.rect.y + btn.rect.h / 2);
    const read = () => { const d = ctx.getImageData(sx, sy, 1, 1).data; return `${d[0]},${d[1]},${d[2]}`; };

    const before = read();
    hook.send({ type: 'set-style', id: btn.id, prop: 'backgroundColor', value: '#ff0000' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = read();

    const ev2: any[] = []; hook.subscribe((e: any) => ev2.push(e)); hook.send({ type: 'get-snapshot' });
    let btn2: any = null; const c2 = ev2.find((e) => e.type === 'commit');
    if (c2) { const w = (n: any) => { if (n.name === 'Button') btn2 = n; n.children.forEach(w); }; w(c2.snapshot); }
    return { ok: true, before, after, snapColor: btn2?.style?.backgroundColor };
  });
  expect(res.ok).toBe(true);
  expect(res.after).not.toBe(res.before);   // canvas actually repainted
  expect(res.after).toContain('255,0,0');    // red at the sampled pixel
  expect(res.snapColor).toBe('#ff0000');     // snapshot reflects the override
});

test('get-signals lists the named count signal; set-signal updates the app', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async () => {
    const hook = (window as any).__CAIRN_DEVTOOLS_HOOK__;
    const events: any[] = []; hook.subscribe((e: any) => events.push(e));
    hook.send({ type: 'get-signals' });
    const sig = [...events].reverse().find((e: any) => e.type === 'signals');
    const count = sig?.list?.find((s: any) => s.name === 'count');
    if (!count) return { ok: false };
    const before = count.value;
    hook.send({ type: 'set-signal', id: count.id, value: '9' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // read updated signals list
    const ev2: any[] = []; hook.subscribe((e: any) => ev2.push(e)); hook.send({ type: 'get-signals' });
    const sig2 = [...ev2].reverse().find((e: any) => e.type === 'signals');
    const count2 = sig2?.list?.find((s: any) => s.name === 'count');
    return { ok: true, before, after: count2?.value };
  });
  expect(res.ok).toBe(true);
  expect(res.before).toBe('0');
  expect(res.after).toBe('9');
});
