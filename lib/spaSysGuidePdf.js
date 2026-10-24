import { jsPDF } from 'jspdf';
import { SPA_SYS_GUIDE } from './spaSysGuide.js';

const MARGIN = 16;
const BOTTOM = 16;
const COLORS = {
  navy: [15, 23, 42],
  slate: [51, 65, 85],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  blue: [30, 64, 175],
  blueSoft: [239, 246, 255],
  amberSoft: [255, 251, 235],
  amber: [146, 64, 14],
};

const safe = (value) => String(value ?? '')
  .replace(/[–—]/g, '-')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/\u00a0/g, ' ');

export function generateSpaSysGuidePdf(guide = SPA_SYS_GUIDE) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const width = pageWidth - MARGIN * 2;
  let y = 0;

  pdf.setProperties({
    title: 'SPA_SYS_API_V1',
    subject: guide.subtitle,
    author: 'SpaGym',
    creator: 'SpaGym Customer System',
  });

  const newPage = (continued) => {
    pdf.addPage();
    y = 18;
    if (!continued) return;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text('SPA_SYS_API_V1  |  continued', MARGIN, 10);
  };

  const ensure = (height) => {
    if (y + height <= pageHeight - BOTTOM) return;
    newPage(true);
  };

  const writeLines = (text, { size = 10, style = 'normal', color = COLORS.slate, indent = 0, gap = 4.6 } = {}) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(safe(text), width - indent);
    ensure(lines.length * gap + 2);
    lines.forEach((line) => {
      pdf.text(line, MARGIN + indent, y);
      y += gap;
    });
    y += 1.5;
  };

  pdf.setFillColor(...COLORS.navy);
  pdf.rect(0, 0, pageWidth, 34, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text(guide.title, MARGIN, 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(safe(guide.subtitle), MARGIN, 24);
  pdf.setFontSize(8);
  const baseLabel = guide.origin
    ? `Base URL  ${String(guide.origin).replace(/\/$/, '')}${guide.basePath}`
    : `Base path  ${guide.basePath}`;
  pdf.text(pdf.splitTextToSize(safe(baseLabel), width)[0], MARGIN, 30);
  y = 44;

  guide.sections.forEach((section) => {
    ensure(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...COLORS.navy);
    pdf.text(safe(section.heading), MARGIN, y);
    y += 7;
    section.blocks.forEach((block) => {
      if (block.type === 'paragraph') writeLines(block.text);
      if (block.type === 'note') {
        const lines = pdf.splitTextToSize(safe(block.text), width - 8);
        const boxHeight = lines.length * 4.4 + 6;
        ensure(boxHeight + 2);
        pdf.setFillColor(...COLORS.amberSoft);
        pdf.roundedRect(MARGIN, y - 4, width, boxHeight, 1.5, 1.5, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(...COLORS.amber);
        lines.forEach((line, index) => pdf.text(line, MARGIN + 4, y + index * 4.4));
        y += boxHeight + 2;
      }
      if (block.type === 'bullets' || block.type === 'steps') {
        block.items.forEach((item, index) => {
          const prefix = block.type === 'steps' ? `${index + 1}. ` : '- ';
          writeLines(`${prefix}${item}`, { size: 10, indent: 2 });
        });
      }
      if (block.type === 'code') {
        const lines = pdf.splitTextToSize(safe(block.text), width - 8);
        const boxHeight = lines.length * 4.2 + 6;
        ensure(boxHeight + 2);
        pdf.setFillColor(...COLORS.blueSoft);
        pdf.roundedRect(MARGIN, y - 4, width, boxHeight, 1.5, 1.5, 'F');
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...COLORS.blue);
        lines.forEach((line, index) => pdf.text(line, MARGIN + 4, y + index * 4.2));
        y += boxHeight + 2;
      }
      if (block.type === 'table') {
        const colWidth = width / block.columns.length;
        const drawRow = (cells, header) => {
          const wrapped = cells.map((cell) => pdf.splitTextToSize(safe(cell), colWidth - 4));
          const rowHeight = Math.max(...wrapped.map((lines) => lines.length)) * 4.2 + 4;
          ensure(rowHeight);
          pdf.setFillColor(...(header ? COLORS.navy : [248, 250, 252]));
          pdf.rect(MARGIN, y - 3.5, width, rowHeight, 'F');
          pdf.setFont('helvetica', header ? 'bold' : 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(...(header ? [255, 255, 255] : COLORS.slate));
          wrapped.forEach((lines, index) => {
            lines.forEach((line, lineIndex) => pdf.text(line, MARGIN + index * colWidth + 2, y + lineIndex * 4.2));
          });
          y += rowHeight;
        };
        drawRow(block.columns, true);
        block.rows.forEach((row) => drawRow(row, false));
        y += 3;
      }
    });
    y += 3;
  });

  const pages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`SPA_SYS_API_V1 documentation  |  Page ${page} of ${pages}`, MARGIN, pageHeight - 8);
    pdf.setDrawColor(...COLORS.line);
    pdf.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);
  }
  return pdf;
}
