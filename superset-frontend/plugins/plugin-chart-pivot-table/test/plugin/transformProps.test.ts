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
import { MetricsLayoutEnum, QueryData } from '../../src/types';

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
  const result = transformProps(chartProps) as ReturnType<
    typeof transformProps
  >;
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
  result.data.forEach((level: QueryData) => {
    expect(level).toHaveProperty('groupby');
    expect(level).toHaveProperty('data');
  });
});

test('should pass through showValuesAs', () => {
  const cp = new ChartProps<QueryFormData>({
    formData: { ...formData, showValuesAs: 'percent_total' },
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

  const result = transformProps(cp) as ReturnType<typeof transformProps>;
  expect(result.showValuesAs).toBe('percent_total');
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

  const result = transformProps(cp) as ReturnType<typeof transformProps>;
  const grand = result.data.find(
    (d: QueryData) =>
      d.groupby.rows.length === 0 && d.groupby.columns.length === 0,
  )!;
  const leaf = result.data.find((d: QueryData) => d.groupby.rows.length === 1)!;
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
  const grand = result.data.find(
    (d: QueryData) =>
      d.groupby.rows.length === 0 && d.groupby.columns.length === 0,
  )!;
  expect(grand.data[0].v).toBe(15);
  // Leaf level keeps per-region values.
  const leaf = result.data.find((d: QueryData) => d.groupby.rows.length === 1)!;
  expect(leaf.data).toEqual([
    { region: 'US', v: 10 },
    { region: 'EU', v: 5 },
  ]);
});

test('conditional formatting scales over leaf cells only, not rollup totals', () => {
  const gm = (col: string) => `${col}__superset_grouping`;
  // `metrics` below is a plain string, i.e. a saved-metric reference.
  // `isAdditiveMetric` treats every string as non-additive no matter what it is
  // named, because form data does not reveal the aggregate behind a saved
  // metric -- so a saved metric labelled "SUM(sales)" (as in the report this
  // regression comes from) takes the non-additive path despite the name. That
  // path issues a single GROUPING SETS query whose result carries the rollup
  // levels alongside the leaf rows, so with both totals toggles on the grand
  // total (100) is part of that result.
  const row = (
    productLine: string | null,
    dealSize: string | null,
    sales: number,
  ) => ({
    product_line: productLine,
    deal_size: dealSize,
    'SUM(sales)': sales,
    [gm('product_line')]: productLine === null ? 1 : 0,
    [gm('deal_size')]: dealSize === null ? 1 : 0,
  });
  const totalsChartProps = new ChartProps<QueryFormData>({
    formData: {
      ...formData,
      combineMetric: false,
      transposePivot: false,
      metricsLayout: MetricsLayoutEnum.ROWS,
      groupbyRows: ['product_line'],
      groupbyColumns: ['deal_size'],
      metrics: ['SUM(sales)'],
      colTotals: true,
      rowTotals: true,
      conditionalFormatting: [
        {
          colorScheme: '#ACE1C4',
          column: 'SUM(sales)',
          operator: '>',
          targetValue: 0,
        },
      ],
    },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          // leaf cells
          row('Classic Cars', 'Small', 10),
          row('Classic Cars', 'Large', 20),
          row('Motorcycles', 'Small', 30),
          row('Motorcycles', 'Large', 40),
          // row totals
          row('Classic Cars', null, 30),
          row('Motorcycles', null, 70),
          // column totals
          row(null, 'Small', 40),
          row(null, 'Large', 60),
          // grand total
          row(null, null, 100),
        ],
        colnames: [
          'product_line',
          'deal_size',
          'SUM(sales)',
          gm('product_line'),
          gm('deal_size'),
        ],
        coltypes: [1, 1, 0, 0, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: supersetTheme,
  });

  const { getColorFromValue } =
    transformProps(totalsChartProps).metricColorFormatters[0];
  // The largest leaf cell must be fully saturated. Including the grand total
  // in the domain would stretch it to 100 and leave this cell washed out.
  expect(getColorFromValue(40)).toEqual('#ACE1C4FF');
});

test('conditional formatting on the additive path uses the raw leaf query rows', () => {
  // Counterpart to the test above for the additive fast path. Its query returns
  // the leaf rows only, so the domain is those rows verbatim -- deliberately not
  // the synthesized leaf level, whose reduction would coerce values through
  // `Number` and drop non-numeric ones.
  const additiveChartProps = new ChartProps<QueryFormData>({
    formData: {
      ...formData,
      combineMetric: false,
      transposePivot: false,
      metricsLayout: MetricsLayoutEnum.ROWS,
      groupbyRows: ['product_line'],
      groupbyColumns: ['deal_size'],
      metrics: [
        {
          expressionType: 'SIMPLE',
          aggregate: 'SUM',
          column: { column_name: 'sales' },
          label: 'SUM(sales)',
        },
      ],
      colTotals: true,
      rowTotals: true,
      conditionalFormatting: [
        {
          colorScheme: '#ACE1C4',
          column: 'SUM(sales)',
          operator: '>',
          targetValue: 0,
        },
      ],
    },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          {
            product_line: 'Classic Cars',
            deal_size: 'Small',
            'SUM(sales)': 10,
          },
          {
            product_line: 'Classic Cars',
            deal_size: 'Large',
            'SUM(sales)': 20,
          },
          { product_line: 'Motorcycles', deal_size: 'Small', 'SUM(sales)': 30 },
          { product_line: 'Motorcycles', deal_size: 'Large', 'SUM(sales)': 40 },
        ],
        colnames: ['product_line', 'deal_size', 'SUM(sales)'],
        coltypes: [1, 1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: supersetTheme,
  });

  const { getColorFromValue } =
    transformProps(additiveChartProps).metricColorFormatters[0];
  // Scale spans the leaf cells (max 40), never the client-side grand total 100.
  expect(getColorFromValue(40)).toEqual('#ACE1C4FF');
});
