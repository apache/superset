/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { jsPDF } from 'jspdf';

export interface PdfTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface TablePdf {
  doc: jsPDF;
  shownRows: number;
  shownColumns: number;
}

/**
 * A table is cut to what fits legibly on this many A4 pages. The PDF is for
 * reading; CSV or Excel export carries the full data.
 */
export const PDF_MAX_PAGES = 5;
/** Most columns a table is read from, however wide the page. */
export const PDF_MAX_COLUMNS = 30;
/** Most rows a table is read from before the page limit applies. */
export const PDF_MAX_ROWS = 1000;

const MARGIN = 36;
const CELL_PADDING = 4;
const FONT_SIZES = [8, 7, 6];
const MIN_COLUMN_WIDTH = 36;
const MAX_COLUMN_WIDTH = 120;
const MAX_CELL_LINES = 3;
const MEASURED_ROWS = 100;
const WIDE_TABLE_COLUMNS = 6;

// A PDF is white paper, so these print colors are fixed grey levels (0-255) and
// do not follow the UI theme.
export const PDF_PRINT_GRAYS = {
  headerFill: 232,
  headerRule: 140,
  row: 255,
  stripeFill: 240,
  rowRule: 217,
  text: 38,
  muted: 140,
};

const NUMERIC = /^[-+]?[$€£]?[\d,]*\.?\d+%?$/;

// The built-in PDF fonts cover Latin-1 and a few typographic symbols only. Text
// outside that range would come out garbled, so such tables are not drawn here.
// Code points: space..~, no-break space..ÿ, – — ‘ ’ “ ” • … €.
const EXTRA_SUPPORTED = new Set([
  8211, 8212, 8216, 8217, 8220, 8221, 8226, 8230, 8364,
]);
const isSupportedChar = (char: string) => {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 32 && code <= 126) ||
    (code >= 160 && code <= 255) ||
    EXTRA_SUPPORTED.has(code)
  );
};
const isSupportedText = (text: string) => [...text].every(isSupportedChar);

export const canDrawInPdf = ({ headers, rows }: PdfTable) =>
  [...headers, ...rows.flat()].every(isSupportedText);

/**
 * Draws a table as real PDF content (sharp, selectable text) rather than a
 * picture of the on-screen table. The shown columns always fit the page width
 * (the font is reduced, then trailing columns are dropped if they still do not
 * fit), the header repeats on every page, rows are striped and ruled, and the
 * table stops at PDF_MAX_PAGES pages. The result says how much was shown.
 */
