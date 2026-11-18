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
import { PDF_MAX_COLUMNS, PDF_MAX_ROWS, type PdfTable } from './tableToPdf';

export interface ExtractedTable {
  table: PdfTable;
  totalRows: number;
  totalColumns: number;
}

const textOf = (cell: Element) => (cell.textContent ?? '').trim();

/**
 * Reads the single table of a table chart from the page: its header and body
 * text, up to the most the PDF reads (the PDF itself then fits what it can on
 * its pages). Returns null when `root` is not a plain table
 * chart (a dashboard, a chart with a canvas, several tables, merged cells), so
 * the caller can use the picture-based export instead.
 */
export default function extractPdfTable(
  root: HTMLElement,
  title: string,
  maxRows = PDF_MAX_ROWS,
  maxColumns = PDF_MAX_COLUMNS,
): ExtractedTable | null {
  if (root.classList.contains('dashboard') || root.querySelector('canvas')) {
    return null;
  }
  const tables = Array.from(root.querySelectorAll('table'));
  const bodyTables = tables.filter(table =>
    Array.from(table.tBodies).some(body => body.rows.length > 0),
  );
  if (bodyTables.length !== 1) return null;
  const [bodyTable] = bodyTables;
  if (
    tables.some(table =>
      Array.from(table.querySelectorAll('td, th')).some(
        cell =>
          (cell as HTMLTableCellElement).colSpan > 1 ||
          (cell as HTMLTableCellElement).rowSpan > 1,
      ),
    )
  ) {
    return null;
  }

  const headerRow = tables
    .map(table => table.tHead?.rows[0])
    .find((row): row is HTMLTableRowElement => !!row);
  const bodyRows = Array.from(bodyTable.tBodies).flatMap(body =>
    Array.from(body.rows),
  );
  const totalColumns = bodyRows[0].cells.length;
  const headers = headerRow ? Array.from(headerRow.cells).map(textOf) : [];
  if (headers.length !== totalColumns) return null;

  return {
    table: {
      title,
      headers: headers.slice(0, maxColumns),
      rows: bodyRows
        .slice(0, maxRows)
        .map(row => Array.from(row.cells).slice(0, maxColumns).map(textOf)),
    },
    totalRows: bodyRows.length,
    totalColumns,
  };
}
