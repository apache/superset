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
 * Getting data out of the widget.
 *
 * The widget runs in a host-controlled sandboxed iframe with an empty CSP
 * (`_meta.ui.csp`), and a sandbox without `allow-downloads` blocks navigation
 * to blob:/data: URLs — a download button would simply do nothing. So the
 * export surface is capability-gated: `isDownloadRestricted()` decides whether
 * file downloads are offered at all, and the copy / share paths (which need
 * nothing but the host bridge or a user-driven Ctrl+C) are always available.
 */
import type { ChartData } from './types';
import { stripUntrustedMarkers } from './format';

/** Cells starting with these are interpreted as formulas by spreadsheets. */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Quote and neutralize one CSV cell.
 *
 * Mirrors Superset's own CSV export hardening (`superset/utils/csv.py`): a
 * value that opens with a formula character is prefixed with a single quote so
 * Excel/Sheets treat it as text. Superset's data is not trusted input here —
 * it is whatever the underlying table contains.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const isText = typeof value === 'string';
  const raw = isText ? stripUntrustedMarkers(value) : String(value);
  // Only text is guarded: a negative number is not an injection attempt, and
  // prefixing it would turn a number into text on re-import.
  const guarded =
    isText && FORMULA_PREFIXES.some((p) => raw.startsWith(p)) ? `'${raw}` : raw;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/**
 * Serialize a ChartData payload to RFC 4180 CSV: one header row of display
 * names, then the raw (unformatted, full-precision) values so the output is
 * re-importable rather than pretty.
 */
export function toCsv(data: ChartData, maxRows?: number): string {
  const columns = data.columns ?? [];
  const rows = data.data ?? [];
  const limited =
    typeof maxRows === 'number' && maxRows >= 0 ? rows.slice(0, maxRows) : rows;
  const header = columns
    .map((c) => escapeCsvCell(c.display_name || c.name))
    .join(',');
  const body = limited.map((row) =>
    columns.map((c) => escapeCsvCell(row[c.name])).join(','),
  );
  return [header, ...body].join('\r\n');
}

/** Filesystem-safe stem derived from the chart name. */
export function exportFilename(data: ChartData, extension: string): string {
  const slug = stripUntrustedMarkers(data.chart_name || 'chart')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'chart'}-${data.chart_id}.${extension}`;
}

/**
 * True when this document cannot initiate a file download.
 *
 * A sandboxed iframe without `allow-same-origin` has an opaque origin, which
 * serializes as the literal string "null" — the reliable signal that the host
 * is sandboxing us, and the case where blob downloads are blocked.
 *
 * This is a necessary, not sufficient, test: a host that grants
 * `allow-same-origin` but withholds `allow-downloads` would still block the
 * download, and there is no feature detection for that. The copy and share
 * paths are therefore always offered, never gated on this.
 */
export function isDownloadRestricted(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    return true;
  if (!('download' in document.createElement('a'))) return true;
  try {
    if (window.self === window.top) return false;
  } catch {
    // Cross-origin parent access threw: definitely embedded.
    return true;
  }
  try {
    return window.origin === 'null' || !window.origin;
  } catch {
    return true;
  }
}

/** Trigger a browser download of an in-memory file. Returns false if blocked. */
export function downloadFile(
  filename: string,
  mimeType: string,
  content: string | Blob,
): boolean {
  try {
    const blob =
      content instanceof Blob
        ? content
        : new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick: revoking synchronously can race the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

/** Download an ECharts `getDataURL()` result as a PNG. Returns false if blocked. */
export function downloadDataUrl(filename: string, dataUrl: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort clipboard write.
 *
 * `navigator.clipboard` needs the `clipboard-write` permission, which a
 * cross-origin iframe does not get by default, so this frequently fails inside
 * a host. Callers must have a visible fallback (the widget shows the text in a
 * selectable panel so the user can copy it themselves).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
