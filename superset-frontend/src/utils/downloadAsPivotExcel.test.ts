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
import type { WorkBook } from 'xlsx';
import exportPivotExcel from './downloadAsPivotExcel';

const mockWriteFile = jest.fn();

jest.mock('xlsx', () => {
  const actual = jest.requireActual('xlsx');
  return {
    ...actual,
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  };
});

test('preserves locale-formatted numbers exactly as rendered, without SheetJS reinterpreting them', () => {
  document.body.innerHTML = `
    <table id="pivot-table">
      <tbody>
        <tr>
          <td>1.234,56</td>
          <td>12,50%</td>
          <td>3.500</td>
        </tr>
      </tbody>
    </table>
  `;

  exportPivotExcel('#pivot-table', 'export');

  expect(mockWriteFile).toHaveBeenCalledTimes(1);
  const workbook = mockWriteFile.mock.calls[0][0] as WorkBook;
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // These are Spanish-locale D3_FORMAT strings ("." as thousands separator,
  // "," as decimal separator). Each must survive the export untouched, as a
  // text cell, rather than being silently reparsed as a different number
  // (SheetJS's default HTML table parsing would otherwise turn "1.234,56"
  // into the number 1.23456, "3.500" into 3.5, and "12,50%" into 12.5).
  expect(sheet.A1).toMatchObject({ t: 's', v: '1.234,56' });
  expect(sheet.B1).toMatchObject({ t: 's', v: '12,50%' });
  expect(sheet.C1).toMatchObject({ t: 's', v: '3.500' });
});

test('restores unambiguous plain numbers to native Excel numeric cells', () => {
  document.body.innerHTML = `
    <table id="pivot-table">
      <tbody>
        <tr>
          <td>42</td>
          <td>-3.5</td>
          <td>3.500</td>
          <td>1,234</td>
        </tr>
      </tbody>
    </table>
  `;

  exportPivotExcel('#pivot-table', 'export');

  const workbook = mockWriteFile.mock.calls.at(-1)?.[0] as WorkBook;
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // "42" and "-3.5" round-trip exactly through Number(), so they're
  // unambiguous under any locale and are restored to real numbers.
  expect(sheet.A1).toMatchObject({ t: 'n', v: 42 });
  expect(sheet.B1).toMatchObject({ t: 'n', v: -3.5 });
  // "3.500" (trailing zero padding) and "1,234" (grouped thousands) don't
  // round-trip, so they stay as text rather than risk misparsing them.
  expect(sheet.C1).toMatchObject({ t: 's', v: '3.500' });
  expect(sheet.D1).toMatchObject({ t: 's', v: '1,234' });
});
