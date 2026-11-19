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

/**
 * Keyboard fields we read to detect a copy shortcut. AG Grid types the event as
 * the DOM `Event`, so we accept that and read the keyboard fields optionally
 * (at runtime a cell key-down carries a `KeyboardEvent`).
 */
export type CopyKeyboardEvent = Partial<
  Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>
> &
  Partial<Event>;

/**
 * Minimal shape of the AG Grid `CellKeyDownEvent` we rely on. The event carries
 * no pre-formatted value, so we re-run the column's `valueFormatter` ourselves.
 */
export interface CopyableCellParams {
  event?: CopyKeyboardEvent | null;
  value?: unknown;
  colDef?: {
    valueFormatter?: unknown;
  } | null;
  // Forwarded to the valueFormatter; Superset's reads `value` and `node`.
  node?: unknown;
  column?: unknown;
  data?: unknown;
  api?: unknown;
  context?: unknown;
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
 * Resolves the text to copy so it matches what the user sees: runs the column's
 * `valueFormatter` (as the grid does when painting the cell) to copy the
 * displayed value (`2,871`, `$2.87K`, `N/A`, ...). Falls back to the raw value
 * when there is no formatter or it throws; null/undefined copy as empty string.
 */
export function getCellCopyText(params?: CopyableCellParams): string {
  if (!params) {
    return '';
  }

  const { valueFormatter } = params.colDef ?? {};
  if (typeof valueFormatter === 'function') {
    try {
      const formatted = valueFormatter({
        value: params.value,
        node: params.node,
        column: params.column,
        colDef: params.colDef,
        data: params.data,
        api: params.api,
        context: params.context,
      });
      if (formatted !== null && formatted !== undefined) {
        return String(formatted);
      }
    } catch {
      // Fall through to the raw value below.
    }
  }

  const { value } = params;
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
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
  // Fire and forget; writeTextToClipboard already swallows its own errors.
  writeTextToClipboard(text).catch(() => {});
  return true;
}
