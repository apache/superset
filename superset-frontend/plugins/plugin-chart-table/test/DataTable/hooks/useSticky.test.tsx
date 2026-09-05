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
import { useCallback } from 'react';
import { useTable } from 'react-table';
import { render } from '@superset-ui/core/spec';
import useSticky from '../../../src/DataTable/hooks/useSticky';

// A value distinguishable from any real scrollbar width, so assertions can
// tell whether the header/footer width was derived from this JS-measured
// probe (the bug) rather than from the `scrollbar-gutter` CSS reservation
// that the body div (and the sizer that computes column widths) actually use.
const MOCKED_SCROLLBAR_PROBE_SIZE = 42;

jest.mock('../../../src/DataTable/utils/getScrollBarSize', () => ({
  __esModule: true,
  CUSTOM_SCROLLBAR_SIZE: 8,
  default: () => 0,
  getCustomScrollBarSize: () => MOCKED_SCROLLBAR_PROBE_SIZE,
}));

const MAX_WIDTH = 300;
const MAX_HEIGHT = 120; // small enough that the mocked content forces a vertical scroll

const TOTAL_HEADER_HEIGHT = 30;
const TOTAL_FOOTER_HEIGHT = 30;
// Larger than `MAX_HEIGHT - TOTAL_HEADER_HEIGHT - TOTAL_FOOTER_HEIGHT`, so the
// sticky layout effect computes `hasVerticalScroll: true`.
const FULL_TABLE_HEIGHT = 400;

function mockMeasurements() {
  jest
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockImplementation(function mockClientHeight(this: HTMLElement) {
      if (this.tagName === 'THEAD') return TOTAL_HEADER_HEIGHT;
      if (this.tagName === 'TFOOT') return TOTAL_FOOTER_HEIGHT;
      if (this.tagName === 'TABLE') return FULL_TABLE_HEIGHT;
      return 0;
    });
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function mockRect(this: HTMLElement) {
      const width = this.tagName === 'TH' ? 60 : 0;
      return {
        width,
        height: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect;
    });
}

type Row = { category: string; amount: string };

const columns = [
  { Header: 'Category', accessor: 'category' as const },
  { Header: 'SUM(amount)', accessor: 'amount' as const },
];

const data: Row[] = Array.from({ length: 8 }, (_, i) => ({
  category: `Category ${i}`,
  amount: `${1234567.891234 + i}`,
}));

function StickyTableHarness() {
  const getTableSize = useCallback(
    () => ({ width: MAX_WIDTH, height: MAX_HEIGHT }),
    [],
  );
  const { getTableProps, headerGroups, rows, prepareRow, wrapStickyTable } =
    useTable<Row>(
      {
        columns,
        data,
        getTableSize,
      } as any,
      useSticky as any,
    ) as any;

  const renderTable = () => (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map((hg: any) => (
          <tr {...hg.getHeaderGroupProps()} key={hg.id}>
            {hg.headers.map((col: any) => (
              <th {...col.getHeaderProps()} key={col.id}>
                {col.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row: any) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()} key={row.id}>
              {row.cells.map((cell: any) => (
                <td {...cell.getCellProps()} key={cell.column.id}>
                  {cell.render('Cell')}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr key="footer">
          <th>Summary</th>
          <td>
            <strong>14814904.694808</strong>
          </td>
        </tr>
      </tfoot>
    </table>
  );

  return <div data-test="sticky-root">{wrapStickyTable(renderTable)}</div>;
}

test('sticky header/footer width matches the body, independent of the scrollbar-size probe', () => {
  mockMeasurements();

  const { container } = render(<StickyTableHarness />);

  const root = container.querySelector('[data-test="sticky-root"] > div');
  expect(root).not.toBeNull();
  const [headerDiv, bodyDiv, footerDiv] = Array.from(
    root!.children,
  ) as HTMLDivElement[];

  expect(bodyDiv.style.width).toBe(`${MAX_WIDTH}px`);

  // Before the fix these read `${MAX_WIDTH - MOCKED_SCROLLBAR_PROBE_SIZE}px`
  // (258px) -- narrower than the body -- because the header/footer width was
  // computed by subtracting the separately-measured `getCustomScrollBarSize()`
  // probe instead of reserving space the same way the body does. That gap
  // clips the fixed-layout colgroup's rightmost column (the totals column)
  // against the header/footer's `overflow: hidden` wrapper.
  expect(headerDiv.style.width).toBe(`${MAX_WIDTH}px`);
  expect(footerDiv.style.width).toBe(`${MAX_WIDTH}px`);

  // All three must agree on whether a scrollbar gutter is reserved -- the
  // whole point of computing `hasVerticalScroll` -- otherwise the colgroup
  // width computed for one no longer matches the container of the other.
  expect(headerDiv.style.scrollbarGutter).toBe(bodyDiv.style.scrollbarGutter);
  expect(footerDiv.style.scrollbarGutter).toBe(bodyDiv.style.scrollbarGutter);
  expect(bodyDiv.style.scrollbarGutter).toBe('stable');

  jest.restoreAllMocks();
});
