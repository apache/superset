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
 * @fileoverview Toast notification API for Superset extensions.
 *
 * Extensions use these functions to show transient messages in Superset's
 * toast area.
 *
 * @example
 * ```typescript
 * import { toasts } from '@apache-superset/core';
 *
 * toasts.addSuccessToast('Exported to Google Sheets', {
 *   link: { href: 'https://docs.google.com/spreadsheets/d/abc', label: 'Open' },
 * });
 * ```
 */

/**
 * Optional settings for a toast.
 */
export interface ToastOptions {
  /** A link shown on the toast; it opens in a new tab after Superset's navigation guard; absolute URLs must use `http(s)`, `ftp:`, `mailto:` or `tel:`, and rejected URLs are logged instead of opened. */
  link?: { href: string; label: string };
  /** Time in milliseconds before the toast closes; `0` keeps it until closed. Defaults to 8000. Ignored when `link` is set; link toasts stay until closed. */
  duration?: number;
}

/**
 * Shows an informational toast.
 *
 * @param text The message, rendered as plain text.
 * @param options Optional link and duration.
 * @returns The ID of the toast, for use with {@link removeToast}.
 *
 * @example
 * ```typescript
 * toasts.addInfoToast('Export started');
 * ```
 */
export declare function addInfoToast(
  text: string,
  options?: ToastOptions,
): string;

/**
 * Shows a success toast.
 *
 * @param text The message, rendered as plain text.
 * @param options Optional link and duration.
 * @returns The ID of the toast, for use with {@link removeToast}.
 *
 * @example
 * ```typescript
 * toasts.addSuccessToast('Export complete');
 * ```
 */
export declare function addSuccessToast(
  text: string,
  options?: ToastOptions,
): string;

/**
 * Shows a warning toast.
 *
 * @param text The message, rendered as plain text.
 * @param options Optional link and duration.
 * @returns The ID of the toast, for use with {@link removeToast}.
 *
 * @example
 * ```typescript
 * toasts.addWarningToast('Export truncated to 10,000 rows');
 * ```
 */
export declare function addWarningToast(
  text: string,
  options?: ToastOptions,
): string;

/**
 * Shows an error toast.
 *
 * @param text The message, rendered as plain text.
 * @param options Optional link and duration.
 * @returns The ID of the toast, for use with {@link removeToast}.
 *
 * @example
 * ```typescript
 * toasts.addDangerToast('Export failed');
 * ```
 */
export declare function addDangerToast(
  text: string,
  options?: ToastOptions,
): string;

/**
 * Closes a toast.
 *
 * @param id The ID returned when the toast was added.
 *
 * @example
 * ```typescript
 * const id = toasts.addInfoToast('Exporting...', { duration: 0 });
 * toasts.removeToast(id);
 * ```
 */
export declare function removeToast(id: string): void;
