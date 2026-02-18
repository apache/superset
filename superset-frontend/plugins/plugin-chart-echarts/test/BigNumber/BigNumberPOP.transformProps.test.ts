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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import transformProps from '../../src/BigNumber/BigNumberPeriodOverPeriod/transformProps';

const baseChartProps = {
  width: 200,
  height: 500,
  formData: {
    metric: 'value',
    yAxisFormat: '.3s',
    datasource: '1__table',
    headerFontSize: 0.4,
    metricNameFontSize: 0.15,
    subheaderFontSize: 0.15,
  },
  queriesData: [
    {
      data: [{ value: 1234 }],
      colnames: ['value'],
      coltypes: [0],
    },
  ],
  theme: supersetTheme,
  datasource: {
    currencyFormats: {},
    columnFormats: {},
  },
};

test('should use localized subtitle when translations and locale are provided', () => {
  const chartProps = new ChartProps({
    ...baseChartProps,
    formData: {
      ...baseChartProps.formData,
      subtitle: 'Revenue overview',
      translations: {
        subtitle: { de: 'Umsatzübersicht' },
      },
    },
    locale: 'de',
  });
  const transformed = transformProps(chartProps);
  expect(transformed.subtitle).toBe('Umsatzübersicht');
});

test('should use original subtitle when no locale is provided', () => {
  const chartProps = new ChartProps({
    ...baseChartProps,
    formData: {
      ...baseChartProps.formData,
      subtitle: 'Revenue overview',
      translations: {
        subtitle: { de: 'Umsatzübersicht' },
      },
    },
  });
  const transformed = transformProps(chartProps);
  expect(transformed.subtitle).toBe('Revenue overview');
});

test('should fall back to base language for regional locale', () => {
  const chartProps = new ChartProps({
    ...baseChartProps,
    formData: {
      ...baseChartProps.formData,
      subtitle: 'Revenue overview',
      translations: {
        subtitle: { de: 'Umsatzübersicht' },
      },
    },
    locale: 'de-AT',
  });
  const transformed = transformProps(chartProps);
  expect(transformed.subtitle).toBe('Umsatzübersicht');
});
