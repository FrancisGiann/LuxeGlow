import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Optional system test dependency; npm test still runs unit/contract coverage everywhere.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome node --test test/staffAvailability.browser.test.js
const enabled = Boolean(process.env.PLAYWRIGHT_MODULE);
test('booking availability: disabled keyboard/pointer controls, stale selections, loading/error/retry and old responses', { skip: !enabled }, async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
  const cache = await mkdtemp(resolve(tmpdir(), 'luxeglow-staff-browser-'));
  const server = await createServer({
    configFile: false, root: resolve(import.meta.dirname, '..'), cacheDir: cache,
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'synthetic-booking-only', enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('/src/pages/BookingPage.jsx')) return;
        return code.replaceAll("'../api/endpoints'", "'/test/fixtures/staffAvailabilityMocks.js'")
          .replaceAll("'../context/AuthContext'", "'/test/fixtures/staffAvailabilityMocks.js'")
          .replaceAll("'../context/DashboardContext'", "'/test/fixtures/staffAvailabilityMocks.js'")
          .replaceAll("'../components/ui/Toast'", "'/test/fixtures/staffAvailabilityMocks.js'");
      },
      configureServer(vite) {
        vite.middlewares.use('/__synthetic', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script type="module" src="/test/fixtures/bookingAvailabilityHarness.jsx"></script>'); });
      },
    }],
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ timezoneId: 'America/Los_Angeles', viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__synthetic`);
    const A = page.getByRole('radio', { name: /^Synthetic A/ });
    const B = page.getByRole('radio', { name: /^Synthetic B/ });
    const none = page.getByRole('radio', { name: /^No preference/ });
    await page.getByText('Team member preference', { exact: true }).click();
    await A.click();
    await page.evaluate(() => { window.syntheticState.blocked['00000000-0000-0000-0000-00000000000a'] = ['11:00 AM']; });
    const date = await page.locator('#booking-date').getAttribute('max'); // within server's Manila horizon
    await page.locator('#booking-date').fill(date);
    await page.getByRole('button', { name: '11:00 AM: Available', exact: true }).click();
    await page.getByText(/Your selected team member is not available at this time/).waitFor();
    assert.equal(await A.isDisabled(), true);
    assert.match(await A.innerText(), /Not available at this time/);
    assert.equal(await none.getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('button', { name: '11:00 AM: Available', exact: true }).getAttribute('class').then((c) => c.includes('bg-brand-800')), true, 'time retained');
    await none.focus(); await page.keyboard.press('Tab');
    assert.equal(await B.evaluate((el) => el === document.activeElement), true, 'disabled A skipped by keyboard');
    await page.keyboard.press('Enter');
    assert.equal(await B.getAttribute('aria-checked'), 'true');
    await A.evaluate((el) => { el.click(); el.focus(); });
    assert.equal(await B.getAttribute('aria-checked'), 'true', 'native disabled button rejects pointer and focus');

    await page.evaluate(() => { window.syntheticState.longBlocked = '00000000-0000-0000-0000-00000000000b'; window.syntheticState.delay = 150; });
    await page.getByRole('checkbox', { name: 'Select Synthetic short', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Select Synthetic extra', exact: true }).check();
    assert.equal(await B.isDisabled(), true, 'pending duration check disables choices immediately');
    await page.waitForFunction(() => document.querySelector('[role="radio"]')?.getAttribute('aria-checked') === 'true');
    await page.getByText(/Your selected team member is not available at this time/).waitFor();
    assert.equal(await B.isDisabled(), true, 'full duration conflict clears preference');
    assert.equal(await none.getAttribute('aria-checked'), 'true');

    // An older slow time request says A is free; a newer fast request says A is blocked.
    await page.evaluate(() => { window.syntheticState.delay = 500; window.syntheticState.blocked = {}; window.syntheticState.longBlocked = null; });
    const previousCalls = await page.evaluate(() => window.syntheticCalls.filter((c) => c.staff).length);
    await page.getByRole('button', { name: '11:30 AM: Available', exact: true }).click();
    await page.waitForFunction((count) => window.syntheticCalls.filter((c) => c.staff).length > count, previousCalls);
    await page.evaluate(() => { window.syntheticState.delay = 0; window.syntheticState.blocked['00000000-0000-0000-0000-00000000000a'] = ['11:00 AM']; });
    await page.getByRole('button', { name: '11:00 AM: Available', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="radio"]')].some((el) => el.textContent.includes('Synthetic A') && el.textContent.includes('Not available at this time')));
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(await A.isDisabled(), true, 'late old response cannot override new selection');
    assert.equal(await B.isDisabled(), false);

    await page.evaluate(() => { window.syntheticState.fail = true; });
    await page.getByRole('button', { name: '11:30 AM: Available', exact: true }).click();
    await page.getByText('Could not check team availability. Please try again.').waitFor();
    assert.equal(await A.isDisabled(), true); assert.equal(await B.isDisabled(), true);
    assert.equal(await none.isDisabled(), false, 'no preference remains an option');
    await page.evaluate(() => { window.syntheticState.fail = false; });
    await page.getByRole('button', { name: 'Retry team availability' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="radio"]')].filter((el) => !el.disabled).length === 3);
    await A.click(); assert.equal(await A.getAttribute('aria-checked'), 'true');
    // Date changes discard the old time, then recompute staff for the new time.
    const otherDate = new Date(`${date}T00:00:00Z`); otherDate.setUTCDate(otherDate.getUTCDate() - 1);
    await page.locator('#booking-date').fill(otherDate.toISOString().slice(0, 10));
    await page.evaluate(() => { window.syntheticState.blocked['00000000-0000-0000-0000-00000000000a'] = ['11:00 AM']; });
    await page.getByRole('button', { name: '11:00 AM: Available', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role="radio"]')?.getAttribute('aria-checked') === 'true');
    assert.equal(await A.isDisabled(), true);
    await B.click();

    // Booking rejection after a successful preflight must clear the preference
    // and return authenticated users to editing (without draft restoring review).
    await page.evaluate(() => { window.syntheticState.auth = true; window.syntheticState.bookConflict = true; });
    await page.getByRole('checkbox', { name: 'Remove Synthetic extra', exact: true }).uncheck();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="radio"]')].some((el) => el.textContent.includes('Synthetic B') && !el.disabled));
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.getByRole('button', { name: 'Confirm booking', exact: true }).click();
    await page.getByRole('heading', { name: 'Book an appointment', exact: true }).waitFor();
    assert.equal(await none.getAttribute('aria-checked'), 'true');
    assert.match(await page.getByRole('status').filter({ hasText: 'Your selected team member is not available' }).innerText(), /No preference is selected/);
    const draft = await page.evaluate(() => JSON.parse(sessionStorage.getItem('luxeglow-booking-draft-v1')));
    assert.equal(draft.staffId, null); assert.equal(draft.reviewStep, false);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); await server.close(); await rm(cache, { recursive: true, force: true });
  }
});
