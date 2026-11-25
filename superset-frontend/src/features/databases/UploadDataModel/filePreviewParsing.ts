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

export const PREVIEW_ROW_LIMIT = 100;

export type PreviewCell = string | number | boolean | null | undefined;

export interface PreviewData {
  columns: string[];
  /** Each record maps a column's position (as a string) to its value. */
  data: Record<string, string>[];
}

export interface PreviewOptions {
  headerRow?: number;
  skipRows?: number;
}

/**
 * Decodes file bytes the way the CSV uploader does: strict UTF-8 first,
 * falling back to windows-1252 (a superset of latin-1) when the bytes are
 * not valid UTF-8. A leading UTF-8 byte order mark is stripped.
 */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/**
 * Splits delimited text into records, honouring double-quoted fields
 * (which may contain the delimiter, line breaks and `""` escaped quotes).
 * Stops after `maxRecords` records so large files are not fully parsed.
 */
export function parseDelimitedText(
  text: string,
  delimiter: string,
  maxRecords: number = Number.POSITIVE_INFINITY,
): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endRecord = () => {
    record.push(field);
    records.push(record);
    record = [];
    field = '';
  };

  while (i < source.length && records.length < maxRecords) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      i += 1;
    } else if (char === '"' && field === '') {
      inQuotes = true;
      i += 1;
    } else if (delimiter && source.startsWith(delimiter, i)) {
      record.push(field);
      field = '';
      i += delimiter.length;
    } else if (char === '\r' || char === '\n') {
      endRecord();
      i += char === '\r' && source[i + 1] === '\n' ? 2 : 1;
    } else {
      field += char;
      i += 1;
    }
  }

  if (records.length < maxRecords && (field !== '' || record.length > 0)) {
    endRecord();
  }
  return records;
}

const isBlankRow = (row: PreviewCell[]): boolean =>
  row.every(cell => cell === undefined || cell === null || cell === '');

const toNonNegativeInt = (value: number | undefined): number =>
  Number.isFinite(value) && (value as number) > 0
    ? Math.floor(value as number)
    : 0;

/**
 * Turns raw rows into preview columns and records, mirroring how the
 * uploader reads files with pandas: `skipRows` raw rows are dropped first,
 * blank rows are ignored, and `headerRow` selects the header among the
 * remaining rows. Rows between the skipped rows and the header are dropped.
 */
export function buildPreview(
  rows: PreviewCell[][],
  { headerRow, skipRows }: PreviewOptions = {},
): PreviewData {
  const header = toNonNegativeInt(headerRow);
  const candidateRows = rows
    .slice(toNonNegativeInt(skipRows))
    .filter(row => !isBlankRow(row));
  if (candidateRows.length <= header) {
    return { columns: [], data: [] };
  }
  const columns = candidateRows[header].map(
    (cell, i) => String(cell ?? '').trim() || `col_${i}`,
  );
  const data = candidateRows
    .slice(header + 1, header + 1 + PREVIEW_ROW_LIMIT)
    .map(row => {
      // Keyed by position so duplicate header names don't collide.
      const record: Record<string, string> = {};
      columns.forEach((_, i) => {
        record[String(i)] = String(row[i] ?? '').trim();
      });
      return record;
    });
  return { columns, data };
}

/**
 * Number of raw records to parse so the preview has enough rows after
 * skipping, header selection and the row limit (with slack for blank rows).
 */
export const recordsNeeded = ({ headerRow, skipRows }: PreviewOptions) =>
  toNonNegativeInt(skipRows) +
  toNonNegativeInt(headerRow) +
  1 +
  PREVIEW_ROW_LIMIT * 2;
