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
import { SyntheticEvent } from 'react';
import downloadAsPdf from './downloadAsPdf';
import { forceLoadAllCharts } from './downloadUtils';
import buildTablePdf, { canDrawInPdf } from './tableToPdf';

jest.mock('dom-to-pdf', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ common: { pdf_compression_level: 'NONE' } })),
}));

jest.mock('@apache-superset/core/translation', () => ({
  t: (str: string) => str,
}));

jest.mock('@apache-superset/core/utils', () => ({
  logging: { error: jest.fn() },
}));

jest.mock('./tableToPdf', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    doc: { save: jest.fn() },
    shownRows: 5,
    shownColumns: 1,
  })),
  canDrawInPdf: jest.fn(() => true),
  PDF_MAX_ROWS: 1000,
  PDF_MAX_COLUMNS: 30,
  PDF_PRINT_GRAYS: jest.requireActual('./tableToPdf').PDF_PRINT_GRAYS,
}));

jest.mock('./downloadUtils', () => ({
  forceLoadAllCharts: jest.fn().mockResolvedValue(false),
  restoreVirtualization: jest.fn(),
}));

afterEach(() => {
  jest.restoreAllMocks();
  // `restoreAllMocks` only restores `jest.spyOn` spies; `domToPdf` is a
  // module mock, so a per-test `mockRejectedValue`/`mockResolvedValue`
  // would otherwise leak into later tests. Reset it explicitly.
  (jest.requireMock('dom-to-pdf').default as jest.Mock).mockReset();
});

test('warns the user via the bound toast callback and returns early when the target element is not found', async () => {
  jest.spyOn(document, 'querySelector').mockReturnValue(null);
  const addWarningToast = jest.fn();
  const domToPdf = jest.requireMock('dom-to-pdf').default as jest.Mock;

  await downloadAsPdf(
    '.non-existent-selector',
    'test-file',
    true,
    addWarningToast,
  )({} as SyntheticEvent);

  // Passed in already bound to dispatch (e.g. via `useToasts()`), so calling
  // it directly is what actually renders the toast -- unlike the raw action
  // creator, which only builds a Redux action object.
  expect(addWarningToast).toHaveBeenCalledWith(
    'PDF download failed, please refresh and try again.',
  );
  expect(domToPdf).not.toHaveBeenCalled();
});

test('does not throw when the target element is not found and no toast callback is provided', async () => {
  jest.spyOn(document, 'querySelector').mockReturnValue(null);

  await expect(
    downloadAsPdf(
      '.non-existent-selector',
      'test-file',
      true,
    )({} as SyntheticEvent),
  ).resolves.toBeUndefined();
});

test('warns the user via the bound toast callback when PDF generation fails', async () => {
  const element = document.createElement('div');
  jest.spyOn(document, 'querySelector').mockReturnValue(element);
  const domToPdf = jest.requireMock('dom-to-pdf').default as jest.Mock;
  domToPdf.mockRejectedValue(new Error('boom'));
  const addWarningToast = jest.fn();

  await downloadAsPdf(
    '.some-selector',
    'test-file',
    true,
    addWarningToast,
  )({} as SyntheticEvent);

  expect(addWarningToast).toHaveBeenCalledWith(
    'PDF download failed, please refresh and try again.',
  );
});

test('forwards both bound toast callbacks to forceLoadAllCharts', async () => {
  const element = document.createElement('div');
  jest.spyOn(document, 'querySelector').mockReturnValue(element);
  const domToPdf = jest.requireMock('dom-to-pdf').default as jest.Mock;
  domToPdf.mockResolvedValue(undefined);
  const addWarningToast = jest.fn();
  const addInfoToast = jest.fn();

  await downloadAsPdf(
    '.some-selector',
    'test-file',
    true,
    addWarningToast,
    addInfoToast,
  )({} as SyntheticEvent);

  expect(forceLoadAllCharts).toHaveBeenCalledWith(
    element,
    undefined,
    addWarningToast,
    addInfoToast,
  );
});

const tableChart = (rows: number) => {
  const element = document.createElement('div');
  const table = document.createElement('table');
  table
    .createTHead()
    .insertRow()
    .appendChild(document.createElement('th')).textContent = 'name';
  const body = table.createTBody();
  for (let r = 0; r < rows; r += 1) {
    body.insertRow().insertCell().textContent = `row ${r}`;
  }
  element.appendChild(table);
  return element;
};

test('draws a table chart as a real PDF and warns when fewer rows fit than the table has', async () => {
  jest.spyOn(document, 'querySelector').mockReturnValue(tableChart(250));
  const domToPdf = jest.requireMock('dom-to-pdf').default as jest.Mock;
  const addWarningToast = jest.fn();

  await downloadAsPdf(
    '.some-selector',
    'test-file',
    true,
    addWarningToast,
  )({} as SyntheticEvent);

  expect(buildTablePdf).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'test-file' }),
  );
  expect(domToPdf).not.toHaveBeenCalled();
  expect(addWarningToast).toHaveBeenCalledWith(
    'The PDF shows %s of %s rows. Use CSV or Excel export to get all the data.',
  );
});

test('falls back to the picture-based export when the table cannot be drawn as text, and leaves the page as it was', async () => {
  const element = tableChart(250);
  jest.spyOn(document, 'querySelector').mockReturnValue(element);
  (canDrawInPdf as jest.Mock).mockReturnValueOnce(false);
  const domToPdf = jest.requireMock('dom-to-pdf').default as jest.Mock;
  let hiddenDuringCapture = 0;
  domToPdf.mockImplementation(() => {
    hiddenDuringCapture = element.querySelectorAll(
      'tr[style*="display: none"]',
    ).length;
    return Promise.resolve();
  });
  const addWarningToast = jest.fn();

  await downloadAsPdf(
    '.some-selector',
    'test-file',
    true,
    addWarningToast,
  )({} as SyntheticEvent);

  expect(hiddenDuringCapture).toBe(50);
  expect(element.querySelectorAll('tr[style*="display: none"]')).toHaveLength(
    0,
  );
  expect(addWarningToast).toHaveBeenCalledWith(
    'The PDF shows %s of %s rows. Use CSV or Excel export to get all the data.',
  );
});
