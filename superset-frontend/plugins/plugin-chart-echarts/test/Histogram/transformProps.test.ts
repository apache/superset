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
import { ChartProps, SqlaFormData } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import transformProps from '../../src/Histogram/transformProps';
import { HistogramChartProps } from '../../src/Histogram/types';

const formData = {
  datasource: '1__table',
  viz_type: 'histogram',
  column: 'price',
  bins: 5,
  cumulative: false,
  normalize: false,
  colorScheme: 'bnbColors',
  showLegend: true,
  showValue: false,
  sliceId: 1,
  xAxisFormat: 'SMART_NUMBER',
  xAxisTitle: '',
  yAxisFormat: 'SMART_NUMBER',
  yAxisTitle: '',
  groupby: [],
};

const queriesData = [
  {
    data: [{ '0 - 10': 5, '10 - 20': 15, '20 - 30': 10 }],
  },
];

const chartPropsConfig = {
  formData,
  queriesData,
  theme: supersetTheme,
  datasource: {
    currencyFormats: {},
    columnFormats: {},
  },
};

test('should use localized axis titles when translations and locale are provided', () => {
  const chartProps = new ChartProps<SqlaFormData>({
    ...chartPropsConfig,
    formData: {
      ...formData,
      xAxisTitle: 'Revenue',
      yAxisTitle: 'Count',
      translations: {
        x_axis_title: { de: 'Umsatz' },
        y_axis_title: { de: 'Anzahl' },
      },
    },
    locale: 'de',
  });
  const transformed = transformProps(chartProps as HistogramChartProps);
  const xAxis = transformed.echartOptions.xAxis as { name?: string };
  const yAxis = transformed.echartOptions.yAxis as { name?: string };
  expect(xAxis.name).toBe('Umsatz');
  expect(yAxis.name).toBe('Anzahl');
});

test('should use original axis titles when no locale is provided', () => {
  const chartProps = new ChartProps<SqlaFormData>({
    ...chartPropsConfig,
    formData: {
      ...formData,
      xAxisTitle: 'Revenue',
      yAxisTitle: 'Count',
      translations: {
        x_axis_title: { de: 'Umsatz' },
        y_axis_title: { de: 'Anzahl' },
      },
    },
  });
  const transformed = transformProps(chartProps as HistogramChartProps);
  const xAxis = transformed.echartOptions.xAxis as { name?: string };
  const yAxis = transformed.echartOptions.yAxis as { name?: string };
  expect(xAxis.name).toBe('Revenue');
  expect(yAxis.name).toBe('Count');
});

test('should fall back to original axis titles when locale has no matching translation', () => {
  const chartProps = new ChartProps<SqlaFormData>({
    ...chartPropsConfig,
    formData: {
      ...formData,
      xAxisTitle: 'Revenue',
      yAxisTitle: 'Count',
      translations: {
        x_axis_title: { de: 'Umsatz' },
      },
    },
    locale: 'ja',
  });
  const transformed = transformProps(chartProps as HistogramChartProps);
  const xAxis = transformed.echartOptions.xAxis as { name?: string };
  const yAxis = transformed.echartOptions.yAxis as { name?: string };
  expect(xAxis.name).toBe('Revenue');
  expect(yAxis.name).toBe('Count');
});

test('should fall back to base language when regional locale has no match', () => {
  const chartProps = new ChartProps<SqlaFormData>({
    ...chartPropsConfig,
    formData: {
      ...formData,
      xAxisTitle: 'Revenue',
      translations: {
        x_axis_title: { de: 'Umsatz' },
      },
    },
    locale: 'de-AT',
  });
  const transformed = transformProps(chartProps as HistogramChartProps);
  const xAxis = transformed.echartOptions.xAxis as { name?: string };
  expect(xAxis.name).toBe('Umsatz');
});
