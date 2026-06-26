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
import { supersetTheme } from '@apache-superset/core/theme';
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

test('should pass through formData props for viz', () => {
  const result = transformProps(chartProps) as any;
  expect(result.width).toBe(800);
  expect(result.height).toBe(600);
  expect(result.groupbyRows).toEqual(['row1', 'row2']);
  expect(result.groupbyColumns).toEqual(['col1', 'col2']);
  expect(result.metrics).toEqual(['metric1', 'metric2']);
  expect(result.metricsLayout).toBe(MetricsLayoutEnum.COLUMNS);
  expect(result.currencyFormat).toEqual({
    symbol: 'USD',
    symbolPosition: 'prefix',
  });
  // data is the per-level QueryData[] (split/synthesized), not raw rows.
  expect(Array.isArray(result.data)).toBe(true);
  result.data.forEach((level: any) => {
    expect(level).toHaveProperty('groupby');
    expect(level).toHaveProperty('data');
  });
});

test('non-additive: transformProps splits the GROUPING SETS result by level', () => {
  const gm = (col: string) => `${col}__superset_grouping`;
  const localFormData = {
    ...formData,
    combineMetric: false,
    transposePivot: false,
    metricsLayout: MetricsLayoutEnum.ROWS,
    groupbyRows: ['region'],
    groupbyColumns: [],
    colTotals: true,
    rowTotals: true,
    metrics: ['m'], // saved-metric string -> non-additive
  };
  const cp = new ChartProps<QueryFormData>({
    formData: localFormData as unknown as QueryFormData,
    width: 800,
    height: 600,
    queriesData: [
      {
        // One combined GROUPING SETS result: leaf rows (region marker 0) +
        // grand total row (region marker 1).
        data: [
          { region: 'US', m: 10, [gm('region')]: 0 },
          { region: 'EU', m: 5, [gm('region')]: 0 },
          { region: null, m: 15, [gm('region')]: 1 },
        ],
        colnames: ['region', 'm', gm('region')],
        coltypes: [1, 0, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: supersetTheme,
  });

  const result = transformProps(cp) as any;
  const grand = result.data.find(
    (d: any) => d.groupby.rows.length === 0 && d.groupby.columns.length === 0,
  );
  const leaf = result.data.find((d: any) => d.groupby.rows.length === 1);
  // Markers stripped; rows routed to the correct level.
  expect(grand.data).toEqual([{ region: null, m: 15 }]);
  expect(leaf.data).toEqual([
    { region: 'US', m: 10 },
    { region: 'EU', m: 5 },
  ]);
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

test('additive metrics: synthesizes rollup levels from a single leaf query', () => {
  const additiveFormData = {
    ...formData,
    combineMetric: false,
    transposePivot: false,
    metricsLayout: MetricsLayoutEnum.ROWS,
    groupbyRows: ['region'],
    groupbyColumns: [],
    colTotals: true,
    rowTotals: true,
    metrics: [
      {
        expressionType: 'SIMPLE',
        aggregate: 'SUM',
        column: { column_name: 'v' },
        label: 'v',
      },
    ],
  };
  const additiveChartProps = new ChartProps<QueryFormData>({
    formData: additiveFormData as unknown as QueryFormData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { region: 'US', v: 10 },
          { region: 'EU', v: 5 },
        ],
        colnames: ['region', 'v'],
        coltypes: [1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: supersetTheme,
  });

  const result = transformProps(additiveChartProps);
  // One query produced multiple synthesized rollup levels.
  expect(result.data.length).toBeGreaterThan(1);
  // Grand-total level: region collapsed -> v = 10 + 5 = 15.
  const grand = (result.data as any[]).find(
    d => d.groupby.rows.length === 0 && d.groupby.columns.length === 0,
  );
  expect(grand.data[0].v).toBe(15);
  // Leaf level keeps per-region values.
  const leaf = (result.data as any[]).find(d => d.groupby.rows.length === 1);
  expect(leaf.data).toEqual([
    { region: 'US', v: 10 },
    { region: 'EU', v: 5 },
  ]);
});
