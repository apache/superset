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
import { ChartProps, NumberFormats, VizType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformTotal from '../../src/BigNumber/BigNumberTotal/transformProps';
import transformTrendline from '../../src/BigNumber/BigNumberWithTrendline/transformProps';
import transformPeriodOverPeriod from '../../src/BigNumber/BigNumberPeriodOverPeriod/transformProps';
import type {
  BigNumberTotalChartProps,
  BigNumberWithTrendlineChartProps,
} from '../../src/BigNumber/types';

type NumberCase = {
  label: string;
  chartFormat?: string;
  metricFormat?: string | null;
  columnFormat?: string;
  currency?: string;
  detectedCurrency?: string | null;
  value: number;
  expected: string;
};

function makeProps(options: NumberCase): ChartProps {
  return new ChartProps({
    datasource: {
      metrics: [{ metric_name: 'value', d3format: options.metricFormat }],
      column_formats: options.columnFormat
        ? { value: options.columnFormat }
        : {},
    },
    formData: {
      datasource: '1__table',
      viz_type: VizType.BigNumber,
      metric: 'value',
      x_axis: '__timestamp',
      y_axis_format: options.chartFormat,
      time_compare: ['1 year ago'],
      percent_difference_format: '.2%',
      ...(options.currency && {
        currency_format: {
          symbol: options.currency,
          symbolPosition: 'prefix',
        },
      }),
    },
    queriesData: [
      {
        data: [{ __timestamp: 0, value: options.value }],
        detected_currency: options.detectedCurrency,
      },
    ],
    theme: supersetTheme,
  });
}

const numberCases: NumberCase[] = [
  {
    label: 'explicit integer format',
    chartFormat: ',d',
    metricFormat: '$,.2f',
    value: 1234.56,
    expected: '1,235',
  },
  {
    label: 'explicit percentage format',
    chartFormat: '.2%',
    metricFormat: '$,.2f',
    value: 0.125,
    expected: '12.50%',
  },
  {
    label: 'explicit smart format',
    chartFormat: NumberFormats.SMART_NUMBER,
    metricFormat: '.2f',
    value: 1234.56,
    expected: '1.23k',
  },
  {
    label: 'missing chart format',
    metricFormat: '.2f',
    value: 12.345,
    expected: '12.35',
  },
  {
    label: 'empty chart format',
    chartFormat: '',
    metricFormat: '.2f',
    value: 12.345,
    expected: '12.35',
  },
  {
    label: 'column format overridden by chart',
    chartFormat: ',d',
    columnFormat: '$,.2f',
    value: 1234.56,
    expected: '1,235',
  },
  {
    label: 'null metric format fallback',
    metricFormat: null,
    columnFormat: '.1f',
    value: 1234.56,
    expected: '1234.6',
  },
  {
    label: 'column format fallback',
    columnFormat: '.1f',
    value: 1234.56,
    expected: '1234.6',
  },
  {
    label: 'explicit format with static currency',
    chartFormat: '.1f',
    metricFormat: '.3f',
    currency: 'USD',
    value: 12.345,
    expected: '$ 12.3',
  },
  {
    label: 'explicit format with detected currency',
    chartFormat: '.1f',
    metricFormat: '.3f',
    currency: 'AUTO',
    detectedCurrency: 'EUR',
    value: 12.345,
    expected: '€ 12.3',
  },
  {
    label: 'explicit format with mixed currencies',
    chartFormat: '.1f',
    metricFormat: '.3f',
    currency: 'AUTO',
    detectedCurrency: null,
    value: 12.345,
    expected: '12.3',
  },
];

const headerTransforms = [
  ['total', transformTotal],
  ['trendline', transformTrendline],
] as const;

test.each(
  headerTransforms.flatMap(([name, transform]) =>
    numberCases.map(options => ({ name, transform, ...options })),
  ),
)('$name uses $label', ({ transform, ...options }) => {
  const result = transform(
    makeProps(options) as unknown as BigNumberTotalChartProps &
      BigNumberWithTrendlineChartProps,
  );
  expect(result.bigNumber).toBe(options.value);
  expect(result.headerFormatter(options.value)).toBe(options.expected);
});

test.each(numberCases)('period over period uses $label', options => {
  expect(transformPeriodOverPeriod(makeProps(options)).bigNumber).toBe(
    options.expected,
  );
});

test.each(headerTransforms)(
  '%s preserves forced date formatting',
  (_name, transform) => {
    const props = makeProps({
      label: 'date',
      chartFormat: ',d',
      metricFormat: '.2f',
      value: 1609459200000,
      expected: '',
    });
    props.formData.forceTimestampFormatting = true;
    props.formData.timeFormat = '%Y-%m-%d';
    const result = transform(
      props as unknown as BigNumberTotalChartProps &
        BigNumberWithTrendlineChartProps,
    );
    expect(result.headerFormatter(1609459200000)).toBe('2021-01-01');
  },
);

test('period over period formats both values and their difference consistently', () => {
  const props = makeProps({
    label: 'comparison',
    chartFormat: ',d',
    metricFormat: '$,.2f',
    value: 1234.56,
    expected: '1,235',
  });
  props.queriesData[0].data[0]['value__1 year ago'] = 1000;
  const result = transformPeriodOverPeriod(props);
  expect(result.bigNumber).toBe('1,235');
  expect(result.prevNumber).toBe('1,000');
  expect(result.valueDifference).toBe('235');
  expect(result.percentDifferenceFormattedString).toBe('23.46%');
});
