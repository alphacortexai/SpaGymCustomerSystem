import { jsPDF } from 'jspdf';

const MARGIN = 14;
const safeText = (value) => String(value ?? '').trim();
const unavailableContactModes = new Set(['', 'unavailable', 'not available', 'n/a', 'na', 'none', 'unknown']);
const hasAvailableContactMode = (row) => !unavailableContactModes.has(safeText(row.contactMethod).toLowerCase());
const orderRowsByContactMode = (rows = []) => [...rows].sort((a, b) => Number(hasAvailableContactMode(b)) - Number(hasAvailableContactMode(a)));

const pageMetrics = (pdf) => ({
  width: pdf.internal.pageSize.getWidth(),
  height: pdf.internal.pageSize.getHeight(),
});

const addPageHeader = (pdf) => {
  const { width } = pageMetrics(pdf);
  pdf.setFillColor(31, 78, 121);
  pdf.rect(0, 0, width, 11, 'F');
};

const addPageIfNeeded = (pdf, y, height = 12) => {
  const { height: pageHeight } = pageMetrics(pdf);
  if (y + height <= pageHeight - 15) return y;
  pdf.addPage();
  addPageHeader(pdf);
  return 20;
};

const drawSectionTitle = (pdf, title, y, tint = [239, 246, 255]) => {
  const { width } = pageMetrics(pdf);
  const contentWidth = width - MARGIN * 2;
  y = addPageIfNeeded(pdf, y, 18);
  pdf.setFillColor(...tint);
  pdf.roundedRect(MARGIN, y, contentWidth, 10, 2, 2, 'F');
  pdf.setTextColor(30, 64, 175);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(title, MARGIN + 5, y + 6.7);
  return y + 15;
};

const drawTable = (pdf, rows, y, columns) => {
  const { width, height: pageHeight } = pageMetrics(pdf);
  const contentWidth = width - MARGIN * 2;
  const headerHeight = 9;
  const lineHeight = 4.3;
  const cellPaddingX = 3;
  const cellPaddingY = 3;
  const minimumRowHeight = 10;
  const bottomMargin = 15;
  const totalColumnWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const scale = totalColumnWidth > contentWidth ? contentWidth / totalColumnWidth : 1;
  const scaledColumns = columns.map((column) => ({ ...column, width: column.width * scale }));
  const usablePageHeight = pageHeight - bottomMargin - 20 - headerHeight;

  y = addPageIfNeeded(pdf, y, headerHeight + 12);
  const drawHeader = () => {
    pdf.setFillColor(30, 64, 175);
    pdf.rect(MARGIN, y, contentWidth, headerHeight, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    let x = MARGIN;
    scaledColumns.forEach((column) => {
      pdf.text(column.label, x + cellPaddingX, y + 6.2, { maxWidth: Math.max(column.width - cellPaddingX * 2, 8) });
      x += column.width;
    });
    y += headerHeight;
  };
  const startNewPage = () => {
    pdf.addPage();
    addPageHeader(pdf);
    y = 20;
    drawHeader();
  };
  const drawRowSegment = (wrapped, rowIndex, lineStart, lineCount, segmentHeight) => {
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(MARGIN, y, contentWidth, segmentHeight, 'F');
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(MARGIN, y, contentWidth, segmentHeight);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    let x = MARGIN;
    wrapped.forEach((lines, index) => {
      const segmentLines = lines.slice(lineStart, lineStart + lineCount);
      if (segmentLines.length) pdf.text(segmentLines, x + cellPaddingX, y + cellPaddingY, { baseline: 'top' });
      if (index < scaledColumns.length - 1) pdf.line(x + scaledColumns[index].width, y, x + scaledColumns[index].width, y + segmentHeight);
      x += scaledColumns[index].width;
    });
    y += segmentHeight;
  };
  drawHeader();

  orderRowsByContactMode(rows).forEach((row, rowIndex) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const values = scaledColumns.map((column) => safeText(column.value(row, rowIndex)) || '—');
    const wrapped = scaledColumns.map((column, index) => pdf.splitTextToSize(values[index], Math.max(column.width - cellPaddingX * 2, 8)));
    const lineCount = Math.max(...wrapped.map((lines) => lines.length), 1);
    const rowHeight = Math.max(minimumRowHeight, lineCount * lineHeight + cellPaddingY * 2);
    const remainingHeight = pageHeight - bottomMargin - y;

    // Keep ordinary rows together. Extremely long cells are split across pages below.
    if (rowHeight <= usablePageHeight && rowHeight > remainingHeight) startNewPage();

    let lineStart = 0;
    while (lineStart < lineCount) {
      const availableHeight = pageHeight - bottomMargin - y;
      let linesThatFit = Math.floor((availableHeight - cellPaddingY * 2) / lineHeight);
      if (linesThatFit <= 0) {
        startNewPage();
        continue;
      }
      const lineCountForSegment = Math.min(lineCount - lineStart, linesThatFit);
      const segmentHeight = lineCountForSegment === lineCount - lineStart
        ? Math.max(minimumRowHeight, lineCountForSegment * lineHeight + cellPaddingY * 2)
        : lineCountForSegment * lineHeight + cellPaddingY * 2;
      drawRowSegment(wrapped, rowIndex, lineStart, lineCountForSegment, segmentHeight);
      lineStart += lineCountForSegment;
      if (lineStart < lineCount) startNewPage();
    }
  });
  return y + 8;
};

