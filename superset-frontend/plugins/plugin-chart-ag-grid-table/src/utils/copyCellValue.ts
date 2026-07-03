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
 * The Interactive Table selects the cell (not its text) on click (#106389).
 * Because only AG Grid Community modules are registered, the Enterprise
 * clipboard module is unavailable, so the browser's native text-selection was
 * previously the *only* way to copy a cell value. To keep copy-a-value working,
 * we provide a small Ctrl/Cmd+C handler that copies the focused cell's value.
 */

/** Minimal shape of a keyboard event needed to detect a copy shortcut. */
export interface CopyKeyboardEvent {
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** Minimal shape of the AG Grid cell key-down params we rely on. */
export interface CopyableCellParams {
  event?: CopyKeyboardEvent | null;
  value?: unknown;
  valueFormatted?: unknown;
}

/** True when the event is Ctrl+C (Win/Linux) or Cmd+C (macOS). */
export function isCopyShortcut(event?: CopyKeyboardEvent | null): boolean {
  if (!event) {
    return false;
  }
  const key = (event.key ?? '').toLowerCase();
  return (event.ctrlKey === true || event.metaKey === true) && key === 'c';
}

/**
 * Resolves the text to copy for a cell. Prefers the formatted (displayed) value
 * so the copied text matches what the user sees; falls back to the raw value.
 * Null/undefined values copy as an empty string.
 */
export function getCellCopyText(params?: CopyableCellParams): string {
  if (!params) {
    return '';
  }
  const raw =
    params.valueFormatted !== null && params.valueFormatted !== undefined
      ? params.valueFormatted
      : params.value;
  if (raw === null || raw === undefined) {
    return '';
  }
  return String(raw);
}

/**
 * Writes text to the clipboard, using the async Clipboard API when available
 * and falling back to a hidden textarea + execCommand for non-secure contexts.
 * Returns whether the write is believed to have succeeded.
 */
export async function writeTextToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy fallback below.
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand('copy');
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}

/**
 * AG Grid `onCellKeyDown` handler: copies the focused cell's value on Ctrl/Cmd+C.
 * Returns true when the copy shortcut was handled, false otherwise (so the event
 * is left untouched for any other key).
 */
export function copyCellValueOnKeyDown(params?: CopyableCellParams): boolean {
  if (!isCopyShortcut(params?.event)) {
    return false;
  }
  const text = getCellCopyText(params);
  // Fire and forget — the clipboard write is async but the handler is sync.
  void writeTextToClipboard(text);
  return true;
}
