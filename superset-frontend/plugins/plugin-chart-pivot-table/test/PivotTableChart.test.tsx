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
import type { ReactElement } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import { TimeGranularity } from '@superset-ui/core';
import PivotTableChart from '../src/PivotTableChart';
import { MetricsLayoutEnum, type PivotTableProps } from '../src/types';

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider theme={supersetTheme}>{ui}</ThemeProvider>);
}

test('emits numeric temporal values for drill-to-detail filters on formatted row headers', () => {
  const onContextMenu = jest.fn();
  const timestamp = 1778630400000;
  const props: PivotTableProps = {
    data: [{ install_date: String(timestamp), value: 1 }],
    height: 400,
    width: 600,
    groupbyRows: ['install_date'],
    groupbyColumns: [],
    metrics: ['value'],
    tableRenderer: 'Table',
    colOrder: 'key_a_to_z',
    rowOrder: 'key_a_to_z',
    aggregateFunction: 'Count',
    transposePivot: false,
    combineMetric: false,
    rowSubtotalPosition: false,
    colSubtotalPosition: false,
    colTotals: false,
    colSubTotals: false,
    rowTotals: false,
    rowSubTotals: false,
    valueFormat: 'SMART_NUMBER',
    currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
    setDataMask: jest.fn(),
    emitCrossFilters: true,
    selectedFilters: {},
    verboseMap: {},
    columnFormats: {},
    currencyFormats: {},
    metricsLayout: MetricsLayoutEnum.COLUMNS,
    metricColorFormatters: [],
    dateFormatters: {
      install_date: value => new Date(Number(value)).toISOString().slice(0, 10),
    },
    legacy_order_by: null,
    order_desc: false,
    onContextMenu,
    timeGrainSqla: TimeGranularity.DAY,
    allowRenderHtml: false,
  };

  renderWithTheme(<PivotTableChart {...props} />);

  const rowHeader = screen.getByText('2026-05-13').closest('th');
  expect(rowHeader).not.toBeNull();
  fireEvent.contextMenu(rowHeader!);

  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const contextMenuFilters = onContextMenu.mock.calls[0][2];
  expect(contextMenuFilters?.drillToDetail).toEqual([
    {
      col: 'install_date',
      op: '==',
      val: timestamp,
      formattedVal: '2026-05-13',
      grain: TimeGranularity.DAY,
    },
  ]);
});

test('emits numeric temporal values for cross-filters on formatted row headers', () => {
  const setDataMask = jest.fn();
  const timestamp = 1777248000000;
  const props: PivotTableProps = {
    data: [{ install_date: String(timestamp), value: 1 }],
    height: 400,
    width: 600,
    groupbyRows: ['install_date'],
    groupbyColumns: [],
    metrics: ['value'],
    tableRenderer: 'Table',
    colOrder: 'key_a_to_z',
    rowOrder: 'key_a_to_z',
    aggregateFunction: 'Count',
    transposePivot: false,
    combineMetric: false,
    rowSubtotalPosition: false,
    colSubtotalPosition: false,
    colTotals: false,
    colSubTotals: false,
    rowTotals: false,
    rowSubTotals: false,
    valueFormat: 'SMART_NUMBER',
    currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
    setDataMask,
    emitCrossFilters: true,
    selectedFilters: {},
    verboseMap: {},
    columnFormats: {},
    currencyFormats: {},
    metricsLayout: MetricsLayoutEnum.COLUMNS,
    metricColorFormatters: [],
    dateFormatters: {
      install_date: value => new Date(Number(value)).toISOString().slice(0, 10),
    },
    legacy_order_by: null,
    order_desc: false,
    timeGrainSqla: TimeGranularity.DAY,
    allowRenderHtml: false,
  };

  renderWithTheme(<PivotTableChart {...props} />);

  const rowHeader = screen.getByText('2026-04-27').closest('th');
  expect(rowHeader).not.toBeNull();
  fireEvent.click(rowHeader!);

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          {
            col: 'install_date',
            op: 'IN',
            val: [timestamp],
          },
        ],
      },
    }),
  );
});
