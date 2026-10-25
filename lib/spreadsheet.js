import ExcelJS from 'exceljs';

const MAX_IMPORT_ROWS = 20000;

export function plainCell(cell) {
  const value = cell?.value;
  if (value == null || value === '') return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => String(part?.text || '')).join('').trim();
    }
    if (value.result instanceof Date) return value.result;
    if (value.result != null && typeof value.result !== 'object') {
      return typeof value.result === 'string' ? value.result.trim() : value.result;
    }
    if (typeof value.text === 'string' && value.text.trim()) return value.text.trim();
    if (typeof value.hyperlink === 'string' && typeof value.text === 'string') return value.text.trim();
  }
  if (typeof cell?.text === 'string' && cell.text.trim()) return cell.text.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim();
  return '';
}

export async function readFirstSheetRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error('Failed to read Excel file. Please ensure it is a valid .xlsx file.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel file has no sheets');

  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const name = String(plainCell(cell) ?? '').trim();
    if (name) headers[col] = name;
  });
  if (!headers.some(Boolean)) throw new Error('Excel file is empty');

  const rows = [];
  const lastRow = Math.min(sheet.rowCount || 0, MAX_IMPORT_ROWS + 1);
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record = {};
    let hasValue = false;
    headers.forEach((header, col) => {
      if (!header) return;
      const plain = plainCell(row.getCell(col));
      if (plain !== '' && plain != null) hasValue = true;
      record[header] = plain ?? '';
    });
    if (hasValue) rows.push(record);
  }
  if ((sheet.rowCount || 0) > MAX_IMPORT_ROWS + 1) {
    throw new Error(`Excel file has too many rows. The maximum is ${MAX_IMPORT_ROWS}.`);
  }
  if (!rows.length) throw new Error('Excel file is empty');
  return rows;
}
