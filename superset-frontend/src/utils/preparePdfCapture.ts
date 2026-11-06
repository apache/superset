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
import { t } from '@apache-superset/core/translation';
import { PDF_PRINT_GRAYS } from './tableToPdf';

/**
 * Upper bounds for a table in a PDF export. The PDF is a raster capture, so a
 * table with thousands of rows or columns would exceed the browser's canvas
 * limits (and be unreadable on an A4 page). Anything beyond the bounds is left
 * out and the user is warned; CSV/Excel export carries the full data.
 */
export const PDF_EXPORT_MAX_ROWS = 200;
export const PDF_EXPORT_MAX_COLUMNS = 30;

type Shown = [shown: number, total: number];

/** Warning for the user when a table was cut to the PDF bounds, else null. */
export const truncationWarning = (
  rows: Shown | null,
  columns: Shown | null,
): string | null => {
  if (rows && columns) {
    return t(
      'The PDF shows %s of %s rows and %s of %s columns. Use CSV or Excel export to get all the data.',
      rows[0],
      rows[1],
      columns[0],
      columns[1],
    );
  }
  if (rows) {
    return t(
      'The PDF shows %s of %s rows. Use CSV or Excel export to get all the data.',
      rows[0],
      rows[1],
    );
  }
  if (columns) {
    return t(
      'The PDF shows %s of %s columns. Use CSV or Excel export to get all the data.',
      columns[0],
      columns[1],
    );
  }
  return null;
};

const gray = (level: number) => `rgb(${level}, ${level}, ${level})`;

const clips = (element: HTMLElement) => {
  // Shorthand and longhands are both read: browsers resolve the longhands, jsdom
  // only echoes whichever form was specified.
  const { overflow, overflowX, overflowY } = window.getComputedStyle(element);
  return /auto|scroll|hidden|clip/.test(
    `${overflow} ${overflowX} ${overflowY}`,
  );
};

const hasHiddenContent = (element: HTMLElement) =>
  element.scrollHeight > element.clientHeight ||
  element.scrollWidth > element.clientWidth;

const hasSpans = (table: HTMLTableElement) =>
  Array.from(table.querySelectorAll('td, th')).some(
    cell =>
      (cell as HTMLTableCellElement).colSpan > 1 ||
      (cell as HTMLTableCellElement).rowSpan > 1,
  );

/**
 * Makes the clipped parts of `root` visible and caps its tables, so the PDF
 * capture sees what a reader would scroll through instead of the visible window.
 *
 * The capture clones the DOM synchronously, so the changes are applied to the
 * live elements only for that moment. Call `restore` right after the capture
 * has started to put every element back exactly as it was. `warning` is set when
 * a table was cut to the bounds, to be shown to the user.
 */
export default function preparePdfCapture(
  root: HTMLElement,
  maxRows = PDF_EXPORT_MAX_ROWS,
  maxColumns = PDF_EXPORT_MAX_COLUMNS,
): { restore: () => void; warning: string | null } {
  const savedStyles = new Map<HTMLElement, string | null>();
  let warning: string | null = null;

  const setStyle = (element: HTMLElement, rules: Record<string, string>) => {
    if (!savedStyles.has(element)) {
      savedStyles.set(element, element.getAttribute('style'));
    }
    Object.entries(rules).forEach(([property, value]) =>
      element.style.setProperty(property, value, 'important'),
    );
  };

  // 1. Clipped scroll areas (a table's own scroll box, a tile that hides overflow),
  // and every ancestor up to the root: once a scroll box grows to its full height,
  // a parent with a fixed height and hidden overflow would clip it again.
  const open = {
    overflow: 'visible',
    height: 'auto',
    'max-height': 'none',
  };
  [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    .filter(element => clips(element) && hasHiddenContent(element))
    .forEach(element => {
      setStyle(element, open);
      for (
        let parent = element.parentElement;
        parent && parent !== root.parentElement;
        parent = parent.parentElement
      ) {
        setStyle(parent, open);
      }
    });

  // 2. Bounds on table size; the first bounded table with rows sets the warning.
  root.querySelectorAll('table').forEach(table => {
    const bodyRows = Array.from(table.tBodies).flatMap(body =>
      Array.from(body.rows),
    );
    const allRows = Array.from(table.rows);
    const totalColumns = allRows[0]?.cells.length ?? 0;
    const limitColumns = totalColumns > maxColumns && !hasSpans(table);
    const limitRows = bodyRows.length > maxRows;
    if (!limitRows && !limitColumns) return;

    if (limitRows) {
      bodyRows
        .slice(maxRows)
        .forEach(row => setStyle(row, { display: 'none' }));
    }
    if (limitColumns) {
      allRows.forEach(row =>
        Array.from(row.cells)
          .slice(maxColumns)
          .forEach(cell => setStyle(cell, { display: 'none' })),
      );
      // A fixed-layout table sizes itself from its <col> widths, not its cells.
      Array.from(table.querySelectorAll('col'))
        .slice(maxColumns)
        .forEach(col => setStyle(col as HTMLElement, { display: 'none' }));
      setStyle(table, { width: 'auto' });
    }

    // A header-only table (sticky header split from the body) is bounded too,
    // but the warning describes the table that has the rows.
    if (bodyRows.length === 0 || warning) return;

    warning = truncationWarning(
      limitRows ? [Math.min(maxRows, bodyRows.length), bodyRows.length] : null,
      limitColumns ? [maxColumns, totalColumns] : null,
    );
  });

  // 3. Print-friendly table styling: the on-screen striping is too faint on paper.
  // Only background-color and bottom borders are set, so cell bars (gradients) and
  // conditional-format colors keep showing.
  root.querySelectorAll('table').forEach(table => {
    table.querySelectorAll<HTMLElement>('thead th').forEach(header =>
      setStyle(header, {
        'font-weight': '600',
        'background-color': gray(PDF_PRINT_GRAYS.headerFill),
        'border-bottom': `2px solid ${gray(PDF_PRINT_GRAYS.headerRule)}`,
      }),
    );
    Array.from(table.tBodies)
      .flatMap(body => Array.from(body.rows))
      .slice(0, maxRows)
      .forEach((row, index) =>
        Array.from(row.cells).forEach(cell =>
          setStyle(cell, {
            'background-color':
              index % 2 === 0
                ? gray(PDF_PRINT_GRAYS.row)
                : gray(PDF_PRINT_GRAYS.stripeFill),
            'border-bottom': `1px solid ${gray(PDF_PRINT_GRAYS.rowRule)}`,
          }),
        ),
      );
  });

  const restore = () =>
    savedStyles.forEach((style, element) => {
      if (style === null) {
        element.removeAttribute('style');
      } else {
        element.setAttribute('style', style);
      }
    });

  return { restore, warning };
}
