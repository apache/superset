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

/**
 * Detects if the browser is Safari (WebKit without Chrome).
 */
const isSafari = (): boolean => {
  const { userAgent } = navigator;
  return Boolean(userAgent && /^((?!chrome|android).)*safari/i.test(userAgent));
};

/**
 * Copy text to clipboard using the modern Clipboard API.
 * Handles Safari's requirement for synchronous clipboard access.
 */
const copyWithClipboardApi = async (
  getText: () => Promise<string>,
): Promise<void> => {
  // Safari (WebKit) does not support delayed generation of clipboard.
  // This means that writing to the clipboard, from the moment the user
  // interacts with the app, must be instantaneous.
  // However, neither writeText nor write accepts a Promise, so
  // we need to create a ClipboardItem that accepts said Promise to
  // delay the text generation, as needed.
  // Source: https://bugs.webkit.org/show_bug.cgi?id=222262P
  if (isSafari()) {
    try {
      const clipboardItem = new ClipboardItem({
        'text/plain': getText(),
      });
      await navigator.clipboard.write([clipboardItem]);
    } catch {
      // Fallback to default clipboard API implementation
      const text = await getText();
      await navigator.clipboard.writeText(text);
    }
  } else {
    // For Blink, the above method won't work, but we can use the
    // default (intended) API, since the delayed generation of the
    // clipboard is now supported.
    // Source: https://bugs.chromium.org/p/chromium/issues/detail?id=1014310
    const text = await getText();
    await navigator.clipboard.writeText(text);
  }
};

/**
 * Copy text to clipboard using the legacy execCommand API.
 * Used as fallback for browsers that don't support the Clipboard API.
 */
const copyWithExecCommand = (text: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const selection: Selection | null = document.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      const span = document.createElement('span');
      span.textContent = text;
      span.style.position = 'fixed';
      span.style.top = '0';
      span.style.clip = 'rect(0, 0, 0, 0)';
      span.style.whiteSpace = 'pre';

      document.body.appendChild(span);
      range.selectNode(span);
      selection.addRange(range);

      try {
        if (!document.execCommand('copy')) {
          reject(new Error('execCommand copy failed'));
        }
      } catch (err) {
        reject(err);
      }

      document.body.removeChild(span);
      if (selection.removeRange) {
        selection.removeRange(range);
      } else {
        selection.removeAllRanges();
      }
    }

    resolve();
  });

/**
 * Copy text to clipboard with automatic fallback for older browsers.
 *
 * Uses the modern Clipboard API when available, falling back to
 * document.execCommand('copy') for legacy browser support.
 *
 * @param getText - Function that returns a Promise resolving to the text to copy
 * @returns Promise that resolves when copy succeeds, rejects on failure
 *
 * @example
 * // Copy static text
 * await copyTextToClipboard(() => Promise.resolve('Hello, World!'));
 *
 * @example
 * // Copy dynamic text (e.g., from API)
 * await copyTextToClipboard(async () => {
 *   const response = await fetch('/api/text');
 *   return response.text();
 * });
 */
export const copyTextToClipboard = (
  getText: () => Promise<string>,
): Promise<void> =>
  copyWithClipboardApi(getText).catch(() =>
    getText().then(text => copyWithExecCommand(text)),
  );
