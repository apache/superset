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
import { getNumberFormatterRegistry } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import exportPivotExcel from './downloadAsPivotExcel';

const mockWriteFile = jest.fn();

jest.mock('xlsx', () => {
  const actual = jest.requireActual('xlsx');
  return {
    ...actual,
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  };
});

jest.mock('@apache-superset/core/utils', () => ({
  logging: { error: jest.fn() },
}));

afterEach(() => {
  jest.restoreAllMocks();
});

// Renders a single-row pivot table with the given cell values, runs the
// export, and returns the resulting sheet so each test only has to state
// its input cells and assertions.
function exportRowAndGetSheet(cells: string[]): WorkBook['Sheets'][string] {
  document.body.innerHTML = `
    <table id="pivot-table">
      <tbody>
        <tr>
          ${cells.map(cell => `<td>${cell}</td>`).join('\n          ')}
        </tr>
      </tbody>
    </table>
  `;

  exportPivotExcel('#pivot-table', 'export');

  const workbook = mockWriteFile.mock.calls.at(-1)?.[0] as WorkBook;
  return workbook.Sheets[workbook.SheetNames[0]];
}

test('preserves locale-formatted numbers exactly as rendered, without SheetJS reinterpreting them', () => {
  const sheet = exportRowAndGetSheet(['1.234,56', '12,50%', '3.500']);

  expect(mockWriteFile).toHaveBeenCalledTimes(1);

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
  const sheet = exportRowAndGetSheet(['42', '-3.5', '3.500', '1,234']);

  // "42" and "-3.5" round-trip exactly through Number(), so they're
  // unambiguous under any locale and are restored to real numbers.
  expect(sheet.A1).toMatchObject({ t: 'n', v: 42 });
  expect(sheet.B1).toMatchObject({ t: 'n', v: -3.5 });
  // "3.500" (trailing zero padding) and "1,234" (grouped thousands) don't
  // round-trip, so they stay as text rather than risk misparsing them.
  expect(sheet.C1).toMatchObject({ t: 's', v: '3.500' });
  expect(sheet.D1).toMatchObject({ t: 's', v: '1,234' });
});

test('does not restore grouped-thousands numbers under a "." thousands-separator locale', () => {
  const registry = getNumberFormatterRegistry();
  const original = registry.d3Format;
  registry.setD3Format({ decimal: ',', thousands: '.', grouping: [3] });

  try {
    // Under a Spanish-style D3_FORMAT, "1.234" is the plain integer 1234
    // rendered with a "." group separator, not the decimal 1.234. It also
    // round-trips cleanly through Number(), so without the locale check it
    // would be misrestored to the number 1.234, silently corrupting the
    // value this PR exists to preserve. "42" has no "." and still round
    // trips safely, so it's still restored.
    const sheet = exportRowAndGetSheet(['1.234', '42']);
    expect(sheet.A1).toMatchObject({ t: 's', v: '1.234' });
    expect(sheet.B1).toMatchObject({ t: 'n', v: 42 });
  } finally {
    registry.setD3Format(original);
  }
});

test('leaves date-shaped strings as text rather than reinterpreting them as dates', () => {
  const sheet = exportRowAndGetSheet([
    '2024-01-01',
    '2024-01-01 13:45:30',
    'not-a-date',
  ]);

  // A rendered string can't be reliably classified as a genuine date rather
  // than a coincidentally date-shaped formatted number (e.g. a custom
  // D3_FORMAT grouping/thousands locale can render a plain metric like
  // 20240101 as "2024-01-01"), so date-shaped cells are left exactly as
  // rendered instead of being reinterpreted as native Excel dates.
  expect(sheet.A1).toMatchObject({ t: 's', v: '2024-01-01' });
  expect(sheet.B1).toMatchObject({ t: 's', v: '2024-01-01 13:45:30' });
  expect(sheet.C1).toMatchObject({ t: 's', v: 'not-a-date' });
});

test('should log an error and return early when table element is not found', () => {
  jest.spyOn(document, 'querySelector').mockReturnValue(null);

  exportPivotExcel('.non-existent-selector', 'test-file');

  expect(logging.error as jest.Mock).toHaveBeenCalledWith(
    '[exportPivotExcel] No element found for selector: ".non-existent-selector"',
  );
});
