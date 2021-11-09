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
import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
  formatSelectOptions,
  sections,
} from '@superset-ui/chart-controls';
import React from 'react';
import { headerFontSize, subheaderFontSize } from '../sharedControls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['metric'], ['adhoc_filters']],
    },
    {
      label: t('Options'),
      tabOverride: 'data',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'compare_lag',
            config: {
              type: 'TextControl',
              label: t('Comparison Period Lag'),
              isInt: true,
              description: t(
                'Based on granularity, number of time periods to compare against',
              ),
            },
          },
        ],
        [
          {
            name: 'compare_suffix',
            config: {
              type: 'TextControl',
              label: t('Comparison suffix'),
              description: t('Suffix to apply after the percentage display'),
            },
          },
        ],
        ['y_axis_format'],
        [
          {
            name: 'time_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Timestamp format'),
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: D3_FORMAT_DOCS,
            },
          },
        ],
        [
          {
            name: 'show_timestamp',
            config: {
              type: 'CheckboxControl',
              label: t('Show Timestamp'),
              renderTrigger: true,
              default: false,
              description: t('Whether to display the timestamp'),
            },
          },
        ],
        [
          {
            name: 'show_trend_line',
            config: {
              type: 'CheckboxControl',
              label: t('Show Trend Line'),
              renderTrigger: true,
              default: true,
              description: t('Whether to display the trend line'),
            },
          },
        ],
        [
          {
            name: 'start_y_axis_at_zero',
            config: {
              type: 'CheckboxControl',
              label: t('Start y-axis at 0'),
              renderTrigger: true,
              default: true,
              description: t(
                'Start y-axis at zero. Uncheck to start y-axis at minimum value in the data.',
              ),
            },
          },
        ],
        [
          {
            name: 'time_range_fixed',
            config: {
              type: 'CheckboxControl',
              label: t('Fix to selected Time Range'),
              description: t(
                'Fix the trend line to the full time range specified in case filtered results do not include the start or end dates',
              ),
              renderTrigger: true,
              visibility(props) {
                const { time_range: timeRange } = props.form_data;
                // only display this option when a time range is selected
                return !!timeRange && timeRange !== 'No filter';
              },
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_picker', null],
        [headerFontSize],
        [subheaderFontSize],
      ],
    },
    {
      label: t('Advanced Analytics'),
      expanded: false,
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
        ],
        [
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
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
  },
};

export default config;
