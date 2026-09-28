import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { Document, Font, Page, Text, renderToBuffer } from '@react-pdf/renderer';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontsPath = resolve(projectRoot, 'src/assets/fonts');
const receiptFont = 'ReceiptFontTest';

Font.register({
  family: receiptFont,
  fonts: [
    { src: resolve(fontsPath, 'NotoSans-Regular.ttf'), fontWeight: 400 },
    { src: resolve(fontsPath, 'NotoSans-Bold.ttf'), fontWeight: 700 },
  ],
});

test('booking confirmation PDF registers a font with the peso glyph', async () => {
  const font = Font.getFont({ fontFamily: receiptFont, fontWeight: 400 });
  await font.load();
  assert.equal(font.data.hasGlyphForCodePoint('₱'.codePointAt(0)), true);

  const document = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: { fontFamily: receiptFont } },
      React.createElement(Text, null, '₱1,234.56'),
      React.createElement(Text, { style: { fontWeight: 'bold' } }, '₱1,234.56')
    )
  );
  const pdf = await renderToBuffer(document);

  assert.ok(pdf.length > 0);
  assert.match(pdf.toString('latin1'), /\/ToUnicode/);
});
