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
import { useTable, Column } from 'react-table';
import { render } from '@superset-ui/core/spec';
import useSticky from '../../../src/DataTable/hooks/useSticky';

// A value distinguishable from any real scrollbar width, so the width
// assertions below can detect whether header/footer's wrapper width was
// computed by subtracting this JS-measured probe from `maxWidth` (the old,
// removed `maxWidth - scrollBarSize` behavior) rather than always being the
// unconditional `maxWidth` the fix uses. If that subtraction is ever
// reintroduced, header/footer's `style.width` would read
// `${MAX_WIDTH - MOCKED_SCROLLBAR_PROBE_SIZE}px`, an unmistakably wrong
// value given how large this mock is.
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

const columns: Column<Row>[] = [
  { Header: 'Category', accessor: 'category' },
  { Header: 'SUM(amount)', accessor: 'amount' },
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
      },
      useSticky,
    );

  const renderTable = () => (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map(hg => (
          <tr {...hg.getHeaderGroupProps()} key={hg.id}>
            {hg.headers.map(col => (
              <th {...col.getHeaderProps()} key={col.id}>
                {col.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map(row => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()} key={row.id}>
              {row.cells.map(cell => (
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

  // This is the load-bearing assertion for the reported bug. Before the fix
  // these read `${MAX_WIDTH - MOCKED_SCROLLBAR_PROBE_SIZE}px` (258px) --
  // genuinely narrower than the body, from a real CSS `width` subtraction
  // (`maxWidth - scrollBarSize`), not just a smaller reported `clientWidth`.
  // A wrapper that's actually narrower than the shared, fixed-layout
  // colgroup it has to display gets genuinely clipped by its own
  // `overflow: hidden` (verified with real hit-testing in a real browser,
  // see RCA.md -- this is not true of the `scrollbarGutter` assertions
  // below). The fix makes header/footer always exactly `maxWidth`, which the
  // colgroup (bounded by the sizer's `clientWidth`, itself bounded by
  // `maxWidth`) can never exceed.
  expect(headerDiv.style.width).toBe(`${MAX_WIDTH}px`);
  expect(footerDiv.style.width).toBe(`${MAX_WIDTH}px`);

  // Secondary, not itself load-bearing for preventing clipping: real
  // hit-testing shows `scrollbar-gutter` on an `overflow: hidden` box
  // changes what `clientWidth` reports without moving where it actually
  // clips (see RCA.md), so this doesn't guard against the reported bug by
  // itself. It's asserted because header/footer's reported `clientWidth`
  // still needs to match body's `clientWidth` for their programmatically
  // synced `scrollLeft` (see `onScroll` in `useSticky.tsx`) to reveal the
  // same slice of the row body actually shows, when a horizontal scrollbar
  // is present alongside a vertical one.
  expect(headerDiv.style.scrollbarGutter).toBe(bodyDiv.style.scrollbarGutter);
  expect(footerDiv.style.scrollbarGutter).toBe(bodyDiv.style.scrollbarGutter);
  expect(bodyDiv.style.scrollbarGutter).toBe('stable');

  // Pin the `css={scrollBarStyles}` addition to header/footer directly (part
  // of the same secondary consistency measure as the `scrollbarGutter`
  // assertions above, not the clipping fix). This component carries
  // `/** @jsxImportSource @emotion/react */`, which makes
  // Babel route its `css` prop through Emotion's jsx runtime instead of
  // passing `css` straight through as an inert DOM attribute (the default in
  // this repo's Jest/Babel setup, which -- unlike the webpack/SWC build --
  // doesn't set `importSource: '@emotion/react'` globally). With the pragma
  // in place, an applied `css` prop is observable as a real, non-empty
  // className, so this assertion actually fails without the fix instead of
  // passing regardless of whether `scrollBarStyles` is wired up.
  //
  // Before `css={scrollBarStyles}` was added to header/footer, they had no
  // emotion-generated class at all (`className === ''`) while the body kept
  // its own -- so this fails pre-fix and passes post-fix.
  expect(headerDiv.className).not.toBe('');
  expect(headerDiv.className).toBe(bodyDiv.className);
  expect(footerDiv.className).toBe(bodyDiv.className);

  jest.restoreAllMocks();
});
