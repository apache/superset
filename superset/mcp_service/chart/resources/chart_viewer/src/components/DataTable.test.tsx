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
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test } from 'vitest';

import { DataTable, PAGE_SIZE_OPTIONS, paginate } from './DataTable';
import type { ChartData } from '../types';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const PAGE = PAGE_SIZE_OPTIONS[0];

/** A wide result set, like a Superset table chart at its 1000-row cap. */
function bigTable(rows = 1000): ChartData {
  return {
    chart_id: 1,
    chart_name: 'Orders',
    chart_type: 'table',
    columns: [
      {
        name: 'country',
        display_name: 'Country',
        data_type: 'string',
        sample_values: [],
        null_count: 0,
        unique_count: rows,
      },
      {
        name: 'sales',
        display_name: 'Sales',
        data_type: 'numeric',
        sample_values: [],
        null_count: 0,
        unique_count: rows,
      },
    ],
    data: Array.from({ length: rows }, (_, i) => ({
      country: `C${String(i).padStart(4, '0')}`,
      sales: i,
    })),
    row_count: rows,
    total_rows: rows,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: JSX.Element): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(node);
  });
}

function bodyRows(): HTMLTableRowElement[] {
  return Array.from(container!.querySelectorAll('tbody tr'));
}

function cellText(rowIdx: number, colIdx: number): string {
  return bodyRows()[rowIdx].children[colIdx].textContent ?? '';
}

function click(selector: string): void {
  const el = container!.querySelector(selector) as HTMLElement;
  act(() => el.click());
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

test('paginate clamps an out-of-range page instead of showing nothing', () => {
  const rows = [1, 2, 3, 4, 5];
  expect(paginate(rows, 99, 2)).toMatchObject({
    rows: [5],
    page: 2,
    pageCount: 3,
    from: 5,
    to: 5,
    total: 5,
  });
  expect(paginate(rows, -3, 2).page).toBe(0);
  // An empty result set is still one (empty) page, numbered from zero.
  expect(paginate([], 0, 25)).toMatchObject({
    rows: [],
    pageCount: 1,
    from: 0,
    to: 0,
    total: 0,
  });
});

test('renders only one page of a 1000-row result', () => {
  render(<DataTable data={bigTable()} />);
  expect(bodyRows()).toHaveLength(PAGE);
  expect(cellText(0, 0)).toBe('C0000');
  expect(container!.querySelector('.sv-page-range')!.textContent).toBe(
    `1–${PAGE} of 1,000`,
  );
});

test('next/previous page move the visible window', () => {
  render(<DataTable data={bigTable()} />);
  click('[aria-label="Next page"]');
  expect(cellText(0, 0)).toBe(`C${String(PAGE).padStart(4, '0')}`);
  expect(container!.querySelector('.sv-page-count')!.textContent).toContain(
    '2 /',
  );
  click('[aria-label="Previous page"]');
  expect(cellText(0, 0)).toBe('C0000');
});

test('paging controls are disabled at the ends of the range', () => {
  render(<DataTable data={bigTable(30)} />);
  const prev = container!.querySelector(
    '[aria-label="Previous page"]',
  ) as HTMLButtonElement;
  const next = container!.querySelector(
    '[aria-label="Next page"]',
  ) as HTMLButtonElement;
  expect(prev.disabled).toBe(true);
  expect(next.disabled).toBe(false);
  click('[aria-label="Next page"]');
  expect(
    (container!.querySelector('[aria-label="Next page"]') as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test('changing the page size re-slices from the top', () => {
  render(<DataTable data={bigTable()} />);
  click('[aria-label="Next page"]');
  const select = container!.querySelector('select') as HTMLSelectElement;
  act(() => {
    select.value = '100';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(bodyRows()).toHaveLength(100);
  expect(cellText(0, 0)).toBe('C0000');
});

test('a result that fits on one page shows no paging chrome', () => {
  render(<DataTable data={bigTable(10)} />);
  expect(container!.querySelector('.sv-pagination')).toBeNull();
  expect(bodyRows()).toHaveLength(10);
});

test('sorting applies across all rows, not just the visible page', () => {
  render(<DataTable data={bigTable()} />);
  // Descending on the numeric column must surface the global maximum, which
  // lives on the last page of the unsorted data.
  const salesHeader = container!.querySelectorAll('.sv-th-sort')[1] as HTMLElement;
  act(() => salesHeader.click()); // asc
  act(() => salesHeader.click()); // desc
  expect(cellText(0, 1)).toBe('999');
  expect(container!.querySelector('th[aria-sort="descending"]')).not.toBeNull();
});

test('re-sorting returns to the first page', () => {
  render(<DataTable data={bigTable()} />);
  click('[aria-label="Next page"]');
  const header = container!.querySelectorAll('.sv-th-sort')[0] as HTMLElement;
  act(() => header.click());
  expect(container!.querySelector('.sv-page-count')!.textContent).toContain(
    '1 /',
  );
});

test('sorting is reachable by keyboard and announced', () => {
  render(<DataTable data={bigTable()} />);
  // A click handler on a <th> is invisible to keyboard and screen-reader
  // users; the control has to be a real button inside the header cell.
  const headers = Array.from(container!.querySelectorAll('th'));
  expect(headers.every((th) => th.querySelector('button.sv-th-sort'))).toBe(
    true,
  );
  expect(headers.map((th) => th.getAttribute('aria-sort'))).toEqual([
    'none',
    'none',
  ]);
  act(() => (headers[0].querySelector('button') as HTMLElement).click());
  expect(headers[0].getAttribute('aria-sort')).toBe('ascending');
  // The table announces what it is and how big it is.
  const caption = container!.querySelector('caption')!;
  expect(caption.textContent).toContain('Orders');
  expect(caption.textContent).toContain('1000 rows');
});

test('strips untrusted-content markers from paginated cells', () => {
  const data = bigTable(1);
  data.data = [
    { country: '<UNTRUSTED-CONTENT>\nClassic Cars\n</UNTRUSTED-CONTENT>', sales: 1 },
  ];
  render(<DataTable data={data} />);
  expect(cellText(0, 0)).toBe('Classic Cars');
  expect(container!.innerHTML).not.toContain('UNTRUSTED-CONTENT');
});
