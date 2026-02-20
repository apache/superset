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

import { ChartProps, QueryFormData } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import transformProps from '../../src/plugin/transformProps';
import { MetricsLayoutEnum } from '../../src/types';

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

test('should transform chart props for viz', () => {
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

test('should pass AUTO mode through for per-cell detection (single currency data)', () => {
  const autoFormData = {
    ...formData,
    currencyFormat: { symbol: 'AUTO', symbolPosition: 'prefix' },
  };
  const autoChartProps = new ChartProps<QueryFormData>({
    formData: autoFormData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { country: 'USA', currency: 'USD', revenue: 100 },
          { country: 'Canada', currency: 'USD', revenue: 200 },
          { country: 'Mexico', currency: 'usd', revenue: 150 },
        ],
        colnames: ['country', 'currency', 'revenue'],
        coltypes: [1, 1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: {
      verboseMap: {},
      columnFormats: {},
      currencyCodeColumn: 'currency',
    },
    theme: supersetTheme,
  });

  const result = transformProps(autoChartProps);
  // AUTO mode should be preserved for per-cell detection in PivotTableChart
  expect(result.currencyFormat).toEqual({
    symbol: 'AUTO',
    symbolPosition: 'prefix',
  });
  // currencyCodeColumn should be passed through for per-cell detection
  expect(result.currencyCodeColumn).toBe('currency');
});

test('should pass AUTO mode through for per-cell detection (mixed currency data)', () => {
  const autoFormData = {
    ...formData,
    currencyFormat: { symbol: 'AUTO', symbolPosition: 'prefix' },
  };
  const autoChartProps = new ChartProps<QueryFormData>({
    formData: autoFormData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { country: 'USA', currency: 'USD', revenue: 100 },
          { country: 'UK', currency: 'GBP', revenue: 200 },
          { country: 'France', currency: 'EUR', revenue: 150 },
        ],
        colnames: ['country', 'currency', 'revenue'],
        coltypes: [1, 1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: {
      verboseMap: {},
      columnFormats: {},
      currencyCodeColumn: 'currency',
    },
    theme: supersetTheme,
  });

  const result = transformProps(autoChartProps);
  // AUTO mode should be preserved - per-cell detection happens in PivotTableChart
  expect(result.currencyFormat).toEqual({
    symbol: 'AUTO',
    symbolPosition: 'prefix',
  });
  expect(result.currencyCodeColumn).toBe('currency');
});

test('should pass AUTO mode through when no currency column is defined', () => {
  const autoFormData = {
    ...formData,
    currencyFormat: { symbol: 'AUTO', symbolPosition: 'prefix' },
  };
  const autoChartProps = new ChartProps<QueryFormData>({
    formData: autoFormData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { country: 'USA', revenue: 100 },
          { country: 'UK', revenue: 200 },
        ],
        colnames: ['country', 'revenue'],
        coltypes: [1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: {
      verboseMap: {},
      columnFormats: {},
      // No currencyCodeColumn defined
    },
    theme: supersetTheme,
  });

  const result = transformProps(autoChartProps);
  expect(result.currencyFormat).toEqual({
    symbol: 'AUTO',
    symbolPosition: 'prefix',
  });
  // currencyCodeColumn should be undefined when not configured
  expect(result.currencyCodeColumn).toBeUndefined();
});

test('should handle empty data gracefully in AUTO mode', () => {
  const autoFormData = {
    ...formData,
    currencyFormat: { symbol: 'AUTO', symbolPosition: 'prefix' },
  };
  const autoChartProps = new ChartProps<QueryFormData>({
    formData: autoFormData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [],
        colnames: ['country', 'currency', 'revenue'],
        coltypes: [1, 1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: {
      verboseMap: {},
      columnFormats: {},
      currencyCodeColumn: 'currency',
    },
    theme: supersetTheme,
  });

  const result = transformProps(autoChartProps);
  expect(result.currencyFormat).toEqual({
    symbol: 'AUTO',
    symbolPosition: 'prefix',
  });
  expect(result.currencyCodeColumn).toBe('currency');
});

test('should preserve static currency format when not using AUTO mode', () => {
  const staticFormData = {
    ...formData,
    currencyFormat: { symbol: 'EUR', symbolPosition: 'suffix' },
  };
  const staticChartProps = new ChartProps<QueryFormData>({
    formData: staticFormData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { country: 'USA', currency: 'USD', revenue: 100 },
          { country: 'UK', currency: 'GBP', revenue: 200 },
        ],
        colnames: ['country', 'currency', 'revenue'],
        coltypes: [1, 1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: {
      verboseMap: {},
      columnFormats: {},
      currencyCodeColumn: 'currency',
    },
    theme: supersetTheme,
  });

  const result = transformProps(staticChartProps);
  expect(result.currencyFormat).toEqual({
    symbol: 'EUR',
    symbolPosition: 'suffix',
  });
});

test('should map conditional formatting rules to metricColorFormatters with correct colors', () => {
  const formattingFormData = {
    ...formData,
    conditionalFormatting: [
      {
        colorScheme: '#ACE1C4',
        column: 'country',
        operator: '=',
        targetValue: 'country',
      },
      {
        colorScheme: '#5ac189',
        column: 'revenue',
        operator: '=',
        targetValue: 'revenue',
      },
    ],
  };
  const formattingChartProps = new ChartProps<QueryFormData>({
    formData: formattingFormData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { country: 'USA', currency: 'USD', revenue: 100 },
          { country: 'UK', currency: 'GBP', revenue: 200 },
        ],
        colnames: ['country', 'currency', 'revenue'],
        coltypes: [1, 1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: {
      verboseMap: {},
      columnFormats: {},
      currencyCodeColumn: 'currency',
    },
    theme: supersetTheme,
  });

  const result = transformProps(formattingChartProps);
  const column1Formatting = result.metricColorFormatters[0].column;
  const column2Formatting = result.metricColorFormatters[1].column;
  expect(
    result.metricColorFormatters[0].getColorFromValue(column1Formatting),
  ).toEqual('#ACE1C4FF');
  expect(
    result.metricColorFormatters[1].getColorFromValue(column2Formatting),
  ).toEqual('#5ac189FF');
});
