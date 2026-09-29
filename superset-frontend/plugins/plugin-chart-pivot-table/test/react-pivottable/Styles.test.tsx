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
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { supersetTheme } from '@apache-superset/core/theme';
import PivotTableChart from '../../src/PivotTableChart';
import transformProps from '../../src/plugin/transformProps';
import testData from '../testData';
import { ProviderWrapper } from '../testHelpers';

test('sticky-positions the row-label column and its corner header cell(s) so they stay visible while scrolling', () => {
  const transformedProps = {
    ...transformProps(testData.withoutColTotals),
    margin: 32,
    legacy_order_by: null,
    order_desc: false,
  };
  const { container } = render(
    ProviderWrapper({
      children: <PivotTableChart {...transformedProps} />,
    }),
  );

  const rowLabelCell = container.querySelector('tbody th.pvtRowLabel');
  expect(rowLabelCell).toBeInTheDocument();
  const rowLabelStyle = getComputedStyle(rowLabelCell as Element);
  expect(rowLabelStyle.position).toBe('sticky');
  expect(rowLabelStyle.left).toBe('0px');

  // The corner cells above the frozen row-label column (the column
  // attribute name cell in each column-header row and the row-attribute
  // name cell in the row-header row) must stick on both axes and paint
  // over the column labels that scroll underneath them. Asserted as two
  // separate non-empty groups -- rather than one merged list -- so that if
  // either selector stops matching (e.g. `pvtCornerLabel` is dropped from
  // the column-attribute name cell), that group's absence fails the test
  // instead of silently leaving only the other group's cells checked.
  const columnCornerCells = container.querySelectorAll(
    'thead th.pvtCornerLabel',
  );
  const rowHeaderCornerCells = container.querySelectorAll(
    'thead tr.pvtRowHeaderRow th.pvtAxisLabel',
  );
  expect(columnCornerCells.length).toBeGreaterThan(0);
  expect(rowHeaderCornerCells.length).toBeGreaterThan(0);
  const cornerCells = [...columnCornerCells, ...rowHeaderCornerCells];
  // The frozen block in each column-header row has to cover the same
  // columns as the frozen row label below it (its own column plus the
  // padding column), otherwise the uncovered strip shows column labels
  // scrolling through the corner.
  const rowLabelSpan = (rowLabelCell as HTMLTableCellElement).colSpan;
  expect(rowLabelSpan).toBe(2);
  columnCornerCells.forEach(cell => {
    expect((cell as HTMLTableCellElement).colSpan).toBe(rowLabelSpan);
  });
  cornerCells.forEach(cell => {
    const style = getComputedStyle(cell);
    expect(style.position).toBe('sticky');
    expect(style.top).toBe('0px');
    expect(style.left).toBe('0px');
    // Assert the declared value, not just a positive number: with no
    // z-index rule applied, jsdom's getComputedStyle resolves to '' and
    // Number('') is 0, so a bare `> 0` check would still pass.
    expect(style.zIndex).toBe('1');
  });

  // The sticky thead is its own stacking context, so the corner cell's
  // z-index can't outrank the row labels by itself. The thead as a whole
  // has to sit above the frozen row-label column.
  const thead = container.querySelector('thead');
  expect(thead).toBeInTheDocument();
  expect(getComputedStyle(thead as Element).zIndex).toBe('2');
  expect(rowLabelStyle.zIndex).toBe('1');
});

test('keeps the sticky totals row above the frozen row-label column', () => {
  const transformedProps = {
    ...transformProps(testData.withColTotals),
    margin: 32,
    legacy_order_by: null,
    order_desc: false,
  };
  const { container } = render(
    ProviderWrapper({
      children: <PivotTableChart {...transformedProps} />,
    }),
  );

  const rowLabelCell = container.querySelector('tbody th.pvtRowLabel');
  const totalsRow = container.querySelector('tbody tr.pvtRowTotals');
  expect(rowLabelCell).toBeInTheDocument();
  expect(totalsRow).toBeInTheDocument();
  expect(getComputedStyle(totalsRow as Element).zIndex).toBe('2');
  expect(getComputedStyle(rowLabelCell as Element).zIndex).toBe('1');

  // The totals row's leading label freezes at the left edge alongside the
  // body row labels, and sits above the totals values in its own row.
  const totalsLabel = totalsRow?.querySelector('th.pvtRowTotalLabel');
  expect(totalsLabel).toBeInTheDocument();
  const totalsLabelStyle = getComputedStyle(totalsLabel as Element);
  expect(totalsLabelStyle.position).toBe('sticky');
  expect(totalsLabelStyle.left).toBe('0px');
  // Assert the declared value rather than `> 0`: with no z-index rule
  // applied, jsdom resolves getComputedStyle(...).zIndex to '', and
  // Number('') is 0, so a bare positivity check would still pass.
  expect(totalsLabelStyle.zIndex).toBe('1');
  expect((totalsLabel as HTMLTableCellElement).colSpan).toBe(
    (rowLabelCell as HTMLTableCellElement).colSpan,
  );
});

