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
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  copyText,
  downloadDataUrl,
  downloadFile,
  escapeCsvCell,
  exportFilename,
  isDownloadRestricted,
  toCsv,
} from './export';
import type { ChartData } from './types';

function data(over: Partial<ChartData> = {}): ChartData {
  return {
    chart_id: 42,
    chart_name: 'Monthly Revenue',
    chart_type: 'table',
    columns: [
      {
        name: 'country',
        display_name: 'Country',
        data_type: 'string',
        sample_values: [],
        null_count: 0,
        unique_count: 2,
      },
      {
        name: 'sales',
        display_name: 'Sales',
        data_type: 'numeric',
        sample_values: [],
        null_count: 0,
        unique_count: 2,
      },
    ],
    data: [
      { country: 'US', sales: 100.5 },
      { country: 'CA', sales: 60 },
    ],
    row_count: 2,
    total_rows: 2,
    ...over,
  } as ChartData;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CSV serialization', () => {
  test('quotes only cells that need it', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(0)).toBe('0');
  });

  test('neutralizes spreadsheet formula injection', () => {
    // Same hardening as Superset's own CSV export: a leading formula
    // character is escaped so Excel/Sheets treat the cell as text.
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('+cmd')).toBe("'+cmd");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    // A negative *number* is not an injection attempt; guarding it would turn
    // a number into text on re-import.
    expect(escapeCsvCell(-2)).toBe('-2');
  });

  test('strips untrusted-content markers', () => {
    expect(
      escapeCsvCell('<UNTRUSTED-CONTENT>\nClassic Cars\n</UNTRUSTED-CONTENT>'),
    ).toBe('Classic Cars');
  });

  test('writes a header of display names and raw values', () => {
    expect(toCsv(data())).toBe(
      'Country,Sales\r\nUS,100.5\r\nCA,60',
    );
  });

  test('honours a row cap for the share-with-assistant path', () => {
    expect(toCsv(data(), 1)).toBe('Country,Sales\r\nUS,100.5');
    expect(toCsv(data(), 0)).toBe('Country,Sales');
  });

  test('an empty result still produces a header row', () => {
    expect(toCsv(data({ data: [], row_count: 0 }))).toBe('Country,Sales');
  });
});

describe('export filenames', () => {
  test('slugifies the chart name and pins the chart id', () => {
    expect(exportFilename(data(), 'csv')).toBe('monthly-revenue-42.csv');
    expect(
      exportFilename(
        data({ chart_name: '<UNTRUSTED-CONTENT>\nQ1 / Q2: Sales!\n</UNTRUSTED-CONTENT>' }),
        'png',
      ),
    ).toBe('q1-q2-sales-42.png');
  });

  test('falls back when the name has no usable characters', () => {
    expect(exportFilename(data({ chart_name: '***' }), 'csv')).toBe(
      'chart-42.csv',
    );
  });
});

describe('download capability probe', () => {
  test('a top-level document can download', () => {
    // jsdom runs the suite as a top-level window, which is the unsandboxed
    // case: `window.self === window.top`.
    expect(isDownloadRestricted()).toBe(false);
  });

  test('an opaque-origin (sandboxed) frame cannot', () => {
    // A sandboxed iframe without allow-same-origin reports origin "null".
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    vi.spyOn(window, 'origin', 'get').mockReturnValue('null');
    expect(isDownloadRestricted()).toBe(true);
  });

  test('an embedded frame with a real origin is treated as capable', () => {
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    vi.spyOn(window, 'origin', 'get').mockReturnValue('https://example.test');
    expect(isDownloadRestricted()).toBe(false);
  });
});

describe('file downloads', () => {
  test('creates a named blob download and revokes the URL', () => {
    const created = vi.fn(() => 'blob:fake');
    const revoked = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: created, revokeObjectURL: revoked });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('rows.csv');
        expect(this.href).toBe('blob:fake');
      });

    expect(downloadFile('rows.csv', 'text/csv', 'a,b')).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    // The anchor must not be left behind in the document.
    expect(document.querySelector('a[download]')).toBeNull();
    vi.unstubAllGlobals();
  });

  test('reports failure instead of throwing when the platform refuses', () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => {
        throw new Error('blocked');
      },
    });
    expect(downloadFile('rows.csv', 'text/csv', 'a,b')).toBe(false);
    vi.unstubAllGlobals();
  });

  test('data-URL downloads carry the filename', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('chart.png');
      });
    expect(downloadDataUrl('chart.png', 'data:image/png;base64,AA')).toBe(true);
    expect(click).toHaveBeenCalledOnce();
  });
});

describe('clipboard', () => {
  test('uses the async clipboard API when the frame is allowed to', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('a,b')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('a,b');
    vi.unstubAllGlobals();
  });

  test('reports failure when the host denies clipboard access', async () => {
    // A cross-origin iframe does not get clipboard-write by default, and
    // jsdom implements neither path — exactly the case callers must handle
    // with a visible fallback.
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });
    await expect(copyText('a,b')).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});
