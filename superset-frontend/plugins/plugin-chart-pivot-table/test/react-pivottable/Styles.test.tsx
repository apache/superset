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

  // The corner cell(s) above the frozen row-label column (the padding
  // placeholder and/or the row-attribute name cell in the last header
  // row) must stick on both axes with a higher z-index than the row
  // label column, so they stay on top at the intersection.
  const cornerCells = [
    ...container.querySelectorAll(
      "thead tr:first-of-type th[aria-hidden='true']",
    ),
    ...container.querySelectorAll('thead tr:last-of-type th.pvtAxisLabel'),
  ];
  expect(cornerCells.length).toBeGreaterThan(0);
  cornerCells.forEach(cell => {
    const style = getComputedStyle(cell);
    expect(style.position).toBe('sticky');
    expect(style.top).toBe('0px');
    expect(style.left).toBe('0px');
    expect(Number(style.zIndex)).toBeGreaterThan(Number(rowLabelStyle.zIndex));
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
