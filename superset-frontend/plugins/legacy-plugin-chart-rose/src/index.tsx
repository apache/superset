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
import { ChartProps } from '@superset-ui/core';
import {
  ControlSubSectionHeader,
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  sections,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import ReactRose from './ReactRose';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.jpg';
import example1Dark from './images/example1-dark.jpg';
import example2 from './images/example2.jpg';
import example2Dark from './images/example2-dark.jpg';

type RoseExtra = {
  colorScheme: string;
  dateTimeFormat: string;
  numberFormat: string;
  useAreaProportions: boolean;
  useRichTooltip: boolean;
  sliceId: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<any, RoseExtra>({
  metadata: {
    category: t('Ranking'),
    description: t(
      'A polar coordinate chart where the circle is broken into wedges of equal angle, and the value represented by any wedge is illustrated by its area, rather than its radius or sweep angle.',
    ),
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
    name: t('Nightingale Rose Chart'),
    tags: [
      t('Legacy'),
      t('Advanced-Analytics'),
      t('Circular'),
      t('Multi-Layers'),
      t('Pattern'),
      t('Time'),
      t('Trend'),
    ],
    thumbnail,
    thumbnailDark,
    useLegacyApi: true,
  },
  arguments: {},
  prependSections: [sections.legacyTimeseriesTime],
  additionalControls: {
    queryBefore: [['metrics'], ['adhoc_filters'], ['groupby']],
    query: [
      ['limit', 'timeseries_limit_metric'],
      ['order_desc'],
      [
        {
          name: 'contribution',
          config: {
            type: 'CheckboxControl',
            label: t('Contribution'),
            default: false,
            description: t('Compute the contribution to the total'),
          },
        },
      ],
      ['row_limit', null],
    ],
    chartOptions: [
      ['color_scheme'],
      [
        {
          name: 'number_format',
          config: {
            type: 'SelectControl',
            freeForm: true,
            label: t('Number format'),
            renderTrigger: true,
            default: 'SMART_NUMBER',
            choices: D3_FORMAT_OPTIONS,
            description: D3_FORMAT_DOCS,
          },
        },
        {
          name: 'date_time_format',
          config: {
            type: 'SelectControl',
            freeForm: true,
            label: t('Date Time Format'),
            renderTrigger: true,
            default: 'smart_date',
            choices: D3_TIME_FORMAT_OPTIONS,
            description: D3_FORMAT_DOCS,
          },
        },
      ],
      [
        {
          name: 'rich_tooltip',
          config: {
            type: 'CheckboxControl',
            label: t('Rich Tooltip'),
            renderTrigger: true,
            default: true,
            description: t(
              'The rich tooltip shows a list of all series for that point in time',
            ),
          },
        },
        {
          name: 'rose_area_proportion',
          config: {
            type: 'CheckboxControl',
            label: t('Use Area Proportions'),
            description: t(
              'Check if the Rose Chart should use segment area instead of ' +
                'segment radius for proportioning',
            ),
            default: false,
            renderTrigger: true,
          },
        },
      ],
    ],
  },
  additionalSections: [
    {
      label: t('Advanced Analytics'),
      tabOverride: 'data',
      description: t(
        'This section contains options ' +
          'that allow for advanced analytical post processing ' +
          'of query results',
      ),
      controlSetRows: [
        // eslint-disable-next-line react/jsx-key
        [
          <ControlSubSectionHeader>
            {t('Rolling Window')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'rolling_type',
            config: {
              type: 'SelectControl',
              label: t('Rolling Function'),
              default: 'None',
              choices: [
                ['None', t('None')],
                ['mean', t('mean')],
                ['sum', t('sum')],
                ['std', t('std')],
                ['cumsum', t('cumsum')],
              ],
              description: t(
                'Defines a rolling window function to apply, works along ' +
                  'with the [Periods] text box',
              ),
            },
          },
        ],
        [
          {
            name: 'rolling_periods',
            config: {
              type: 'TextControl',
              label: t('Periods'),
              isInt: true,
              description: t(
                'Defines the size of the rolling window function, ' +
                  'relative to the time granularity selected',
              ),
            },
          },
          {
            name: 'min_periods',
            config: {
              type: 'TextControl',
              label: t('Min Periods'),
              isInt: true,
              description: t(
                'The minimum number of rolling periods required to show ' +
                  'a value. For instance if you do a cumulative sum on 7 days ' +
                  'you may want your "Min Period" to be 7, so that all data points ' +
                  'shown are the total of 7 periods. This will hide the "ramp up" ' +
                  'taking place over the first 7 periods',
              ),
            },
          },
        ],
        // eslint-disable-next-line react/jsx-key
        [
          <ControlSubSectionHeader>
            {t('Time Comparison')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'time_compare',
            config: {
              type: 'SelectControl',
              multi: true,
              freeForm: true,
              label: t('Time Shift'),
              choices: [
                ['1 day', t('1 day')],
                ['1 week', t('1 week')],
                ['28 days', t('28 days')],
                ['30 days', t('30 days')],
                ['52 weeks', t('52 weeks')],
                ['1 year', t('1 year')],
                ['104 weeks', t('104 weeks')],
                ['2 years', t('2 years')],
                ['156 weeks', t('156 weeks')],
                ['3 years', t('3 years')],
              ],
              description: t(
                'Overlay one or more timeseries from a ' +
                  'relative time period. Expects relative time deltas ' +
                  'in natural language (example:  24 hours, 7 days, ' +
                  '52 weeks, 365 days). Free text is supported.',
              ),
            },
          },
          {
            name: 'comparison_type',
            config: {
              type: 'SelectControl',
              label: t('Calculation type'),
              default: 'values',
              choices: [
                ['values', t('Actual Values')],
                ['absolute', t('Difference')],
                ['percentage', t('Percentage change')],
                ['ratio', t('Ratio')],
              ],
              description: t(
                'How to display time shifts: as individual lines; as the ' +
                  'difference between the main time series and each time shift; ' +
                  'as the percentage change; or as the ratio between series and time shifts.',
              ),
            },
          },
        ],
        // eslint-disable-next-line react/jsx-key
        [<ControlSubSectionHeader>{t('Resample')}</ControlSubSectionHeader>],
        [
          {
            name: 'resample_rule',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Rule'),
              default: null,
              choices: [
                ['1T', t('1T')],
                ['1H', t('1H')],
                ['1D', t('1D')],
                ['7D', t('7D')],
                ['1M', t('1M')],
                ['1AS', t('1AS')],
              ],
              description: t('Pandas resample rule'),
            },
          },
          {
            name: 'resample_method',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Method'),
              default: null,
              choices: [
                ['asfreq', t('asfreq')],
                ['bfill', t('bfill')],
                ['ffill', t('ffill')],
                ['median', t('median')],
                ['mean', t('mean')],
                ['sum', t('sum')],
              ],
              description: t('Pandas resample method'),
            },
          },
        ],
      ],
    },
  ],
  formDataOverrides: formData => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metrics: getStandardizedControls().popAllMetrics(),
  }),
  transform: (chartProps: ChartProps) => {
    const { width, height, formData, queriesData } = chartProps;
    const {
      colorScheme,
      dateTimeFormat,
      numberFormat,
      richTooltip,
      roseAreaProportion,
      sliceId,
    } = formData as Record<string, unknown>;

    return {
      width,
      height,
      data: queriesData[0].data,
      colorScheme: (colorScheme as string) ?? '',
      dateTimeFormat: (dateTimeFormat as string) ?? 'smart_date',
      numberFormat: (numberFormat as string) ?? 'SMART_NUMBER',
      useAreaProportions: (roseAreaProportion as boolean) ?? false,
      useRichTooltip: (richTooltip as boolean) ?? true,
      sliceId: (sliceId as number) ?? 0,
    };
  },
  render: ({
    width,
    height,
    data,
    colorScheme,
    dateTimeFormat,
    numberFormat,
    useAreaProportions,
    useRichTooltip,
    sliceId,
  }) => (
    <ReactRose
      width={width}
      height={height}
      data={data}
      colorScheme={colorScheme}
      dateTimeFormat={dateTimeFormat}
      numberFormat={numberFormat}
      useAreaProportions={useAreaProportions}
      useRichTooltip={useRichTooltip}
      sliceId={sliceId}
    />
  ),
});
