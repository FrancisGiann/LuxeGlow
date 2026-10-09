import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test, { after, before } from 'node:test';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { createServer } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let server;
let ReceiptDocument;
let normalizeReceipt;
let BookingReceiptModal;

before(async () => {
  server = await createServer({
    root: projectRoot,
    configFile: resolve(projectRoot, 'vite.config.js'),
    server: { middlewareMode: true },
    appType: 'custom',
    plugins: [{
      name: 'test-local-font-files',
      enforce: 'pre',
      load(id) {
        const file = id.split('?')[0];
        return /\/NotoSans-(Regular|Bold)\.ttf$/.test(file)
          ? `export default ${JSON.stringify(file)}`
          : null;
      },
    }],
  });
  ({ BookingReceiptModal, ReceiptDocument, normalizeReceipt } = await server.ssrLoadModule('/src/components/booking/BookingReceiptModal.jsx'));
});

after(async () => {
  await server?.close();
});

test('the actual booking receipt document renders its details and peso glyph to PDF', async () => {
  const font = Font.getFont({ fontFamily: 'ReceiptSans', fontWeight: 400 });
  await font.load();
  assert.equal(font.data.hasGlyphForCodePoint('₱'.codePointAt(0)), true);

  const normalized = normalizeReceipt({
    reference: 'BK-TEST-001',
    customer: { full_name: 'Mina Test', email: 'mina@example.test' },
    services: [{ name: 'Classic Manicure', price: 450 }],
    serviceTotal: 450,
    status: 'Pending',
  });
  const document = React.createElement(ReceiptDocument, {
    normalized,
    appointmentDate: 'Friday, October 9, 2026',
    appointmentTime: '10:00 AM',
    generatedAt: new Date('2026-10-09T02:00:00Z'),
    hidePrint: false,
  });
  const pdf = await renderToBuffer(document);

  assert.ok(pdf.length > 0);
  assert.match(pdf.toString('latin1'), /\/ToUnicode/);
});

test('receipt modal shows readable details and an explicit PDF download action without an embedded viewer', () => {
  const html = renderToStaticMarkup(React.createElement(BookingReceiptModal, {
    receipt: {
      reference: 'BK-MOCK-0004',
      customer: { full_name: 'Mina Test', email: 'mina@example.test' },
      services: [{ name: 'Classic Manicure', price: 450 }],
      serviceTotal: 450,
      staffName: 'Rina Lopez',
      appointmentDate: '2026-10-09',
      appointmentTime: '10:00',
      status: 'Pending',
    },
    onClose() {},
  }));
  assert.match(html, /BK-MOCK-0004/);
  assert.match(html, /Classic Manicure/);
  assert.match(html, /Rina Lopez/);
  assert.match(html, /Download PDF/);
  assert.doesNotMatch(html, /<iframe/);
});
