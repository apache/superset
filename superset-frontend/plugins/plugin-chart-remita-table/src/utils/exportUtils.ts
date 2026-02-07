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

import { DataColumnMeta } from '../types';
import { formatColumnValue } from './formatValue';

const CHUNK_SIZE = 1000; // Process 1000 rows at a time
const LARGE_DATASET_THRESHOLD = 5000; // Use chunking for datasets larger than this

/**
 * Escapes a CSV cell value according to RFC 4180
 */
function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Formats a single row for CSV export
 */
function formatCsvRow(
  row: any,
  columns: DataColumnMeta[],
): string {
  return columns
    .map(col => {
      const [, text] = formatColumnValue(col as any, row?.[col.key]);
      return escapeCsvCell(String(text ?? ''));
    })
    .join(',');
}

/**
 * Formats a single row for Excel (HTML table) export
 */
function formatExcelRow(
  row: any,
  columns: DataColumnMeta[],
): string {
  const cells = columns
    .map(col => {
      const [, text] = formatColumnValue(col as any, row?.[col.key]);
      return `<td>${String(text ?? '')}</td>`;
    })
    .join('');
  return `<tr>${cells}</tr>`;
}

/**
 * Processes rows in chunks to avoid blocking the UI
 */
async function processRowsInChunks<T>(
  rows: any[],
  columns: DataColumnMeta[],
  formatter: (row: any, columns: DataColumnMeta[]) => T,
): Promise<T[]> {
  const result: T[] = [];

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const formattedChunk = chunk.map(row => formatter(row, columns));
    result.push(...formattedChunk);

    // Yield to the event loop to keep UI responsive
    if (i + CHUNK_SIZE < rows.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return result;
}

/**
 * Exports data to CSV format
 * Uses chunking for large datasets to avoid blocking the UI
 */
export async function exportToCsv(
  rows: any[],
  columns: DataColumnMeta[],
  filename: string,
): Promise<void> {
  const header = columns
    .map(col => escapeCsvCell(String(col.label || col.key)))
    .join(',');

  let lines: string[];

  if (rows.length > LARGE_DATASET_THRESHOLD) {
    // Use chunking for large datasets
    lines = await processRowsInChunks(rows, columns, formatCsvRow);
  } else {
    // Process all at once for small datasets
    lines = rows.map(row => formatCsvRow(row, columns));
  }

  const content = [header, ...lines].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });

  downloadBlob(blob, filename);
}

/**
 * Exports data to Excel (HTML table) format
 * Uses chunking for large datasets to avoid blocking the UI
 */
export async function exportToExcel(
  rows: any[],
  columns: DataColumnMeta[],
  filename: string,
): Promise<void> {
  const headerCells = columns
    .map(col => `<th>${String(col.label || col.key)}</th>`)
    .join('');
  const header = `<thead><tr>${headerCells}</tr></thead>`;

  let bodyRows: string[];

  if (rows.length > LARGE_DATASET_THRESHOLD) {
    // Use chunking for large datasets
    bodyRows = await processRowsInChunks(rows, columns, formatExcelRow);
  } else {
    // Process all at once for small datasets
    bodyRows = rows.map(row => formatExcelRow(row, columns));
  }

  const body = `<tbody>${bodyRows.join('')}</tbody>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><table>${header}${body}</table></body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  downloadBlob(blob, filename);
}

/**
 * Downloads a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  // Append to document, click, and cleanup
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release the object URL after a short delay to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
