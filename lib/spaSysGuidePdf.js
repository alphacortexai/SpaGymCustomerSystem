import { jsPDF } from 'jspdf';
import { SPA_SYS_GUIDE } from './spaSysGuide.js';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 14;
const MARGIN_TOP = 12;
const CONTENT_BOTTOM = 279;
const CARD_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CARD_PAD = 6;
const INNER_WIDTH = CARD_WIDTH - CARD_PAD * 2;
const BLOCK_GAP = 3.6;
const CARD_GAP = 5;
const HEADING_HEIGHT = 9;

const COLOR = {
  canvas: [248, 250, 252],
  white: [255, 255, 255],
  ink: [15, 23, 42],
  body: [71, 85, 105],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  blue: [37, 99, 235],
  amberFill: [255, 251, 235],
  amberLine: [253, 230, 138],
  amberInk: [120, 53, 15],
  codeFill: [2, 6, 23],
  codeInk: [241, 245, 249],
  tableInk: [51, 65, 85],
  shadow: [226, 232, 240],
};

const safe = (value) => String(value ?? '')
  .replace(/[–—]/g, '-')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '');

function hardWrap(pdf, text, maxWidth) {
  const pieces = pdf.splitTextToSize(safe(text), maxWidth);
  const lines = [];
  pieces.forEach((piece) => {
    if (!piece) {
      lines.push('');
      return;
    }
    if (pdf.getTextWidth(piece) <= maxWidth + 0.15) {
      lines.push(piece);
      return;
    }
    let chunk = '';
    for (const character of piece) {
      const next = chunk + character;
      if (chunk && pdf.getTextWidth(next) > maxWidth) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = next;
      }
    }
    if (chunk) lines.push(chunk);
  });
  return lines.length ? lines : [''];
}

function textBlock(pdf, text, { size = 10, style = 'normal', color = COLOR.body, width = INNER_WIDTH, lineHeight = 5 } = {}) {
  pdf.setFont('helvetica', style);
  pdf.setFontSize(size);
  const lines = hardWrap(pdf, text, width);
  return {
    height: lines.length * lineHeight,
    lines,
    draw(x, y) {
      pdf.setFont('helvetica', style);
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      lines.forEach((line, index) => pdf.text(line, x, y + size * 0.36 + index * lineHeight));
    },
  };
}

function noteBlock(pdf, text) {
  const inner = INNER_WIDTH - 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const lines = hardWrap(pdf, text, inner);
  const lineHeight = 4.8;
  const height = lines.length * lineHeight + 7;
  return {
    height,
    draw(x, y) {
      pdf.setFillColor(...COLOR.amberFill);
      pdf.setDrawColor(...COLOR.amberLine);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, y, INNER_WIDTH, height, 2.2, 2.2, 'FD');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...COLOR.amberInk);
      lines.forEach((line, index) => pdf.text(line, x + 4, y + 5 + index * lineHeight));
    },
  };
}

function codeBlock(pdf, text) {
  const inner = INNER_WIDTH - 8;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8);
  const lines = String(text || '').split('\n').flatMap((line) => hardWrap(pdf, line || ' ', inner));
  const lineHeight = 3.8;
  const height = lines.length * lineHeight + 7;
  return {
    height,
    lines,
    lineHeight,
    draw(x, y, drawLines = lines) {
      const boxHeight = drawLines.length * lineHeight + 7;
      pdf.setFillColor(...COLOR.codeFill);
      pdf.roundedRect(x, y, INNER_WIDTH, boxHeight, 2.2, 2.2, 'F');
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...COLOR.codeInk);
      drawLines.forEach((line, index) => pdf.text(line, x + 4, y + 5 + index * lineHeight));
    },
    split(maxHeight) {
      const capacity = Math.max(1, Math.floor((maxHeight - 7) / lineHeight));
      const pieces = [];
      for (let index = 0; index < lines.length; index += capacity) {
        const slice = lines.slice(index, index + capacity);
        const box = codeBlock(pdf, slice.join('\n'));
        pieces.push(box);
      }
      return pieces;
    },
  };
}

