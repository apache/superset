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
import React from 'react';
import { t, validateNonEmpty } from '@superset-ui/core';
import {
  ColumnMeta,
  ControlPanelConfig,
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  formatSelectOptions,
  sections,
} from '@superset-ui/chart-controls';
import OptionDescription from './OptionDescription';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['limit', 'timeseries_limit_metric'],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
            },
          },
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
    },
    {
      label: t('Time Series Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'time_series_option',
            config: {
              type: 'SelectControl',
              label: t('Options'),
              validators: [validateNonEmpty],
              default: 'not_time',
              valueKey: 'value',
              options: [
                {
                  label: t('Not Time Series'),
                  value: 'not_time',
                  description: t('Ignore time'),
                },
                {
                  label: t('Time Series'),
                  value: 'time_series',
                  description: t('Standard time series'),
                },
                {
                  label: t('Aggregate Mean'),
                  value: 'agg_mean',
                  description: t('Mean of values over specified period'),
                },
                {
                  label: t('Aggregate Sum'),
                  value: 'agg_sum',
                  description: t('Sum of values over specified period'),
                },
                {
                  label: t('Difference'),
                  value: 'point_diff',
                  description: t(
                    'Metric change in value from `since` to `until`',
                  ),
                },
                {
                  label: t('Percent Change'),
                  value: 'point_percent',
                  description: t(
                    'Metric percent change in value from `since` to `until`',
                  ),
                },
                {
                  label: t('Factor'),
                  value: 'point_factor',
                  description: t(
                    'Metric factor change from `since` to `until`',
                  ),
                },
                {
                  label: t('Advanced Analytics'),
                  value: 'adv_anal',
                  description: t('Use the Advanced Analytics options below'),
                },
              ],
              optionRenderer: (op: ColumnMeta) => (
                <OptionDescription option={op} />
              ),
              valueRenderer: (op: ColumnMeta) => (
                <OptionDescription option={op} />
              ),
              description: t('Settings for time series'),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
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
            name: 'partition_limit',
            config: {
              type: 'TextControl',
              label: t('Partition Limit'),
              isInt: true,
              default: '5',
              description: t(
                'The maximum number of subdivisions of each group; ' +
                  'lower values are pruned first',
              ),
            },
          },
          {
            name: 'partition_threshold',
            config: {
              type: 'TextControl',
              label: t('Partition Threshold'),
              isFloat: true,
              default: '0.05',
              description: t(
                'Partitions whose height to parent height proportions are ' +
                  'below this value are pruned',
              ),
            },
          },
        ],
        [
          {
            name: 'log_scale',
            config: {
              type: 'CheckboxControl',
              label: t('Log Scale'),
              default: false,
              renderTrigger: true,
              description: t('Use a log scale'),
            },
          },
        ],
        [
          {
            name: 'equal_date_size',
            config: {
              type: 'CheckboxControl',
              label: t('Equal Date Sizes'),
              default: true,
              renderTrigger: true,
              description: t(
                'Check to force date partitions to have the same height',
              ),
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
        ],
      ],
    },
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
        [<h1 className="section-header">{t('Rolling Window')}</h1>],
        [
          {
            name: 'rolling_type',
            config: {
              type: 'SelectControl',
              label: t('Rolling Function'),
              default: 'None',
              choices: formatSelectOptions([
                'None',
                'mean',
                'sum',
                'std',
                'cumsum',
              ]),
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
        [<h1 className="section-header">{t('Time Comparison')}</h1>],
        [
          {
            name: 'time_compare',
            config: {
              type: 'SelectControl',
              multi: true,
              freeForm: true,
              label: t('Time Shift'),
              choices: formatSelectOptions([
                '1 day',
                '1 week',
                '28 days',
                '30 days',
                '52 weeks',
                '1 year',
                '104 weeks',
                '2 years',
              ]),
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
                ['values', 'Actual Values'],
                ['absolute', 'Difference'],
                ['percentage', 'Percentage change'],
                ['ratio', 'Ratio'],
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
        [<h1 className="section-header">{t('Python Functions')}</h1>],
        // eslint-disable-next-line react/jsx-key
        [<h2 className="section-header">pandas.resample</h2>],
        [
          {
            name: 'resample_rule',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Rule'),
              default: null,
              choices: formatSelectOptions([
                '1T',
                '1H',
                '1D',
                '7D',
                '1M',
                '1AS',
              ]),
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
              choices: formatSelectOptions([
                'asfreq',
                'bfill',
                'ffill',
                'median',
                'mean',
                'sum',
              ]),
              description: t('Pandas resample method'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