test('lets the active (cross-filter) highlight win over the frozen row-label background', () => {
  const transformedProps = {
    ...transformProps(testData.withoutColTotals),
    margin: 32,
    legacy_order_by: null,
    order_desc: false,
  };
  const { container } = render(
    ProviderWrapper({
      children: <PivotTableChart {...transformedProps} />,
    }),
  );

  // Computed colors come back normalized (rgb()), so run the theme tokens
  // through the same normalization before comparing.
  const normalizeColor = (color: string) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = color;
    return probe.style.backgroundColor;
  };

  const rowLabelCell = container.querySelector('tbody th.pvtRowLabel');
  expect(rowLabelCell).toBeInTheDocument();
  expect(getComputedStyle(rowLabelCell as Element).backgroundColor).toBe(
    normalizeColor(supersetTheme.colorBgBase),
  );

  rowLabelCell?.classList.add('active');
  expect(getComputedStyle(rowLabelCell as Element).backgroundColor).toBe(
    normalizeColor(supersetTheme.colorPrimaryBg),
  );
});

test('does not freeze any header cell when the pivot has column dimensions but no row dimensions', () => {
  const transformedProps = {
    ...transformProps(testData.columnsOnly),
    margin: 32,
    legacy_order_by: null,
    order_desc: false,
  };
  const { container } = render(
    ProviderWrapper({
      children: <PivotTableChart {...transformedProps} />,
    }),
  );

  // Without row dimensions there is no row-header row, so the leading
  // cell of the last header row is the column attribute name. It must
  // scroll with its column rather than being treated as a corner cell.
  expect(container.querySelector('thead tr.pvtRowHeaderRow')).toBeNull();
  const headerCells = container.querySelectorAll('thead th');
  expect(headerCells.length).toBeGreaterThan(0);
  headerCells.forEach(cell => {
    expect(getComputedStyle(cell).position).not.toBe('sticky');
  });
});

test('does not freeze the row-label column or its corner cell(s) with more than one row dimension', () => {
  // With multiple row attributes, every row-label and corner cell would
  // freeze at the same left: 0 edge and stack on top of one another, so
  // freezing is scoped to the single-row-dimension case until a
  // per-column offset fast-follow lands.
  const transformedProps = {
    ...transformProps(testData.groupedRowsWithoutColTotals),
    margin: 32,
    legacy_order_by: null,
    order_desc: false,
  };
  const { container } = render(
    ProviderWrapper({
      children: <PivotTableChart {...transformedProps} />,
    }),
  );

  const rowLabelCells = container.querySelectorAll('tbody th.pvtRowLabel');
  expect(rowLabelCells.length).toBeGreaterThan(0);
  rowLabelCells.forEach(cell => {
    expect(getComputedStyle(cell).position).not.toBe('sticky');
  });

  const cornerCells = [
    ...container.querySelectorAll('thead th.pvtCornerLabel'),
    ...container.querySelectorAll('thead tr.pvtRowHeaderRow th.pvtAxisLabel'),
  ];
  expect(cornerCells.length).toBeGreaterThan(0);
  cornerCells.forEach(cell => {
    expect(getComputedStyle(cell).position).not.toBe('sticky');
  });
});

test('does not sticky-position the row-label column or corner cell(s) in dashboard edit mode', () => {
  // TableRenderers detects dashboard edit mode by looking for this class
  // on the document, rather than via a prop.
  const editingMarker = document.createElement('div');
  editingMarker.className = 'dashboard--editing';
  document.body.appendChild(editingMarker);

  try {
    const transformedProps = {
      ...transformProps(testData.withoutColTotals),
      margin: 32,
      legacy_order_by: null,
      order_desc: false,
    };
    const { container } = render(
      ProviderWrapper({
        children: <PivotTableChart {...transformedProps} />,
      }),
    );

    const rowLabelCell = container.querySelector('tbody th.pvtRowLabel');
    expect(rowLabelCell).toBeInTheDocument();
    expect(getComputedStyle(rowLabelCell as Element).position).not.toBe(
      'sticky',
    );
  } finally {
    editingMarker.remove();
  }
});
