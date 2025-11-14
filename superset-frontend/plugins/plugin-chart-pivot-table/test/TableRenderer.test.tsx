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
