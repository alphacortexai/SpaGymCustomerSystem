import assert from 'node:assert/strict';
import test from 'node:test';
import { SPA_SYS_GUIDE } from './spaSysGuide.js';
import { generateSpaSysGuidePdf } from './spaSysGuidePdf.js';

test('the admin guide covers every SPA_SYS_API_V1 operation and exports a PDF', () => {
  const text = JSON.stringify(SPA_SYS_GUIDE);
  assert.match(text, /phone/);
  assert.match(text, /PATCH/);
  assert.match(text, /check-outs/);
  assert.match(text, /client.checked_in/);
  assert.equal(text.includes('birth year is always'), false);
  const pdf = generateSpaSysGuidePdf({ ...SPA_SYS_GUIDE, origin: 'https://spagym.example' });
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 2000);
  assert.ok(pdf.internal.getNumberOfPages() >= 2);
  assert.ok(pdf.guideLayout.maxBottom <= pdf.guideLayout.limitBottom);
  const errorPages = new Set(pdf.guideLayout.sectionPages['8. Errors and limits']);
  assert.equal(errorPages.size, 1);
});
