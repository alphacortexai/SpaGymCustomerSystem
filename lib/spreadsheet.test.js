import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { plainCell, readFirstSheetRows } from './spreadsheet.js';

test('reads formatted text, dates, and rich text from the first sheet', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Clients');
  sheet.addRow(['Name', 'Phone Number', 'Date of Birth', 'Branch']);
  const dataRow = sheet.addRow(['Amina Nakato', '0782000000', new Date(1990, 2, 15), 'Kololo']);
  dataRow.getCell(1).value = { richText: [{ text: 'Amina ' }, { text: 'Nakato' }] };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const rows = await readFirstSheetRows(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Name, 'Amina Nakato');
  assert.equal(rows[0]['Phone Number'], '0782000000');
  assert.equal(rows[0]['Date of Birth'] instanceof Date, true);
  assert.equal(rows[0]['Date of Birth'].getMonth(), 2);
  assert.equal(rows[0]['Date of Birth'].getDate(), 15);
  assert.equal(rows[0].Branch, 'Kololo');
});

test('uses displayed text for a numeric phone so the digits are preserved', () => {
  const cell = { value: 782000000, text: '782000000' };
  assert.equal(plainCell(cell), '782000000');
});

test('rejects a workbook with no header row', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Empty');
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(() => readFirstSheetRows(buffer), /empty|no sheets/i);
});