function listBlock(pdf, item, index, kind) {
  const prefixWidth = kind === 'steps' ? 7 : 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const lines = hardWrap(pdf, item, INNER_WIDTH - prefixWidth);
  const lineHeight = 4.8;
  return {
    height: lines.length * lineHeight,
    gapBefore: 1.3,
    draw(x, y) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...COLOR.body);
      if (kind === 'steps') {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${index + 1}.`, x, y + 3.6);
        pdf.setFont('helvetica', 'normal');
      } else {
        pdf.setFillColor(...COLOR.body);
        pdf.circle(x + 1.1, y + 2.5, 0.65, 'F');
      }
      lines.forEach((line, lineIndex) => pdf.text(line, x + prefixWidth, y + 3.6 + lineIndex * lineHeight));
    },
  };
}

function columnWidths(count) {
  if (count === 2) return [58, INNER_WIDTH - 58];
  if (count === 3) return [16, 46, INNER_WIDTH - 62];
  const share = INNER_WIDTH / count;
  return Array.from({ length: count }, () => share);
}

function tableRow(pdf, cells, widths, header) {
  pdf.setFont('helvetica', header ? 'bold' : 'normal');
  pdf.setFontSize(8);
  const wrapped = cells.map((cell, index) => hardWrap(pdf, cell, widths[index] - 4));
  const lineCount = Math.max(...wrapped.map((lines) => lines.length));
  const height = Math.max(7.4, lineCount * 3.7 + 3);
  return { wrapped, height, header };
}

function drawTable(pdf, x, y, widths, rows) {
  const height = rows.reduce((sum, row) => sum + row.height, 0);
  const header = rows[0];
  pdf.setFillColor(...COLOR.white);
  pdf.roundedRect(x, y, INNER_WIDTH, height, 2, 2, 'F');
  pdf.setFillColor(...COLOR.ink);
  pdf.roundedRect(x, y, INNER_WIDTH, header.height, 2, 2, 'F');
  if (header.height > 2) pdf.rect(x, y + header.height - 2, INNER_WIDTH, 2, 'F');

  let cursor = y;
  rows.forEach((row, rowIndex) => {
    pdf.setFont('helvetica', row.header ? 'bold' : 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...(row.header ? COLOR.white : COLOR.tableInk));
    row.wrapped.forEach((lines, index) => {
      const cellX = x + widths.slice(0, index).reduce((sum, width) => sum + width, 0);
      lines.forEach((line, lineIndex) => pdf.text(line, cellX + 2, cursor + 4.3 + lineIndex * 3.7));
    });
    cursor += row.height;
    if (!row.header && rowIndex < rows.length - 1) {
      pdf.setDrawColor(...COLOR.line);
      pdf.setLineWidth(0.2);
      pdf.line(x + 2, cursor, x + INNER_WIDTH - 2, cursor);
    }
  });
  pdf.setDrawColor(...COLOR.line);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, INNER_WIDTH, height, 2, 2, 'S');
}

function tableBlock(pdf, block) {
  const widths = columnWidths(block.columns.length);
  const header = tableRow(pdf, block.columns, widths, true);
  const rows = block.rows.map((row) => tableRow(pdf, row, widths, false));
  const height = header.height + rows.reduce((sum, row) => sum + row.height, 0);
  const build = (bodyRows) => {
    const allRows = [header, ...bodyRows];
    return {
      height: allRows.reduce((sum, row) => sum + row.height, 0),
      draw(x, y) {
        drawTable(pdf, x, y, widths, allRows);
      },
    };
  };
  return {
    height,
    draw(x, y) {
      drawTable(pdf, x, y, widths, [header, ...rows]);
    },
    split(maxHeight) {
      const pieces = [];
      let body = [];
      let used = header.height;
      const flush = () => {
        if (!body.length) return;
        pieces.push(build(body));
        body = [];
        used = header.height;
      };
      rows.forEach((row) => {
        if (body.length && used + row.height > maxHeight) flush();
        body.push(row);
        used += row.height;
      });
      flush();
      return pieces;
    },
  };
}

function blocksFor(pdf, block) {
  if (block.type === 'paragraph') return [textBlock(pdf, block.text)];
  if (block.type === 'note') return [noteBlock(pdf, block.text)];
  if (block.type === 'code') return [codeBlock(pdf, block.text)];
  if (block.type === 'bullets' || block.type === 'steps') {
    return block.items.map((item, index) => listBlock(pdf, item, index, block.type));
  }
  if (block.type === 'table') return [tableBlock(pdf, block)];
  return [];
}

function chunkHeight(blocks) {
  const content = blocks.reduce((sum, block, index) => sum + block.height + (index ? (block.gapBefore ?? BLOCK_GAP) : 0), 0);
  return CARD_PAD + HEADING_HEIGHT + content + CARD_PAD;
}

function pageRoom() {
  return CONTENT_BOTTOM - MARGIN_TOP;
}

function packSection(pdf, section) {
  const blocks = section.blocks.flatMap((block) => blocksFor(pdf, block));
  const whole = chunkHeight(blocks);
  if (whole <= pageRoom()) return [{ heading: section.heading, continued: false, blocks }];

  const room = pageRoom() - CARD_PAD * 2 - HEADING_HEIGHT;
  const chunks = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    chunks.push(current);
    current = [];
  };
  const used = () => current.reduce((sum, block, index) => sum + block.height + (index ? (block.gapBefore ?? BLOCK_GAP) : 0), 0);
  blocks.forEach((block) => {
    const gap = current.length ? (block.gapBefore ?? BLOCK_GAP) : 0;
    if (block.height <= room && used() + gap + block.height > room) flush();
    if (block.height <= room) {
      current.push(block);
      return;
    }
    flush();
    const pieces = block.split ? block.split(room) : [block];
    pieces.forEach((piece) => {
      const pieceGap = current.length ? (piece.gapBefore ?? BLOCK_GAP) : 0;
      if (current.length && used() + pieceGap + piece.height > room) flush();
      current.push(piece);
    });
  });
  flush();
  return chunks.map((slice, index) => ({
    heading: section.heading,
    continued: index > 0,
    blocks: slice,
  }));
}

function drawChunk(pdf, chunk, y) {
  const height = chunkHeight(chunk.blocks);
  pdf.setFillColor(...COLOR.shadow);
  pdf.roundedRect(MARGIN_X + 0.4, y + 0.6, CARD_WIDTH, height, 3.2, 3.2, 'F');
  pdf.setFillColor(...COLOR.white);
  pdf.setDrawColor(...COLOR.line);
  pdf.setLineWidth(0.35);
  pdf.roundedRect(MARGIN_X, y, CARD_WIDTH, height, 3.2, 3.2, 'FD');

  const innerX = MARGIN_X + CARD_PAD;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(...COLOR.ink);
  const heading = chunk.continued ? `${chunk.heading} (continued)` : chunk.heading;
  pdf.text(safe(heading), innerX, y + CARD_PAD + 5);

  let cursor = y + CARD_PAD + HEADING_HEIGHT;
  chunk.blocks.forEach((block, index) => {
    if (index) cursor += block.gapBefore ?? BLOCK_GAP;
    block.draw(innerX, cursor);
    cursor += block.height;
  });
  return height;
}

function baseSentence(guide) {
  const origin = guide.origin ? String(guide.origin).replace(/\/$/, '') : '';
  const base = origin ? `${origin}${guide.basePath}` : guide.basePath;
  return `${guide.subtitle}. This copy uses ${base}.`;
}

export function generateSpaSysGuidePdf(guide = SPA_SYS_GUIDE) {
  const source = {
    ...SPA_SYS_GUIDE,
    ...guide,
    sections: guide?.sections || SPA_SYS_GUIDE.sections,
  };
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  pdf.setProperties({
    title: 'SPA_SYS_API_V1',
    subject: source.subtitle,
    author: 'SpaGym',
    creator: 'SpaGym Customer System',
  });

  const paint = () => {
    pdf.setFillColor(...COLOR.canvas);
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
  };
  paint();

  const introText = textBlock(pdf, baseSentence(source), { size: 10, color: COLOR.muted, lineHeight: 4.8 });
  const intro = {
    heading: '',
    continued: false,
    blocks: [],
    customHeight: CARD_PAD + 6 + 8 + introText.height + CARD_PAD,
    draw(y) {
      const height = this.customHeight;
      pdf.setFillColor(...COLOR.shadow);
      pdf.roundedRect(MARGIN_X + 0.4, y + 0.6, CARD_WIDTH, height, 3.2, 3.2, 'F');
      pdf.setFillColor(...COLOR.white);
      pdf.setDrawColor(...COLOR.line);
      pdf.setLineWidth(0.35);
      pdf.roundedRect(MARGIN_X, y, CARD_WIDTH, height, 3.2, 3.2, 'FD');
      const x = MARGIN_X + CARD_PAD;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...COLOR.blue);
      pdf.text('ADMIN   ·   SPA_SYS_API_V1', x, y + CARD_PAD + 3);
      pdf.setFontSize(16);
      pdf.setTextColor(...COLOR.ink);
      pdf.text(safe(source.title), x, y + CARD_PAD + 11);
      introText.draw(x, y + CARD_PAD + 15);
      return height;
    },
  };

  const chunks = [intro, ...source.sections.flatMap((section) => packSection(pdf, section))];
  let y = MARGIN_TOP;
  const placed = [];
  chunks.forEach((chunk) => {
    const height = chunk.customHeight || chunkHeight(chunk.blocks);
    if (y + height > CONTENT_BOTTOM) {
      pdf.addPage();
      paint();
      y = MARGIN_TOP;
    }
    const drawn = chunk.customHeight ? chunk.draw(y) : drawChunk(pdf, chunk, y);
    placed.push({
      page: pdf.internal.getNumberOfPages(),
      heading: chunk.heading,
      y,
      bottom: y + drawn,
    });
    y += drawn + CARD_GAP;
  });

  const overflowing = placed.filter((item) => item.bottom > CONTENT_BOTTOM + 0.2);
  if (overflowing.length) {
    throw new Error('SPA_SYS_API_V1 guide spilled past the page.');
  }

  const pages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLOR.muted);
    pdf.text(`SPA_SYS_API_V1 documentation   ·   ${page} of ${pages}`, PAGE_WIDTH / 2, 289, { align: 'center' });
  }

  const sectionPages = {};
  placed.forEach((item) => {
    if (!item.heading) return;
    const key = item.heading.replace(/ \(continued\)$/, '');
    sectionPages[key] = sectionPages[key] || [];
    sectionPages[key].push(item.page);
  });
  pdf.guideLayout = {
    maxBottom: Math.max(...placed.map((item) => item.bottom)),
    limitBottom: CONTENT_BOTTOM,
    sectionPages,
  };
  return pdf;
}
