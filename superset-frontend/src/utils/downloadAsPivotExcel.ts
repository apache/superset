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
import { utils, writeFile } from 'xlsx';
import type { WorkSheet } from 'xlsx';

// ISO 8601 date (and optional time) form, e.g. "2024-01-01" or
// "2024-01-01 00:00:00". This layout is unambiguous under any locale
// (unlike "1/2/2024", which means different dates depending on the
// reader), so it's safe to restore as a native Excel date.
const ISO_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/;

// `raw: true` (used below) keeps every table cell as text, so ordinary
// numbers and dates lose their native Excel type along with the
// locale-formatted values. A cell's text is only restored to a real number
// or date when it is unambiguous under any locale: a plain number that
// round-trips losslessly through Number() (e.g. "42" or "-3.5"), or an
// ISO 8601 date/datetime string. Restoring those can't reintroduce the
// misparsing raw: true guards against. Anything else (grouped thousands,
// percent suffixes, trailing zero padding, other D3_FORMAT output, etc.)
// stays as text, exactly as rendered.
function restoreUnambiguousNumbers(sheet: WorkSheet): void {
  Object.keys(sheet).forEach(cellRef => {
    if (cellRef.startsWith('!')) {
      return;
    }
    const cell = sheet[cellRef];
    if (!cell || cell.t !== 's' || typeof cell.v !== 'string') {
      return;
    }
    const isoMatch = cell.v.match(ISO_DATE_RE);
    if (isoMatch) {
      const [y, mo, d, h, mi, s] = isoMatch
        .slice(1)
        .map(part => Number(part ?? 0));
      const date = new Date(y, mo - 1, d, h, mi, s);
      // The Date constructor rolls invalid components over into the next
      // month/day (e.g. day 40 becomes the 10th of the following month)
      // instead of rejecting them, so confirm the parts round-trip before
      // trusting the result.
      const isValid =
        date.getFullYear() === y &&
        date.getMonth() === mo - 1 &&
        date.getDate() === d;
      if (isValid) {
        cell.t = 'd';
        cell.v = date;
        return;
      }
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
