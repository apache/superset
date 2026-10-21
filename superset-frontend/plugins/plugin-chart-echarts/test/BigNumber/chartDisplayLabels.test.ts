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
import { ChartProps, VizType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { withChartDisplayLabels } from 'src/dashboard/util/withChartDisplayLabels';
import transformTotal from '../../src/BigNumber/BigNumberTotal/transformProps';
import transformTrendline from '../../src/BigNumber/BigNumberWithTrendline/transformProps';
import transformPeriodOverPeriod from '../../src/BigNumber/BigNumberPeriodOverPeriod/transformProps';
import type {
  BigNumberTotalChartProps,
  BigNumberWithTrendlineChartProps,
} from '../../src/BigNumber/types';
import { getOriginalLabel } from '../../src/BigNumber/utils';

const transforms = [
  ['total', transformTotal],
  ['trendline', transformTrendline],
  ['period over period', transformPeriodOverPeriod],
] as const;

test.each(transforms)(
  '%s shows authorized saved-metric labels without dataset metadata',
  (name, transformProps) => {
    const datasource = {
      chart_display_labels: {
        '12': { sum__SP_POP_TOTL: 'Population' },
        '13': { sum__SP_POP_TOTL: 'Other chart label' },
      },
    };
    const data = [{ sum__SP_POP_TOTL: 1000, __timestamp: 0 }];
    const chartProps = new ChartProps({
      datasource: withChartDisplayLabels(datasource, 12),
      formData: {
        datasource: '1__table',
        viz_type: VizType.BigNumber,
        metric: 'sum__SP_POP_TOTL',
        show_metric_name: true,
        x_axis: '__timestamp',
        y_axis_format: '.0f',
      },
      queriesData: [{ data }],
      theme: supersetTheme,
    });

    const result = transformProps(
      chartProps as unknown as BigNumberTotalChartProps &
        BigNumberWithTrendlineChartProps,
    );

    expect(chartProps.datasource.metrics).toBeUndefined();
    expect(result.metricName).toBe('Population');
    expect(result.showMetricName).toBe(true);
    expect(result.bigNumber).toEqual(
      name === 'period over period' ? '1000' : 1000,
    );
    expect(chartProps.queriesData[0].data).toEqual([
      { sum__SP_POP_TOTL: 1000, __timestamp: 0 },
    ]);
    expect(chartProps.rawFormData.metric).toBe('sum__SP_POP_TOTL');
  },
);

test('uses the verbose map when a saved metric has no verbose name', () => {
  expect(
    getOriginalLabel(
      'sum__SP_POP_TOTL',
      [{ metric_name: 'sum__SP_POP_TOTL', uuid: 'metric-uuid' }],
      { sum__SP_POP_TOTL: 'Population' },
    ),
  ).toBe('Population');
});

test.each(['sum__SP_POP_TOTL', 'constructor', '__proto__', 'toString'])(
  'falls back to the raw saved metric %s without a display label',
  metric => {
    expect(getOriginalLabel(metric)).toBe(metric);
  },
);

test('uses configured labels for prototype-like saved metric names', () => {
  expect(
    getOriginalLabel('constructor', [], { constructor: 'Population' }),
  ).toBe('Population');
});

test('ignores a non-string verbose map entry', () => {
  expect(
    getOriginalLabel('sum__SP_POP_TOTL', [], {
      sum__SP_POP_TOTL: 123,
    } as unknown as Record<string, string>),
  ).toBe('sum__SP_POP_TOTL');
});

test.each(transforms)(
  '%s preserves existing metric metadata over chart display labels',
  (_name, transformProps) => {
    const chartProps = new ChartProps({
      datasource: withChartDisplayLabels(
        {
          metrics: [
            {
              metric_name: 'sum__SP_POP_TOTL',
              verbose_name: 'Dataset population',
            },
          ],
          chart_display_labels: { '12': { sum__SP_POP_TOTL: 'Population' } },
        },
        12,
      ),
      formData: {
        datasource: '1__table',
        viz_type: VizType.BigNumber,
        metric: 'sum__SP_POP_TOTL',
        show_metric_name: true,
      },
      queriesData: [{ data: [] }],
      theme: supersetTheme,
    });

    const result = transformProps(
      chartProps as unknown as BigNumberTotalChartProps &
        BigNumberWithTrendlineChartProps,
    );

    expect(result.metricName).toBe('Dataset population');
  },
);
