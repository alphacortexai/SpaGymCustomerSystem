import { jsPDF } from 'jspdf';

const MARGIN = 14;
const safeText = (value) => String(value ?? '').trim();

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
  const rowPadding = 5;
  const totalColumnWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const scale = totalColumnWidth > contentWidth ? contentWidth / totalColumnWidth : 1;
  const scaledColumns = columns.map((column) => ({ ...column, width: column.width * scale }));

  y = addPageIfNeeded(pdf, y, headerHeight + 12);
  const drawHeader = () => {
    pdf.setFillColor(30, 64, 175);
    pdf.rect(MARGIN, y, contentWidth, headerHeight, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    let x = MARGIN;
    scaledColumns.forEach((column) => {
      pdf.text(column.label, x + 3, y + 6.2, { maxWidth: Math.max(column.width - 6, 8) });
      x += column.width;
    });
    y += headerHeight;
  };
  drawHeader();

  rows.forEach((row, rowIndex) => {
    const values = scaledColumns.map((column) => safeText(column.value(row, rowIndex)) || '—');
    const wrapped = scaledColumns.map((column, index) => pdf.splitTextToSize(values[index], Math.max(column.width - 6, 8)));
    const rowHeight = Math.max(10, Math.min(34, Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + rowPadding));
    if (y + rowHeight > pageHeight - 15) {
      pdf.addPage();
      addPageHeader(pdf);
      y = 20;
      drawHeader();
    }

    if (rowIndex % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(MARGIN, y, contentWidth, rowHeight, 'F');
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(MARGIN, y, contentWidth, rowHeight);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    let x = MARGIN;
    wrapped.forEach((lines, index) => {
      pdf.text(lines.slice(0, 6), x + 3, y + 6, { baseline: 'top' });
      if (index < scaledColumns.length - 1) pdf.line(x + scaledColumns[index].width, y, x + scaledColumns[index].width, y + rowHeight);
      x += scaledColumns[index].width;
    });
    y += rowHeight;
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
  const caller = report?.callerName || report?.ownerName || 'Staff member';

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, width, 38, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.text('Daily Caller Report', MARGIN, 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(191, 219, 254);
  pdf.text('Feedback, Birthdays, WhatsApp & Calls Report', MARGIN, 26);
  pdf.text(`${date}  •  Prepared by ${caller}${report?.branch ? `  •  ${report.branch}` : ''}`, MARGIN, 32);

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
    { title: 'B. Clients Contacted from Previous-Day Visit', rows: report?.previousDayVisits || [], tint: [240, 253, 250] },
    { title: 'C. Clients from Prev Day Visits', rows: report?.followUps || [], tint: [255, 247, 237] },
    { title: 'D. WhatsApp Messages', rows: report?.whatsappMessages || [], tint: [240, 253, 250] },
  ];

  let y = 49;
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
