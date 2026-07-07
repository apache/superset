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
import {
  isCopyShortcut,
  getCellCopyText,
  writeTextToClipboard,
  copyCellValueOnKeyDown,
} from '../../src/utils/copyCellValue';

const originalClipboard = navigator.clipboard;

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: originalClipboard,
    configurable: true,
    writable: true,
  });
  jest.restoreAllMocks();
});

function mockClipboard(): jest.Mock {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

// --- isCopyShortcut -------------------------------------------------------

test('isCopyShortcut detects Ctrl+C and Cmd+C', () => {
  expect(isCopyShortcut({ key: 'c', ctrlKey: true })).toBe(true);
  expect(isCopyShortcut({ key: 'c', metaKey: true })).toBe(true);
  expect(isCopyShortcut({ key: 'C', metaKey: true })).toBe(true); // capitalized
});

test('isCopyShortcut ignores other keys and bare C', () => {
  expect(isCopyShortcut({ key: 'c' })).toBe(false); // no modifier
  expect(isCopyShortcut({ key: 'v', ctrlKey: true })).toBe(false); // paste
  expect(isCopyShortcut({ key: 'a', metaKey: true })).toBe(false); // select all
  expect(isCopyShortcut(null)).toBe(false);
  expect(isCopyShortcut(undefined)).toBe(false);
});

// --- getCellCopyText ------------------------------------------------------

test('getCellCopyText returns what the grid displays via colDef.valueFormatter', () => {
  // The real CellKeyDownEvent carries no `valueFormatted`; the displayed text
  // must be derived by invoking the column's valueFormatter, exactly as the
  // grid does when it paints the cell (useColDefs.ts).
  const params = {
    value: 2871,
    colDef: { valueFormatter: () => '2,871' },
  };
  expect(getCellCopyText(params)).toBe('2,871');
});

test('getCellCopyText passes the cell value/node to the valueFormatter', () => {
  // Superset's valueFormatter reads `value` (and `node`) off its params, so the
  // handler must forward them — otherwise currency/percent/date columns copy the
  // raw value instead of the formatted one.
  const valueFormatter = jest.fn(
    (p: { value: unknown }) => `#${String(p.value)}`,
  );
  const node = { level: 0 };
  expect(getCellCopyText({ value: 42, colDef: { valueFormatter }, node })).toBe(
    '#42',
  );
  expect(valueFormatter).toHaveBeenCalledWith(
    expect.objectContaining({ value: 42, node }),
  );
});

test('getCellCopyText copies the "N/A" the grid shows for empty cells', () => {
  // Superset's valueFormatter renders empty/undefined cells as "N/A"; copying an
  // empty string would not match what the user sees.
  const valueFormatter = (p: { value: unknown }) =>
    p.value === undefined || p.value === '' ? 'N/A' : String(p.value);
  expect(
    getCellCopyText({ value: undefined, colDef: { valueFormatter } }),
  ).toBe('N/A');
});

test('getCellCopyText falls back to the raw value when no formatter is present', () => {
  expect(getCellCopyText({ value: 2871 })).toBe('2871');
  expect(getCellCopyText({ value: 'Paris' })).toBe('Paris');
  expect(getCellCopyText({ value: 'Paris', colDef: {} })).toBe('Paris');
});

test('getCellCopyText copies empty string for null/undefined values without a formatter', () => {
  expect(getCellCopyText({ value: null })).toBe('');
  expect(getCellCopyText({ value: undefined })).toBe('');
  expect(getCellCopyText({})).toBe('');
  expect(getCellCopyText(undefined)).toBe('');
});

test('getCellCopyText falls back to the raw value if the formatter throws', () => {
  const valueFormatter = () => {
    throw new Error('boom');
  };
  expect(getCellCopyText({ value: 7, colDef: { valueFormatter } })).toBe('7');
});

// --- writeTextToClipboard -------------------------------------------------

test('writeTextToClipboard uses the async Clipboard API when available', async () => {
  const writeText = mockClipboard();
  await expect(writeTextToClipboard('hello')).resolves.toBe(true);
  expect(writeText).toHaveBeenCalledWith('hello');
});

test('writeTextToClipboard falls back to execCommand when Clipboard API is missing', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  const execCommand = jest.fn().mockReturnValue(true);
  // jsdom does not implement execCommand.
  (document as unknown as { execCommand: unknown }).execCommand = execCommand;

  await expect(writeTextToClipboard('fallback')).resolves.toBe(true);
  expect(execCommand).toHaveBeenCalledWith('copy');
});

test('writeTextToClipboard falls back to execCommand when the Clipboard API rejects', async () => {
  // e.g. clipboard permission denied — must still copy via the legacy path.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
    configurable: true,
    writable: true,
  });
  const execCommand = jest.fn().mockReturnValue(true);
  (document as unknown as { execCommand: unknown }).execCommand = execCommand;

  await expect(writeTextToClipboard('rejected')).resolves.toBe(true);
  expect(execCommand).toHaveBeenCalledWith('copy');
});

test('writeTextToClipboard returns false when both clipboard paths fail', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  (document as unknown as { execCommand: unknown }).execCommand = jest.fn(
    () => {
      throw new Error('execCommand unsupported');
    },
  );

  await expect(writeTextToClipboard('nope')).resolves.toBe(false);
});

// --- copyCellValueOnKeyDown (the onCellKeyDown handler) -------------------

test('copyCellValueOnKeyDown copies the displayed cell value on Ctrl/Cmd+C', () => {
  const writeText = mockClipboard();
  // Realistic CellKeyDownEvent: no `valueFormatted`; the displayed text comes
  // from the column's valueFormatter.
  const handled = copyCellValueOnKeyDown({
    event: { key: 'c', metaKey: true },
    value: 2871,
    colDef: { valueFormatter: () => '2,871' },
  });
  expect(handled).toBe(true);
  expect(writeText).toHaveBeenCalledWith('2,871');
});

test('copyCellValueOnKeyDown ignores non-copy keystrokes', () => {
  const writeText = mockClipboard();
  const handled = copyCellValueOnKeyDown({
    event: { key: 'v', ctrlKey: true },
    value: 'Paris',
  });
  expect(handled).toBe(false);
  expect(writeText).not.toHaveBeenCalled();
});

test('copyCellValueOnKeyDown handles a missing event without throwing', () => {
  const writeText = mockClipboard();
  expect(copyCellValueOnKeyDown(undefined)).toBe(false);
  expect(copyCellValueOnKeyDown({ value: 1 })).toBe(false);
  expect(writeText).not.toHaveBeenCalled();
});
