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
import { copyTextToClipboard } from '@superset-ui/core';

const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const makeGetText = (text: string) => () => Promise.resolve(text);

const globalWithClipboardItem = global as unknown as { ClipboardItem?: unknown };

afterEach(() => {
  jest.restoreAllMocks();
  delete globalWithClipboardItem.ClipboardItem;
});

test('uses Clipboard API writeText on non-Safari browsers', async () => {
  Object.defineProperty(navigator, 'userAgent', {
    value: CHROME_UA,
    configurable: true,
  });
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });

  await copyTextToClipboard(makeGetText('hello'));

  expect(writeText).toHaveBeenCalledWith('hello');
});

test('uses ClipboardItem API on Safari browsers', async () => {
  Object.defineProperty(navigator, 'userAgent', {
    value: SAFARI_UA,
    configurable: true,
  });
  const write = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { write },
    configurable: true,
  });
  const MockClipboardItem = jest.fn().mockImplementation(data => ({ data }));
  globalWithClipboardItem.ClipboardItem = MockClipboardItem;

  await copyTextToClipboard(makeGetText('safari text'));

  expect(MockClipboardItem).toHaveBeenCalled();
  expect(write).toHaveBeenCalledWith([expect.anything()]);
});

test('falls back to writeText on Safari when ClipboardItem write fails', async () => {
  Object.defineProperty(navigator, 'userAgent', {
    value: SAFARI_UA,
    configurable: true,
  });
  const writeText = jest.fn().mockResolvedValue(undefined);
  const write = jest.fn().mockRejectedValue(new Error('not supported'));
  Object.defineProperty(navigator, 'clipboard', {
    value: { write, writeText },
    configurable: true,
  });
  const MockClipboardItem = jest.fn().mockImplementation(data => ({ data }));
  globalWithClipboardItem.ClipboardItem = MockClipboardItem;

  await copyTextToClipboard(makeGetText('fallback text'));

  expect(writeText).toHaveBeenCalledWith('fallback text');
});

function mockExecCommand(impl: (cmd: string) => boolean) {
  Object.defineProperty(document, 'execCommand', {
    value: jest.fn().mockImplementation(impl),
    configurable: true,
    writable: true,
  });
}

function setupFallbackMocks(options: {
  selection: Partial<Selection> | null;
}) {
  Object.defineProperty(navigator, 'userAgent', {
    value: CHROME_UA,
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: jest.fn().mockRejectedValue(new Error('not allowed')),
    },
    configurable: true,
  });

  const mockRange = { selectNode: jest.fn() };
  const mockSpan = {
    style: {} as CSSStyleDeclaration,
    textContent: '',
  } as unknown as HTMLSpanElement;

  jest
    .spyOn(document, 'getSelection')
    .mockReturnValue(options.selection as Selection | null);
  jest.spyOn(document, 'createRange').mockReturnValue(mockRange as unknown as Range);
  jest.spyOn(document, 'createElement').mockReturnValue(mockSpan);
  jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockSpan);
  jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockSpan);

  return { mockRange, mockSpan };
}

test('falls back to execCommand copy when Clipboard API is unavailable', async () => {
  const removeRange = jest.fn();
  const { mockRange } = setupFallbackMocks({
    selection: {
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
      removeRange,
    },
  });
  mockExecCommand(cmd => cmd === 'copy');

  await copyTextToClipboard(makeGetText('exec text'));

  expect(document.execCommand).toHaveBeenCalledWith('copy');
  expect(removeRange).toHaveBeenCalledWith(mockRange);
});

test('falls back to removeAllRanges when removeRange is not available', async () => {
  const removeAllRanges = jest.fn();
  setupFallbackMocks({
    selection: {
      removeAllRanges,
      addRange: jest.fn(),
      removeRange: undefined,
    },
  });
  mockExecCommand(cmd => cmd === 'copy');

  await copyTextToClipboard(makeGetText('no removeRange'));

  expect(removeAllRanges).toHaveBeenCalled();
});

test('rejects when execCommand returns false', async () => {
  setupFallbackMocks({
    selection: {
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
      removeRange: jest.fn(),
    },
  });
  mockExecCommand(() => false);

  await expect(copyTextToClipboard(makeGetText('fail'))).rejects.toBeUndefined();
});

test('rejects when execCommand throws', async () => {
  setupFallbackMocks({
    selection: {
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
      removeRange: jest.fn(),
    },
  });
  Object.defineProperty(document, 'execCommand', {
    value: jest.fn().mockImplementation(() => {
      throw new Error('execCommand error');
    }),
    configurable: true,
    writable: true,
  });

  await expect(copyTextToClipboard(makeGetText('throw'))).rejects.toBeUndefined();
});

test('resolves without copying when getSelection returns null', async () => {
  Object.defineProperty(navigator, 'userAgent', {
    value: CHROME_UA,
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: jest.fn().mockRejectedValue(new Error('not allowed')),
    },
    configurable: true,
  });

  jest.spyOn(document, 'getSelection').mockReturnValue(null);

  await expect(
    copyTextToClipboard(makeGetText('no selection')),
  ).resolves.toBeUndefined();
});
