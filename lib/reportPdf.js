import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const safeText = (value) => String(value ?? '').trim();

const addPageIfNeeded = (pdf, y, height = 12) => {
  if (y + height <= 282) return y;
  pdf.addPage();
  pdf.setFillColor(31, 78, 121);
  pdf.rect(0, 0, PAGE_WIDTH, 11, 'F');
  return 20;
};

const drawSectionTitle = (pdf, title, y, tint = [239, 246, 255]) => {
  y = addPageIfNeeded(pdf, y, 18);
  pdf.setFillColor(...tint);
  pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 10, 2, 2, 'F');
  pdf.setTextColor(30, 64, 175);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(title, MARGIN + 5, y + 6.7);
  return y + 15;
};

const drawTable = (pdf, rows, y, columns) => {
  const columnWidths = columns.map((column) => column.width);
  const headerHeight = 9;
  const lineHeight = 4.3;
  const rowPadding = 5;

  y = addPageIfNeeded(pdf, y, headerHeight + 12);
  pdf.setFillColor(30, 64, 175);
  pdf.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  let x = MARGIN;
  columns.forEach((column, index) => {
    pdf.text(column.label, x + 3, y + 6.2);
    if (index < columns.length - 1) {
      pdf.setDrawColor(191, 219, 254);
      pdf.line(x + column.width, y, x + column.width, y + headerHeight);
    }
    x += column.width;
  });
  y += headerHeight;

  rows.forEach((row, rowIndex) => {
    const values = columns.map((column) => safeText(column.value(row, rowIndex)) || '—');
    const wrapped = columns.map((column, index) => pdf.splitTextToSize(values[index], column.width - 6));
    const rowHeight = Math.max(10, Math.min(32, Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + rowPadding));
    if (y + rowHeight > 282) {
      pdf.addPage();
      pdf.setFillColor(31, 78, 121);
      pdf.rect(0, 0, PAGE_WIDTH, 11, 'F');
      y = 20;
      pdf.setFillColor(30, 64, 175);
      pdf.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      let headerX = MARGIN;
      columns.forEach((column) => {
        pdf.text(column.label, headerX + 3, y + 6.2);
        headerX += column.width;
      });
      y += headerHeight;
    }

    if (rowIndex % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    let cellX = MARGIN;
    wrapped.forEach((lines, index) => {
      pdf.text(lines.slice(0, 6), cellX + 3, y + 6, { baseline: 'top' });
      if (index < columns.length - 1) pdf.line(cellX + columns[index].width, y, cellX + columns[index].width, y + rowHeight);
      cellX += columns[index].width;
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
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const date = report?.reportDateKey || 'Undated report';
  const caller = report?.callerName || report?.ownerName || 'Staff member';

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, PAGE_WIDTH, 38, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.text('Daily Caller Report', MARGIN, 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(191, 219, 254);
  pdf.text(`Spa EMS  •  ${date}`, MARGIN, 26);
  pdf.text(`Prepared by ${caller}${report?.branch ? `  •  ${report.branch}` : ''}`, MARGIN, 32);

  let y = 49;
  const sections = [
    {
      title: 'A. Birthday Clients Contacted',
      rows: report?.birthdayClients || [],
      tint: [239, 246, 255],
    },
    {
      title: 'B. Clients Contacted from Previous-Day Visit',
      rows: report?.previousDayVisits || [],
      tint: [240, 253, 250],
    },
    {
      title: 'C. Clients from Prev Day Visits',
      rows: report?.followUps || [],
      tint: [255, 247, 237],
    },
    {
      title: 'D. WhatsApp Messages',
      rows: report?.whatsappMessages || [],
      tint: [240, 253, 250],
    },
  ];

  sections.forEach((section) => {
    y = drawSectionTitle(pdf, section.title, y, section.tint);
    if (!section.rows.length) {
      y = drawEmptySection(pdf, y);
      return;
    }
    y = drawTable(pdf, section.rows, y, [
      { label: 'NO.', width: 12, value: (_, index) => index + 1 },
      { label: 'CLIENT NAME', width: 42, value: (row) => row.clientName },
      { label: 'PHONE', width: 34, value: (row) => row.phoneNumber },
      { label: 'CONTACT MODE', width: 32, value: (row) => row.contactMethod },
      { label: 'FEEDBACK / COMMENTS', width: CONTENT_WIDTH - 120, value: (row) => row.comment },
    ]);
  });

  if (safeText(report?.notes)) {
    y = drawSectionTitle(pdf, 'Additional Notes', y, [245, 243, 255]);
    y = addPageIfNeeded(pdf, y, 24);
    pdf.setFillColor(250, 250, 255);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 22, 2, 2, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    pdf.text(pdf.splitTextToSize(safeText(report.notes), CONTENT_WIDTH - 10).slice(0, 5), MARGIN + 5, y + 6, { baseline: 'top' });
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Spa EMS Reports  •  Page ${page} of ${pageCount}`, MARGIN, 291);
  }

  return pdf.output('datauristring');
}
