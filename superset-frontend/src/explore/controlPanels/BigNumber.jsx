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
import { t } from '@superset-ui/translation';
import React from 'react';
import { headerFontSize, subheaderFontSize } from './Shared_BigNumber';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['metric'], ['adhoc_filters']],
    },
    {
      label: t('Options'),
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
            name: 'show_trend_line',
            config: {
              type: 'CheckboxControl',
              label: t('Show Trend Line'),
              renderTrigger: true,
              default: true,
              description: t('Whether to display the trend line'),
            },
          },
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
        ['time_range_fixed'],
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
        [<h1 className="section-header">{t('Rolling Window')}</h1>],
        ['rolling_type', 'rolling_periods', 'min_periods'],
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
  },
  sectionOverrides: {
    druidTimeSeries: {
      controlSetRows: [['granularity', 'druid_time_origin'], ['time_range']],
    },
    sqlaTimeSeries: {
      controlSetRows: [['granularity_sqla', 'time_grain_sqla'], ['time_range']],
    },
  },
};
