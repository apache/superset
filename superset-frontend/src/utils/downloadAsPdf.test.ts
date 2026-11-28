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

const createCanvases = () => {
  const element = document.createElement('div');
  const taintedCanvas = document.createElement('canvas');
  const cleanCanvas = document.createElement('canvas');
  jest.spyOn(taintedCanvas, 'toDataURL').mockImplementation(() => {
    throw new DOMException('Tainted canvases may not be exported.');
  });
  jest.spyOn(cleanCanvas, 'toDataURL').mockReturnValue('data:,');
  element.append(taintedCanvas, cleanCanvas);
  return { element, taintedCanvas, cleanCanvas };
};

test('excludes tainted canvases from the PDF instead of failing the export', async () => {
  const { element, taintedCanvas, cleanCanvas } = createCanvases();
  jest.spyOn(document, 'querySelector').mockReturnValue(element);
  const domToPdf = jest.requireMock('dom-to-pdf').default as jest.Mock;
  let classesDuringExport: { tainted: string; clean: string } | undefined;
  domToPdf.mockImplementation(() => {
    classesDuringExport = {
      tainted: taintedCanvas.className,
      clean: cleanCanvas.className,
    };
    return Promise.resolve();
  });

  await downloadAsPdf(
    '.some-selector',
    'test-file',
    true,
  )({} as SyntheticEvent);

  const { excludeClassNames } = domToPdf.mock.calls[0][1];
  expect(excludeClassNames).toContain('header-controls');
  expect(excludeClassNames).toContain(classesDuringExport?.tainted);
  expect(classesDuringExport?.tainted).not.toBe('');
  expect(classesDuringExport?.clean).toBe('');
});

test('removes the tainted canvas marker once the export settles', async () => {
  const { element, taintedCanvas } = createCanvases();
  jest.spyOn(document, 'querySelector').mockReturnValue(element);
  const domToPdf = jest.requireMock('dom-to-pdf').default as jest.Mock;
  domToPdf.mockRejectedValue(new Error('boom'));

  await downloadAsPdf(
    '.some-selector',
    'test-file',
    true,
  )({} as SyntheticEvent);

  expect(domToPdf).toHaveBeenCalled();
  expect(taintedCanvas.className).toBe('');
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
