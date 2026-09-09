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
import { getNumberFormatterRegistry } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { utils, writeFile } from 'xlsx';
import type { WorkSheet } from 'xlsx';

// `raw: true` (used below) keeps every table cell as text, so ordinary
// numbers lose their native Excel type along with the locale-formatted
// values. A cell's text is only restored to a real number when it is
// unambiguous under the active D3_FORMAT locale: a plain number that
// round-trips losslessly through Number() (e.g. "42" or "-3.5"). Restoring
// those can't reintroduce the misparsing raw: true guards against. Anything
// else (grouped thousands, percent suffixes, trailing zero padding,
// date-shaped text, other D3_FORMAT output, etc.) stays as text, exactly as
// rendered: a rendered string can't be reliably classified as a genuine date
// rather than a coincidentally date-shaped formatted number (e.g. a custom
// D3_FORMAT grouping/thousands locale can render a plain metric like
// 20240101 as "2024-01-01"), so cells are never reinterpreted as dates.
//
// Number()'s round-trip check assumes "." is a decimal point, which isn't
// true under every locale: a Spanish D3_FORMAT (thousands: '.') renders the
// plain integer 1234 as "1.234", which also round-trips through Number() as
// the decimal 1.234. When the active locale uses "." as its thousands
// separator, a cell containing "." can't be trusted as an unambiguous
// decimal, so it's left as text instead.
function restoreUnambiguousNumbers(sheet: WorkSheet): void {
  const { thousands } = getNumberFormatterRegistry().d3Format;
  Object.keys(sheet).forEach(cellRef => {
    if (cellRef.startsWith('!')) {
      return;
    }
    const cell = sheet[cellRef];
    if (!cell || cell.t !== 's' || typeof cell.v !== 'string') {
      return;
    }
    if (thousands === '.' && cell.v.includes('.')) {
      return;
    }
    const value = Number(cell.v);
    if (cell.v !== '' && Number.isFinite(value) && String(value) === cell.v) {
      cell.t = 'n';
      cell.v = value;
    }
  });
}

export default function exportPivotExcel(
  tableSelector: string,
  fileName: string,
) {
  const table = document.querySelector(tableSelector);
  if (!table) {
    logging.error(
      `[exportPivotExcel] No element found for selector: "${tableSelector}"`,
    );
    return;
  }
  // `raw: true` keeps every cell as the literal text rendered in the DOM.
  // Without it, SheetJS tries to infer numbers/dates from the displayed
  // string, which mangles values that were formatted using a non-US
  // D3_FORMAT (e.g. "1.234,56" gets misread as a date or truncated number).
  const workbook = utils.table_to_book(table, { raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (sheet) {
    restoreUnambiguousNumbers(sheet);
  }
  writeFile(workbook, `${fileName}.xlsx`);
}
