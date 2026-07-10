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
import PivotTableChart from '../src/PivotTableChart';
import transformProps from '../src/plugin/transformProps';
import testData from './testData';
import { ProviderWrapper } from './testHelpers';

test('applies pvtRowLabelLast class to last data row when colTotals is disabled', () => {
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

  const tableBody = container.querySelector('tbody');
  const dataRows = Array.from(tableBody?.querySelectorAll('tr') ?? []).filter(
    row => !row.classList.contains('pvtRowTotals'),
  );

  // Get the last data row
  const lastDataRow = dataRows[dataRows.length - 1];
  expect(lastDataRow).toBeInTheDocument();

  // Check if any cell in the last data row has pvtRowLabelLast class
  const lastRowCells = lastDataRow.querySelectorAll('th.pvtRowLabel');
  const hasLastClass = Array.from(lastRowCells).some(cell =>
    cell.classList.contains('pvtRowLabelLast'),
  );

  expect(hasLastClass).toBe(true);
});

test('does not apply pvtRowLabelLast class to last data row when colTotals is enabled', () => {
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

  const tableBody = container.querySelector('tbody');
  const dataRows = Array.from(tableBody?.querySelectorAll('tr') ?? []).filter(
    row => !row.classList.contains('pvtRowTotals'),
  );

  // Get the last data row (before totals row)
  const lastDataRow = dataRows[dataRows.length - 1];
  expect(lastDataRow).toBeInTheDocument();

  // Check if any cell in the last data row has pvtRowLabelLast class
  const lastRowCells = lastDataRow.querySelectorAll('th.pvtRowLabel');
  const hasLastClass = Array.from(lastRowCells).some(cell =>
    cell.classList.contains('pvtRowLabelLast'),
  );

  // Should NOT have the class because totals row will have the border
  expect(hasLastClass).toBe(false);

  // Verify totals row exists
  const totalsRow = container.querySelector('tr.pvtRowTotals');
  expect(totalsRow).toBeInTheDocument();
});

test('applies pvtRowLabelLast to the spanning outer <th> that bottoms out the table', () => {
  // Two row dimensions ([country, city]) so the "Spain" outer <th> spans two
  // data rows (rowSpan 2). This is the merged-cell case #36031 is about; the
  // existing flat fixtures (every rowSpan 1) never exercise it.
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

  // Find the outer row-label <th> that spans multiple data rows.
  const spanningLabels = Array.from(
    container.querySelectorAll('tbody th.pvtRowLabel'),
  ).filter(cell => Number(cell.getAttribute('rowspan')) >= 2);

  // Sanity check: the fixture actually produced a merged cell.
  expect(spanningLabels.length).toBeGreaterThan(0);

  const spanningCell = spanningLabels[spanningLabels.length - 1];
  expect(spanningCell).toHaveTextContent('Spain');
  expect(spanningCell.getAttribute('rowspan')).toBe('2');

  // The spanning cell bottoms out the table (rowIdx + rowSpan === visibleRowCount)
  // so it must carry the border class.
  expect(spanningCell).toHaveClass('pvtRowLabelLast');
});

test('withholds pvtRowLabelLast from the spanning <th> when colTotals owns the bottom', () => {
  const transformedProps = {
    ...transformProps(testData.groupedRowsWithColTotals),
    margin: 32,
    legacy_order_by: null,
    order_desc: false,
  };
  const { container } = render(
    ProviderWrapper({
      children: <PivotTableChart {...transformedProps} />,
    }),
  );

  const spanningLabels = Array.from(
    container.querySelectorAll('tbody th.pvtRowLabel'),
  ).filter(cell => Number(cell.getAttribute('rowspan')) >= 2);

  expect(spanningLabels.length).toBeGreaterThan(0);

  const spanningCell = spanningLabels[spanningLabels.length - 1];
  expect(spanningCell).toHaveTextContent('Spain');

  // The totals row now bottoms out the table, so no row-label <th> should get
  // the border class.
  const anyLabelHasLastClass = Array.from(
    container.querySelectorAll('tbody th.pvtRowLabel'),
  ).some(cell => cell.classList.contains('pvtRowLabelLast'));
  expect(anyLabelHasLastClass).toBe(false);

  // The totals row owns the bottom edge instead.
  const totalsRow = container.querySelector('tr.pvtRowTotals');
  expect(totalsRow).toBeInTheDocument();
});
