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
import { GenericDataType } from '@apache-superset/core/common';
import transformProps from '../src/transformProps';
import { DataColumnMeta, TableChartProps } from '../src/types';
import testData from './testData';

const AUTO_CURRENCY = { symbol: 'AUTO', symbolPosition: 'prefix' as const };

/**
 * A Table chart with Time Comparison enabled and a metric whose currency is set
 * to "Auto-detect". The currency code column is configured on the dataset but is
 * deliberately NOT part of the query result, so the only way AUTO can resolve is
 * via the backend-supplied `detected_currency`.
 *
 * `Main` carries no column_config of its own, so it reuses the parent column's
 * already-resolved formatter. `#` and `△` carry a d3NumberFormat, which makes
 * getComparisonColFormatter rebuild their formatter from the raw currency config.
 */
const buildAutoCurrencyComparisonProps = (
  detectedCurrency: string | null = 'GBP',
  colnames: string[] = ['metric_1', 'metric_1__1 year ago'],
): TableChartProps => ({
  ...testData.comparisonWithConfig,
  rawFormData: {
    ...testData.comparisonWithConfig.rawFormData,
    metrics: ['metric_1'],
    percent_metrics: [],
    column_config: {
      metric_1: { currencyFormat: AUTO_CURRENCY },
      '# metric_1': { d3NumberFormat: ',.1f' },
      '△ metric_1': { d3NumberFormat: ',.1f' },
    },
  },
  datasource: {
    ...testData.comparisonWithConfig.datasource,
    columnFormats: {},
    currencyFormats: { metric_1: AUTO_CURRENCY },
    currencyCodeColumn: 'currency_code',
    verboseMap: { metric_1: 'Metric 1' },
  },
  queriesData: [
    {
      ...testData.comparisonWithConfig.queriesData[0],
      data: [{ metric_1: 100, 'metric_1__1 year ago': 80 }],
      colnames,
      coltypes: colnames.map(() => GenericDataType.Numeric),
      detected_currency: detectedCurrency,
    },
    testData.comparisonWithConfig.queriesData[1],
  ],
});

const getColumn = (props: TableChartProps, key: string): DataColumnMeta => {
  const { columns } = transformProps(props);
  const column = columns.find((col: DataColumnMeta) => col.key === key);
  if (!column) {
    throw new Error(
      `column "${key}" not found; got: ${columns
        .map((col: DataColumnMeta) => col.key)
        .join(', ')}`,
    );
  }
  return column;
};

test('resolves AUTO currency on time comparison columns when the currency code column is not in the query result', () => {
  const props = buildAutoCurrencyComparisonProps();

  // The parent column already resolves AUTO today - this is the behaviour the
  // reporter sees working, and it must keep working.
  expect(getColumn(props, 'Main metric_1').formatter?.(100)).toContain('£');

  // The comparison columns rebuild their formatter and must resolve AUTO too.
  expect(getColumn(props, '# metric_1').formatter?.(20)).toContain('£');
  expect(getColumn(props, '△ metric_1').formatter?.(20)).toContain('£');
});

test('leaves AUTO currency unresolved on time comparison columns so per-row lookup wins when the currency code column is in the query result', () => {
  const props = buildAutoCurrencyComparisonProps('GBP', [
    'metric_1',
    'metric_1__1 year ago',
    'currency_code',
  ]);

  // With the currency column queried, formatting is resolved per row at render
  // time, so the formatter itself must stay in AUTO mode (no baked-in symbol).
  expect(getColumn(props, '# metric_1').formatter?.(20)).not.toContain('£');
});

test('leaves the percent comparison column as a plain number formatter', () => {
  const props = buildAutoCurrencyComparisonProps();

  expect(getColumn(props, '% metric_1').formatter?.(0.2)).not.toContain('£');
});

test('does not invent a currency on time comparison columns when nothing was detected', () => {
  const props = buildAutoCurrencyComparisonProps(null);

  expect(getColumn(props, '# metric_1').formatter?.(20)).not.toContain('£');
});

/**
 * The currency lives only on the parent metric's own column_config - there is no
 * dataset-level currency to fall back on. The comparison column overrides just
 * the number format, which is enough to make getComparisonColFormatter rebuild
 * the formatter. The number format already falls back to the parent column, so
 * the currency has to as well, otherwise the rebuild silently drops it.
 */
const buildParentOnlyCurrencyProps = (): TableChartProps => ({
  ...testData.comparisonWithConfig,
  rawFormData: {
    ...testData.comparisonWithConfig.rawFormData,
    metrics: ['metric_1'],
    percent_metrics: [],
    column_config: {
      metric_1: { currencyFormat: AUTO_CURRENCY },
      '# metric_1': { d3NumberFormat: ',.1f' },
    },
  },
  datasource: {
    ...testData.comparisonWithConfig.datasource,
    columnFormats: {},
    currencyFormats: {},
    currencyCodeColumn: 'currency_code',
    verboseMap: { metric_1: 'Metric 1' },
  },
  queriesData: [
    {
      ...testData.comparisonWithConfig.queriesData[0],
      data: [{ metric_1: 100, 'metric_1__1 year ago': 80 }],
      colnames: ['metric_1', 'metric_1__1 year ago'],
      coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
      detected_currency: 'GBP',
    },
    testData.comparisonWithConfig.queriesData[1],
  ],
});

test('keeps the parent column currency on a time comparison column that only overrides the number format', () => {
  const props = buildParentOnlyCurrencyProps();

  // The parent resolves AUTO today; the comparison column must not lose it just
  // because it carries its own d3NumberFormat.
  expect(getColumn(props, 'Main metric_1').formatter?.(100)).toContain('£');
  expect(getColumn(props, '# metric_1').formatter?.(20)).toContain('£');
});
