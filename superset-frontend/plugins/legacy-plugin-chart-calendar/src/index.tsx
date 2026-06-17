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

import { t } from '@apache-superset/core/translation';
import { getNumberFormatter } from '@superset-ui/core';
import {
  D3_FORMAT_DOCS,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import {
  defineChart,
  Int,
  Checkbox,
  TimeFormat,
} from '@superset-ui/glyph-core';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import { getFormattedUTCTime } from './utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactCalendar = require('./ReactCalendar').default;

type CalendarExtra = {
  timeFormatter: (ts: number | string) => string;
  valueFormatter: (val: unknown) => string;
  verboseMap: Record<string, string>;
  domainGranularity: string;
  subdomainGranularity: string;
  linearColorScheme: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<any, CalendarExtra>({
  metadata: {
    name: t('Calendar Heatmap'),
    description: t(
      "Visualizes how a metric has changed over a time using a color scale and a calendar view. Gray values are used to indicate missing values and the linear color scheme is used to encode the magnitude of each day's value.",
    ),
    category: t('Correlation'),
    credits: ['https://github.com/wa0x6e/cal-heatmap'],
    tags: [
      t('Business'),
      t('Comparison'),
      t('Intensity'),
      t('Pattern'),
      t('Report'),
      t('Trend'),
    ],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },
  arguments: {
    cell_size: Int.with({
      label: 'Cell Size',
      description: 'The size of the square cell, in pixels',
      default: 10,
      min: 1,
      max: 100,
    }),
    cell_padding: Int.with({
      label: 'Cell Padding',
      description: 'The distance between cells, in pixels',
      default: 2,
      min: 0,
      max: 20,
    }),
    cell_radius: Int.with({
      label: 'Cell Radius',
      description: 'The pixel radius',
      default: 0,
      min: 0,
      max: 50,
    }),
    steps: Int.with({
      label: 'Color Steps',
      description: 'The number color "steps"',
      default: 10,
      min: 1,
      max: 50,
    }),
    x_axis_time_format: TimeFormat.with({
      label: 'Time Format',
      description: D3_FORMAT_DOCS,
      default: 'smart_date',
    }),
    show_legend: Checkbox.with({
      label: 'Legend',
      description: 'Whether to display the legend (toggles)',
      default: true,
    }),
    show_values: Checkbox.with({
      label: 'Show Values',
      description: 'Whether to display the numerical values within the cells',
      default: false,
    }),
    show_metric_name: Checkbox.with({
      label: 'Show Metric Names',
      description: 'Whether to display the metric name as a title',
      default: true,
    }),
  },
  prependSections: [
    {
      label: t('Time'),
      expanded: true,
      description: t('Time related form attributes'),
      controlSetRows: [['granularity_sqla'], ['time_range']],
    },
  ],
  additionalControls: {
    queryBefore: [
      [
        {
          name: 'domain_granularity',
          config: {
            type: 'SelectControl',
            label: t('Domain'),
            default: 'month',
            choices: [
              ['hour', t('hour')],
              ['day', t('day')],
              ['week', t('week')],
              ['month', t('month')],
              ['year', t('year')],
            ],
            description: t('The time unit used for the grouping of blocks'),
          },
        },
        {
          name: 'subdomain_granularity',
          config: {
            type: 'SelectControl',
            label: t('Subdomain'),
            default: 'day',
            choices: [
              ['min', t('min')],
              ['hour', t('hour')],
              ['day', t('day')],
              ['week', t('week')],
              ['month', t('month')],
            ],
            description: t(
              'The time unit for each block. Should be a smaller unit than ' +
                'domain_granularity. Should be larger or equal to Time Grain',
            ),
          },
        },
      ],
      ['metrics'],
    ],
    chartOptions: [['linear_color_scheme'], ['y_axis_format']],
  },
  chartOptionsTabOverride: 'customize',
  additionalControlOverrides: {
    y_axis_format: {
      label: t('Number Format'),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
  }),
  transform: (chartProps, { x_axis_time_format }) => {
    const { formData, datasource } = chartProps;
    const {
      domainGranularity,
      subdomainGranularity,
      linearColorScheme,
      yAxisFormat,
    } = formData as Record<string, string>;

    const verboseMap =
      (datasource as { verboseMap?: Record<string, string> })?.verboseMap ?? {};
    const timeFormatter = (ts: number | string) =>
      getFormattedUTCTime(ts, x_axis_time_format as string);
    const valueFormatter = getNumberFormatter(yAxisFormat);

    return {
      timeFormatter,
      valueFormatter: valueFormatter as (val: unknown) => string,
      verboseMap,
      domainGranularity: domainGranularity ?? 'month',
      subdomainGranularity: subdomainGranularity ?? 'day',
      linearColorScheme: linearColorScheme ?? '',
    };
  },
  render: ({
    height,
    data,
    cell_size: cellSize,
    cell_padding: cellPadding,
    cell_radius: cellRadius,
    steps,
    show_legend: showLegend,
    show_values: showValues,
    show_metric_name: showMetricName,
    timeFormatter,
    valueFormatter,
    verboseMap,
    domainGranularity,
    subdomainGranularity,
    linearColorScheme,
  }) => (
    <ReactCalendar
      height={height}
      data={data}
      cellSize={cellSize}
      cellPadding={cellPadding}
      cellRadius={cellRadius}
      steps={steps}
      showLegend={showLegend}
      showValues={showValues}
      showMetricName={showMetricName}
      timeFormatter={timeFormatter}
      valueFormatter={valueFormatter}
      verboseMap={verboseMap}
      domainGranularity={domainGranularity}
      subdomainGranularity={subdomainGranularity}
      linearColorScheme={linearColorScheme}
    />
  ),
});
