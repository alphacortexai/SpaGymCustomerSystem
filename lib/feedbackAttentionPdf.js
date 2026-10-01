import { jsPDF } from 'jspdf';

const MARGIN = 14;
const BOTTOM_MARGIN = 16;
const LINE_HEIGHT = 4.2;
const DESCRIPTION = 'Review saved caller feedback across a selected date range. AI flags entries that may need a follow-up; every flagged item retains its caller and client details.';
const COLORS = {
  navy: [15, 23, 42],
  slate: [51, 65, 85],
  muted: [100, 116, 139],
  border: [226, 232, 240],
  blue: [37, 99, 235],
  blueLight: [239, 246, 255],
  rose: [190, 18, 60],
  roseLight: [255, 241, 242],
  amber: [180, 83, 9],
  amberLight: [255, 251, 235],
  green: [4, 120, 87],
  greenLight: [236, 253, 245],
  white: [255, 255, 255],
};

const textValue = (value, fallback = 'Not recorded') => String(value ?? '').trim() || fallback;
const pdfSafeText = (value) => textValue(value)
  .replace(/[–—]/g, '-')
  .replace(/·/g, '|')
  .replace(/…/g, '...')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ');

function displayDate(value) {
  if (!value) return 'Date not recorded';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function generateFeedbackAttentionPdf(report) {
  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const urgentCount = findings.filter((item) => item.severity === 'urgent').length;
  const attentionCount = findings.length - urgentCount;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = 0;

  pdf.setProperties({
    title: 'Feedback - (Attention Required)',
    subject: DESCRIPTION,
    author: 'SpaGym Admin',
    creator: 'SpaGym Customer System',
  });

  const addContinuationPage = () => {
    pdf.addPage();
    pdf.setFillColor(...COLORS.white);
    pdf.rect(0, 0, pageWidth, 14, 'F');
    pdf.setDrawColor(...COLORS.border);
    pdf.line(MARGIN, 14, pageWidth - MARGIN, 14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.navy);
    pdf.text('FEEDBACK - (ATTENTION REQUIRED)  |  CONTINUED', MARGIN, 9);
    y = 21;
  };

  const ensureSpace = (height = 8) => {
    if (y + height <= pageHeight - BOTTOM_MARGIN) return;
    addContinuationPage();
  };

  const wrappedLines = (value, width, size = 9, style = 'normal') => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    return pdf.splitTextToSize(pdfSafeText(value), width);
  };

  const drawLineSet = (lines, x, top, lineHeight = LINE_HEIGHT) => {
    lines.forEach((line, index) => pdf.text(line, x, top + index * lineHeight));
  };

  const drawMetricCard = (x, top, width, label, value, caption, fill, accent) => {
    const height = 25;
    pdf.setFillColor(...fill);
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(x, top, width, height, 2.5, 2.5, 'FD');
    pdf.setFillColor(...accent);
    pdf.roundedRect(x, top, 2, height, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(label.toUpperCase(), x + 6, top + 6);
    pdf.setFontSize(17);
    pdf.setTextColor(...accent);
    pdf.text(String(value ?? 0), x + 6, top + 15.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.slate);
    pdf.text(caption, x + 6, top + 21.5);
    return height;
  };

  const drawTextCard = (label, value, { fill = COLORS.white, accent = COLORS.blue } = {}) => {
    const lines = wrappedLines(value, contentWidth - 12, 9, 'normal');
    let position = 0;
    let continued = false;
    while (position < lines.length) {
      let available = pageHeight - BOTTOM_MARGIN - y;
      if (available < 20) {
        addContinuationPage();
        available = pageHeight - BOTTOM_MARGIN - y;
      }
      const maxLines = Math.max(1, Math.floor((available - 12) / LINE_HEIGHT));
      const chunk = lines.slice(position, position + maxLines);
      const boxHeight = 11 + chunk.length * LINE_HEIGHT;
      pdf.setFillColor(...fill);
      pdf.setDrawColor(...COLORS.border);
      pdf.roundedRect(MARGIN, y, contentWidth, boxHeight, 2.5, 2.5, 'FD');
      pdf.setFillColor(...accent);
      pdf.roundedRect(MARGIN, y, 1.5, boxHeight, 0.75, 0.75, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(`${label.toUpperCase()}${continued ? ' (CONTINUED)' : ''}`, MARGIN + 5, y + 4.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...COLORS.slate);
      drawLineSet(chunk, MARGIN + 5, y + 9, LINE_HEIGHT);
      y += boxHeight + 3;
      position += chunk.length;
      continued = true;
      if (position < lines.length) addContinuationPage();
    }
  };

  const drawInfoGrid = (item) => {
    const columns = [
      ['Caller', item.callerName || 'Caller not recorded'],
      ['Client', item.clientName || 'Client name not recorded'],
      ['Phone', item.phoneNumber || 'Phone not recorded'],
    ];
    const gap = 3;
    const columnWidth = (contentWidth - gap * 2) / 3;
    const wrapped = columns.map(([, value]) => wrappedLines(value, columnWidth - 8, 9, 'bold'));
    const lineCount = Math.max(...wrapped.map((lines) => lines.length), 1);
    const height = Math.max(19, 11 + lineCount * 4.1);
    ensureSpace(height + 3);
    pdf.setFillColor(...COLORS.white);
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(MARGIN, y, contentWidth, height, 2.5, 2.5, 'FD');
    columns.forEach(([label], index) => {
      const x = MARGIN + 4 + index * (columnWidth + gap);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(label.toUpperCase(), x, y + 5);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...COLORS.navy);
      drawLineSet(wrapped[index], x, y + 10, 4.1);
    });
    y += height + 3;
  };

  const drawTwoColumnCards = (leftLabel, leftValue, rightLabel, rightValue) => {
    const gap = 4;
    const columnWidth = (contentWidth - gap) / 2;
    const leftLines = wrappedLines(leftValue, columnWidth - 10, 8.5, 'normal');
    const rightLines = wrappedLines(rightValue, columnWidth - 10, 8.5, 'normal');
    const lineCount = Math.max(leftLines.length, rightLines.length, 1);
    const height = 11 + lineCount * 4;
    const available = pageHeight - BOTTOM_MARGIN - y;
    if (height > available || height > pageHeight - 40) {
      drawTextCard(leftLabel, leftValue, { fill: COLORS.blueLight, accent: COLORS.blue });
      drawTextCard(rightLabel, rightValue, { fill: COLORS.white, accent: COLORS.rose });
      return;
    }
    ensureSpace(height + 3);
    const boxes = [
      { x: MARGIN, label: leftLabel, lines: leftLines, fill: COLORS.blueLight, accent: COLORS.blue },
      { x: MARGIN + columnWidth + gap, label: rightLabel, lines: rightLines, fill: COLORS.white, accent: COLORS.rose },
    ];
    boxes.forEach((box) => {
      pdf.setFillColor(...box.fill);
      pdf.setDrawColor(...COLORS.border);
      pdf.roundedRect(box.x, y, columnWidth, height, 2.5, 2.5, 'FD');
      pdf.setFillColor(...box.accent);
      pdf.roundedRect(box.x, y, 1.5, height, 0.75, 0.75, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(box.label.toUpperCase(), box.x + 5, y + 4.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...COLORS.slate);
      drawLineSet(box.lines, box.x + 5, y + 9, 4);
    });
    y += height + 3;
  };

  const drawFindingHeading = (item, index) => {
    const urgent = item.severity === 'urgent';
    const fill = urgent ? COLORS.roseLight : COLORS.amberLight;
    const accent = urgent ? COLORS.rose : COLORS.amber;
    const meta = `${displayDate(item.reportDate)}  |  ${item.branch || 'Branch not recorded'}  |  ${item.section || 'Feedback'}`;
    const metaLines = wrappedLines(meta, contentWidth - 64, 7.5, 'normal');
    const height = Math.max(15, 7 + metaLines.length * 3.4);
    ensureSpace(height + 25);
    pdf.setFillColor(...fill);
    pdf.setDrawColor(...(urgent ? [254, 205, 211] : [253, 230, 138]));
    pdf.roundedRect(MARGIN, y, contentWidth, height, 2.5, 2.5, 'FD');
    pdf.setFillColor(...accent);
    pdf.roundedRect(MARGIN, y, 2, height, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...accent);
    pdf.text(`${index + 1}. ${urgent ? 'URGENT CONCERN' : 'NEEDS ATTENTION'}`, MARGIN + 6, y + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.slate);
    drawLineSet(metaLines, MARGIN + 63, y + 5, 3.4);
    y += height + 3;
  };

  pdf.setFillColor(...COLORS.white);
  pdf.rect(0, 0, pageWidth, 47, 'F');
  pdf.setDrawColor(...COLORS.border);
  pdf.line(MARGIN, 47, pageWidth - MARGIN, 47);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLORS.rose);
  pdf.text('ADMIN REVIEW', MARGIN, 10);
  pdf.setFontSize(21);
  pdf.setTextColor(...COLORS.white);
  pdf.text('Feedback - (Attention Required)', MARGIN, 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...COLORS.slate);
  const descriptionLines = pdf.splitTextToSize(DESCRIPTION, contentWidth);
  drawLineSet(descriptionLines, MARGIN, 27, 4);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.navy);
  pdf.text(`${displayDate(report?.startDate)} - ${displayDate(report?.endDate)}${report?.branch ? `  |  ${report.branch}` : '  |  Both branches'}`, MARGIN, 42);
  y = 54;

  const gap = 3;
  const metricWidth = (contentWidth - gap * 2) / 3;
  drawMetricCard(MARGIN, y, metricWidth, 'Reports reviewed', report?.reportCount ?? 0, `${report?.feedbackCount ?? 0} feedback entries`, [248, 250, 252], COLORS.blue);
  drawMetricCard(MARGIN + metricWidth + gap, y, metricWidth, 'Urgent', urgentCount, 'Prioritize follow-up', COLORS.roseLight, COLORS.rose);
  drawMetricCard(MARGIN + (metricWidth + gap) * 2, y, metricWidth, 'Needs attention', attentionCount, 'Consider follow-up', COLORS.amberLight, COLORS.amber);
  y += 32;

  const summaryLines = (String(report?.summary || '').split(/\r?\n/).map((line) => line.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean));
  const summaryBullets = summaryLines.length ? summaryLines : ['No recurring concern themes were identified.'];
  const summaryWrapped = summaryBullets.map((line) => pdf.splitTextToSize(pdfSafeText(line), contentWidth - 18));
  const summaryHeight = 15 + summaryWrapped.reduce((sum, lines) => sum + lines.length * 4.2 + 2, 0);
  ensureSpace(summaryHeight + 5);
  pdf.setFillColor(...COLORS.blueLight);
  pdf.setDrawColor(191, 219, 254);
  pdf.roundedRect(MARGIN, y, contentWidth, summaryHeight, 2.5, 2.5, 'FD');
  pdf.setFillColor(...COLORS.blue);
  pdf.roundedRect(MARGIN, y, 2, summaryHeight, 1, 1, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.navy);
  pdf.text('AI summary', MARGIN + 6, y + 7);
  let bulletY = y + 13;
  summaryWrapped.forEach((lines) => {
    pdf.setFillColor(...COLORS.blue);
    pdf.circle(MARGIN + 7, bulletY - 1, 0.8, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.8);
    pdf.setTextColor(...COLORS.slate);
    drawLineSet(lines, MARGIN + 11, bulletY, 4.2);
    bulletY += lines.length * 4.2 + 2;
  });
  y += summaryHeight + 7;

  ensureSpace(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...COLORS.navy);
  pdf.text('Feedback requiring attention', MARGIN, y + 4);
  const countLabel = `${findings.length} flagged`;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  const pillWidth = pdf.getTextWidth(countLabel) + 8;
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(pageWidth - MARGIN - pillWidth, y - 2, pillWidth, 8, 3, 3, 'F');
  pdf.setTextColor(...COLORS.slate);
  pdf.text(countLabel, pageWidth - MARGIN - pillWidth + 4, y + 3.2);
  y += 12;

  if (!findings.length) {
    const emptyText = 'No feedback requiring attention was identified in this range. This is an AI-assisted review, not a guarantee that every issue was detected.';
    const emptyLines = wrappedLines(emptyText, contentWidth - 12, 9, 'normal');
    const height = 12 + emptyLines.length * LINE_HEIGHT;
    ensureSpace(height);
    pdf.setFillColor(...COLORS.greenLight);
    pdf.setDrawColor(167, 243, 208);
    pdf.roundedRect(MARGIN, y, contentWidth, height, 2.5, 2.5, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.green);
    drawLineSet(emptyLines, MARGIN + 6, y + 7, LINE_HEIGHT);
    y += height + 4;
  } else {
    findings.forEach((item, index) => {
      drawFindingHeading(item, index);
      drawInfoGrid(item);
      drawTextCard('Original feedback', item.feedback || 'No feedback text recorded', { fill: COLORS.white, accent: COLORS.rose });
      drawTwoColumnCards('Why it was flagged', item.reason || 'Human follow-up may be appropriate.', 'Suggested next step', item.suggestedAction || 'Review the feedback and decide whether to contact the client.');
      y += 3;
    });
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...COLORS.border);
    pdf.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.muted);
    pdf.text('Feedback - (Attention Required)  |  Confidential Admin review', MARGIN, pageHeight - 7);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 7, { align: 'right' });
  }

  pdf.save(`feedback-attention-required-${report?.startDate || 'range'}-to-${report?.endDate || 'range'}.pdf`);
}
