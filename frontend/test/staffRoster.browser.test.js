import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Optional existing browser runtime; no additional application dependency.
const enabled = Boolean(process.env.PLAYWRIGHT_MODULE);
test('booking staff dialog: fields, pending guard, failed save, successful save and keyboard close', { skip: !enabled }, async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
  const cache = await mkdtemp(resolve(tmpdir(), 'luxeglow-roster-browser-'));
  const server = await createServer({
    configFile: false, root: resolve(import.meta.dirname, '..'), cacheDir: cache,
    server: { host: '127.0.0.1', port: 0, hmr: false, ws: false },
    plugins: [{ name: 'synthetic-roster-only', configureServer(vite) {
      vite.middlewares.use('/__synthetic', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<div id="root"></div><script type="module" src="/test/fixtures/staffRosterHarness.jsx"></script>');
      });
    } }],
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__synthetic`);
    const launch = page.getByRole('button', { name: 'Add booking staff', exact: true });
    await launch.click();
    const dialog = page.getByRole('dialog', { name: 'Add booking staff' });
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /no login account or access permissions/);
    await page.getByLabel('Full name').fill('Synthetic Stylist');
    await page.getByLabel('Position title (optional)').fill('Nail Artist');
    await page.evaluate(() => { window.syntheticRosterFail = true; });
    const submit = page.getByRole('button', { name: 'Add to booking preferences', exact: true });
    await submit.click();
    assert.equal(await submit.isDisabled(), true);
    await dialog.locator('form').evaluate((form) => form.requestSubmit());
    await page.getByRole('alert').filter({ hasText: 'Synthetic roster failure' }).waitFor();
    assert.equal(await page.getByLabel('Full name').inputValue(), 'Synthetic Stylist');
    assert.equal(await page.evaluate(() => window.syntheticRosterCalls.length), 1, 'duplicate pending submit suppressed');
    await page.evaluate(() => { window.syntheticRosterFail = false; });
    await submit.click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => window.syntheticRosterCalls), [
      { full_name: 'Synthetic Stylist', position_title: 'Nail Artist' },
      { full_name: 'Synthetic Stylist', position_title: 'Nail Artist' },
    ]);
    await launch.click();
    assert.equal(await page.getByLabel('Full name').inputValue(), '');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await launch.evaluate((element) => element === document.activeElement), true);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
    await rm(cache, { recursive: true, force: true });
  }
});
