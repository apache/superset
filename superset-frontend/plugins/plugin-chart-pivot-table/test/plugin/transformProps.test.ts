/*
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

import { ChartProps, QueryFormData, supersetTheme } from '@superset-ui/core';
import transformProps from '../../src/plugin/transformProps';
import { MetricsLayoutEnum } from '../../src/types';

describe('PivotTableChart transformProps', () => {
  const setDataMask = jest.fn();
  const formData = {
    groupbyRows: ['row1', 'row2'],
    groupbyColumns: ['col1', 'col2'],
    metrics: ['metric1', 'metric2'],
    tableRenderer: 'Table With Subtotal',
    colOrder: 'key_a_to_z',
    rowOrder: 'key_a_to_z',
    aggregateFunction: 'Sum',
    transposePivot: true,
    combineMetric: true,
    rowSubtotalPosition: true,
    colSubtotalPosition: true,
    colTotals: true,
    rowTotals: true,
    valueFormat: 'SMART_NUMBER',
    metricsLayout: MetricsLayoutEnum.COLUMNS,
    viz_type: '',
    datasource: '',
    conditionalFormatting: [],
    dateFormat: '',
    legacy_order_by: 'count',
    order_desc: true,
    currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
  };
  const chartProps = new ChartProps<QueryFormData>({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
        colnames: ['name', 'sum__num', '__timestamp'],
        coltypes: [1, 0, 2],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: supersetTheme,
  });

  it('should transform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual({
      width: 800,
      height: 600,
      groupbyRows: ['row1', 'row2'],
      groupbyColumns: ['col1', 'col2'],
      metrics: ['metric1', 'metric2'],
      tableRenderer: 'Table With Subtotal',
      colOrder: 'key_a_to_z',
      rowOrder: 'key_a_to_z',
      aggregateFunction: 'Sum',
      transposePivot: true,
      combineMetric: true,
      rowSubtotalPosition: true,
      colSubtotalPosition: true,
      colTotals: true,
      rowTotals: true,
      valueFormat: 'SMART_NUMBER',
      data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
      setDataMask,
      selectedFilters: {},
      verboseMap: {},
      metricsLayout: MetricsLayoutEnum.COLUMNS,
      metricColorFormatters: [],
      dateFormatters: {},
      emitCrossFilters: false,
      columnFormats: {},
      currencyFormats: {},
      currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
    });
  });
});