const drawEmptySection = (pdf, y) => {
  y = addPageIfNeeded(pdf, y, 14);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text('No entries recorded.', MARGIN + 5, y + 4);
  return y + 14;
};

export function generateReportPdf(report) {
  const customColumns = Array.isArray(report?.customColumns) ? report.customColumns : [];
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: customColumns.length ? 'landscape' : 'portrait' });
  const { width } = pageMetrics(pdf);
  const contentWidth = width - MARGIN * 2;
  const date = report?.reportDateKey || 'Undated report';
  const preparedBy = report?.callerName || report?.preparedByName || report?.ownerName || 'Caller';

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, width, 43, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, 42, width - MARGIN, 42);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.text(`Daily Feedback Report - ${preparedBy}`, MARGIN, 17, { maxWidth: contentWidth });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  pdf.text('Feedback, Birthdays, WhatsApp & Calls Report', MARGIN, 27);
  pdf.setFontSize(9.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`Report date: ${date}${report?.branch ? `  •  Branch: ${report.branch}` : ''}`, MARGIN, 35);

  const customDetails = (row) => customColumns.map((column) => `${column.label}: ${safeText(row.customFields?.[column.id]) || '—'}`).join(' | ');
  const columns = [
    { label: 'NO.', width: 12, value: (_, index) => index + 1 },
    { label: 'CLIENT NAME', width: 42, value: (row) => row.clientName },
    { label: 'PHONE', width: 34, value: (row) => row.phoneNumber },
    { label: 'CONTACT MODE', width: 32, value: (row) => row.contactMethod },
    { label: 'FEEDBACK / COMMENTS', width: customColumns.length ? 70 : contentWidth - 120, value: (row) => row.comment },
  ];
  if (customColumns.length) columns.push({ label: 'CUSTOM DETAILS', width: 75, value: customDetails });

  const sections = [
    { title: 'A. Birthday Clients Contacted', rows: report?.birthdayClients || [], tint: [239, 246, 255] },
    { title: 'B. Clients from Prev Day Visits', rows: [...(report?.previousDayVisits || []), ...(report?.followUps || [])], tint: [240, 253, 250] },
    { title: 'C. WhatsApp Messages', rows: report?.whatsappMessages || [], tint: [240, 253, 250] },
  ];

  let y = 54;
  sections.forEach((section) => {
    y = drawSectionTitle(pdf, section.title, y, section.tint);
    y = section.rows.length ? drawTable(pdf, section.rows, y, columns) : drawEmptySection(pdf, y);
  });

  if (safeText(report?.notes)) {
    y = drawSectionTitle(pdf, 'Additional Notes', y, [245, 243, 255]);
    const { height: pageHeight } = pageMetrics(pdf);
    y = addPageIfNeeded(pdf, y, 24);
    pdf.setFillColor(250, 250, 255);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(MARGIN, y, contentWidth, Math.min(30, pageHeight - y - 18), 2, 2, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    pdf.text(pdf.splitTextToSize(safeText(report.notes), contentWidth - 10).slice(0, 6), MARGIN + 5, y + 6, { baseline: 'top' });
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    const { height: pageHeight } = pageMetrics(pdf);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Spa EMS Reports Workspace  •  Page ${page} of ${pageCount}`, MARGIN, pageHeight - 6);
  }
  return pdf.output('datauristring');
}
