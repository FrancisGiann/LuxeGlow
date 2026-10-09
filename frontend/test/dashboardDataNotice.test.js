import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
let server;
let DashboardDataNotice;

before(async () => {
  server = await createServer({
    root: frontendRoot,
    configFile: resolve(frontendRoot, 'vite.config.js'),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  ({ DashboardDataNotice } = await server.ssrLoadModule('/src/components/dashboard/DashboardDataNotice.jsx'));
});

after(async () => {
  await server?.close();
});

test('dashboard load errors render an alert and an actionable retry control', () => {
  const markup = renderToStaticMarkup(createElement(DashboardDataNotice, { onRetry() {} }));
  assert.match(markup, /role="alert"/);
  assert.match(markup, /Some information may be missing or out of date/);
  assert.match(markup, />Try again<\/button>/);
  assert.doesNotMatch(markup, /disabled=""/);
});

test('dashboard retry state disables the control while refreshing', () => {
  const markup = renderToStaticMarkup(createElement(DashboardDataNotice, { onRetry() {}, retrying: true }));
  assert.match(markup, /disabled=""/);
  assert.match(markup, />Retrying…<\/button>/);
});
