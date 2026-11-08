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
import domToImage from 'dom-to-image-more';
import downloadAsPdf, {
  pdfFilterElement,
  renderElementToPdf,
} from './downloadAsPdf';
import { forceLoadAllCharts } from './downloadUtils';

const mockSave = jest.fn();
const mockAddPage = jest.fn();
const mockAddImage = jest.fn();

jest.mock('dom-to-image-more', () => ({
  __esModule: true,
  default: {
    toCanvas: jest.fn(),
  },
}));

jest.mock('jspdf', () => ({
  __esModule: true,
  jsPDF: jest.fn().mockImplementation(() => ({
    save: mockSave,
    addPage: mockAddPage,
    addImage: mockAddImage,
  })),
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

const mockToCanvas = domToImage.toCanvas as jest.Mock;

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: jest.fn(),
    drawImage: jest.fn(),
  } as unknown as CanvasRenderingContext2D);
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/jpeg;base64,mockdata');
});

beforeEach(() => {
  mockToCanvas.mockResolvedValue({
    width: 600,
    height: 800,
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('warns the user via the bound toast callback and returns early when the target element is not found', async () => {
  jest.spyOn(document, 'querySelector').mockReturnValue(null);
  const addWarningToast = jest.fn();

  await downloadAsPdf(
    '.non-existent-selector',
    'test-file',
    true,
    addWarningToast,
  )({} as SyntheticEvent);

  expect(addWarningToast).toHaveBeenCalledWith(
    'PDF download failed, please refresh and try again.',
  );
  expect(mockToCanvas).not.toHaveBeenCalled();
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
  mockToCanvas.mockRejectedValue(new Error('capture failed'));
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

test('pdfFilterElement filters out buttons, inputs, selects, and header-controls', () => {
  const button = document.createElement('button');
  const input = document.createElement('input');
  const select = document.createElement('select');
  const headerControl = document.createElement('div');
  headerControl.className = 'header-controls';
  const normalDiv = document.createElement('div');
  const normalText = document.createTextNode('hello');

  expect(pdfFilterElement(button)).toBe(false);
  expect(pdfFilterElement(input)).toBe(false);
  expect(pdfFilterElement(select)).toBe(false);
  expect(pdfFilterElement(headerControl)).toBe(false);
  expect(pdfFilterElement(normalDiv)).toBe(true);
  expect(pdfFilterElement(normalText)).toBe(true);
});

test('passes filterStyles excluding CSS custom properties to domToImage.toCanvas (#45885)', async () => {
  const element = document.createElement('div');
  await renderElementToPdf(element, 'dashboard-export.pdf');

  expect(mockToCanvas).toHaveBeenCalled();
  const [, options] = mockToCanvas.mock.calls[0];
  expect(typeof options.filterStyles).toBe('function');
  expect(options.filterStyles(element, '--ant-color-primary')).toBe(false);
  expect(options.filterStyles(element, '--custom-color')).toBe(false);
  expect(options.filterStyles(element, 'color')).toBe(true);
  expect(options.filterStyles(element, 'background-color')).toBe(true);
  expect(options.filterStyles(element, 'font-size')).toBe(true);

  expect(mockAddImage).toHaveBeenCalled();
  expect(mockSave).toHaveBeenCalledWith('dashboard-export.pdf');
});

test('generates multipage PDF when element height exceeds page boundary', async () => {
  // Canvas height is 3000px, width is 600px -> exceeds single A4 page height (approx 848px)
  mockToCanvas.mockResolvedValue({
    width: 600,
    height: 3000,
  });

  const element = document.createElement('div');
  await renderElementToPdf(element, 'multipage-export.pdf');

  expect(mockAddPage).toHaveBeenCalled();
  expect(mockAddImage.mock.calls.length).toBeGreaterThan(1);
  expect(mockSave).toHaveBeenCalledWith('multipage-export.pdf');
});
