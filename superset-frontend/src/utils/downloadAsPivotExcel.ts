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

// `raw: true` (used below) keeps every table cell as text, so ordinary
// numbers lose their native Excel numeric type along with the
// locale-formatted ones. A cell's text is only restored to a real number
// when it round-trips losslessly through Number() (e.g. "42" or "-3.5"):
// that guarantees it's a plain, unambiguous number under any locale, so
// restoring it can't reintroduce the misparsing raw: true guards against.
// Anything that doesn't round-trip (grouped thousands, percent suffixes,
// trailing zero padding, other D3_FORMAT output, etc.) stays as text,
// exactly as rendered.
function restoreUnambiguousNumbers(sheet: WorkSheet): void {
  Object.keys(sheet).forEach(cellRef => {
    if (cellRef.startsWith('!')) {
      return;
    }
    const cell = sheet[cellRef];
    if (!cell || cell.t !== 's' || typeof cell.v !== 'string') {
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