export default function buildTablePdf({
  title,
  headers,
  rows,
}: PdfTable): TablePdf {
  const doc = new jsPDF({
    orientation: headers.length > WIDE_TABLE_COLUMNS ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - 2 * MARGIN;
  const bodyBottom = pageHeight - MARGIN - 12;
  const topOfTable = MARGIN + 22;

  // Largest font at which every column fits; otherwise the smallest font and
  // as many leading columns as fit.
  let [fontSize] = FONT_SIZES;
  let widths: number[] = [];
  let naturalWidths: number[] = [];
  let shownColumns = 0;
  FONT_SIZES.some(size => {
    fontSize = size;
    doc.setFontSize(size);
    naturalWidths = headers.map((header, column) => {
      doc.setFont('helvetica', 'bold');
      let widest = doc.getTextWidth(header);
      doc.setFont('helvetica', 'normal');
      rows.slice(0, MEASURED_ROWS).forEach(row => {
        widest = Math.max(widest, doc.getTextWidth(row[column] ?? ''));
      });
      return Math.max(MIN_COLUMN_WIDTH, widest + 2 * CELL_PADDING);
    });
    // Long text wraps in a column capped at MAX_COLUMN_WIDTH; the cap decides
    // how many columns fit.
    widths = naturalWidths.map(width => Math.min(MAX_COLUMN_WIDTH, width));
    let total = 0;
    shownColumns = 0;
    while (
      shownColumns < widths.length &&
      total + widths[shownColumns] <= usableWidth
    ) {
      total += widths[shownColumns];
      shownColumns += 1;
    }
    return shownColumns === widths.length;
  });
  const total = (values: number[]) => values.reduce((sum, v) => sum + v, 0);
  if (shownColumns === 0) {
    // A single column wider than the page: squeeze it to the page.
    widths = [usableWidth];
    shownColumns = 1;
  } else {
    // Columns take their full text width when it fits (no wrapping), else the
    // capped width; either way the table then spreads to the page width.
    const full = naturalWidths.slice(0, shownColumns);
    const chosen =
      total(full) <= usableWidth ? full : widths.slice(0, shownColumns);
    const scale = usableWidth / total(chosen);
    widths = chosen.map(width => width * scale);
  }
  const columns = Array.from({ length: shownColumns }, (_, column) => column);
  const lineHeight = fontSize + 2;

  // A column of numbers is right-aligned, header included.
  const numericColumns = columns.map(
    column =>
      rows.length > 0 &&
      rows
        .slice(0, MEASURED_ROWS)
        .every(row => !row[column] || NUMERIC.test(row[column].trim())),
  );

  const wrap = (text: string, width: number) => {
    const lines: string[] = doc.splitTextToSize(text, width - 2 * CELL_PADDING);
    if (lines.length <= MAX_CELL_LINES) return lines;
    return [
      ...lines.slice(0, MAX_CELL_LINES - 1),
      `${lines[MAX_CELL_LINES - 1].slice(0, -1)}…`,
    ];
  };

  const layoutRow = (texts: string[], header: boolean) => {
    doc.setFont('helvetica', header ? 'bold' : 'normal');
    const cells = columns.map(column => ({
      width: widths[column],
      lines: wrap(texts[column] ?? '', widths[column]),
      numeric: numericColumns[column],
    }));
    const height =
      Math.max(...cells.map(cell => cell.lines.length)) * lineHeight +
      CELL_PADDING;
    return { cells, height };
  };

  const drawRow = (
    layout: ReturnType<typeof layoutRow>,
    y: number,
    options: { header?: boolean; striped?: boolean },
  ) => {
    const { cells, height } = layout;
    doc.setFont('helvetica', options.header ? 'bold' : 'normal');
    if (options.header || options.striped) {
      doc.setFillColor(
        options.header
          ? PDF_PRINT_GRAYS.headerFill
          : PDF_PRINT_GRAYS.stripeFill,
      );
      doc.rect(MARGIN, y, usableWidth, height, 'F');
    }
    doc.setDrawColor(
      options.header ? PDF_PRINT_GRAYS.headerRule : PDF_PRINT_GRAYS.rowRule,
    );
    doc.setLineWidth(options.header ? 1.2 : 0.4);
    doc.line(MARGIN, y + height, MARGIN + usableWidth, y + height);
    doc.setTextColor(PDF_PRINT_GRAYS.text);
    let x = MARGIN;
    cells.forEach(cell => {
      cell.lines.forEach((line, index) => {
        const textY = y + CELL_PADDING / 2 + index * lineHeight;
        if (cell.numeric) {
          doc.text(line, x + cell.width - CELL_PADDING, textY, {
            align: 'right',
            baseline: 'top',
          });
        } else {
          doc.text(line, x + CELL_PADDING, textY, { baseline: 'top' });
        }
      });
      x += cell.width;
    });
  };

  const startPage = (first: boolean) => {
    if (!first) doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(PDF_PRINT_GRAYS.text);
    doc.text(title, MARGIN, MARGIN, { baseline: 'top' });
    doc.setFontSize(fontSize);
  };

  startPage(true);
  const headerLayout = layoutRow(headers, true);
  let y = topOfTable;
  drawRow(headerLayout, y, { header: true });
  y += headerLayout.height;

  let shownRows = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const layout = layoutRow(rows[index], false);
    if (y + layout.height > bodyBottom) {
      if (doc.getNumberOfPages() >= PDF_MAX_PAGES) break;
      startPage(false);
      y = topOfTable;
      drawRow(headerLayout, y, { header: true });
      y += headerLayout.height;
    }
    drawRow(layout, y, { striped: index % 2 === 1 });
    y += layout.height;
    shownRows += 1;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(PDF_PRINT_GRAYS.muted);
    doc.text(
      `Page ${page} of ${pages}`,
      pageWidth - MARGIN,
      pageHeight - MARGIN,
      { align: 'right', baseline: 'bottom' },
    );
  }
  return { doc, shownRows, shownColumns };
}
