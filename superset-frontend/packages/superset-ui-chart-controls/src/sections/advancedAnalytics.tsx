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
import { t, RollingType, ComparisionType } from '@superset-ui/core';
import { ControlPanelSectionConfig } from '../types';
import { formatSelectOptions } from '../utils';

export const advancedAnalyticsControls: ControlPanelSectionConfig = {
  label: t('Advanced analytics'),
  tabOverride: 'data',
  description: t(
    'This section contains options ' +
      'that allow for advanced analytical post processing ' +
      'of query results',
  ),
  controlSetRows: [
    [<h1 className="section-header">{t('Rolling window')}</h1>],
    [
      {
        name: 'rolling_type',
        config: {
          type: 'SelectControl',
          label: t('Rolling function'),
          default: null,
          choices: [[null, t('None')]].concat(
            formatSelectOptions(Object.values(RollingType)),
          ),
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
          visibility: ({ controls }) =>
            Boolean(controls?.rolling_type?.value) &&
            controls.rolling_type.value !== RollingType.Cumsum,
        },
      },
    ],
    [
      {
        name: 'min_periods',
        config: {
          type: 'TextControl',
          label: t('Min periods'),
          isInt: true,
          description: t(
            'The minimum number of rolling periods required to show ' +
              'a value. For instance if you do a cumulative sum on 7 days ' +
              'you may want your "Min Period" to be 7, so that all data points ' +
              'shown are the total of 7 periods. This will hide the "ramp up" ' +
              'taking place over the first 7 periods',
          ),
          visibility: ({ controls }) =>
            Boolean(controls?.rolling_type?.value) &&
            controls.rolling_type.value !== RollingType.Cumsum,
        },
      },
    ],
    [<h1 className="section-header">{t('Time comparison')}</h1>],
    [
      {
        name: 'time_compare',
        config: {
          type: 'SelectControl',
          multi: true,
          freeForm: true,
          label: t('Time shift'),
          choices: formatSelectOptions([
            '1 day ago',
            '1 week ago',
            '28 days ago',
            '30 days ago',
            '52 weeks ago',
            '1 year ago',
            '104 weeks ago',
            '2 years ago',
          ]),
          description: t(
            'Overlay one or more timeseries from a ' +
              'relative time period. Expects relative time deltas ' +
              'in natural language (example:  24 hours, 7 days, ' +
              '52 weeks, 365 days). Free text is supported.',
          ),
        },
      },
    ],
    [
      {
        name: 'comparison_type',
        config: {
          type: 'SelectControl',
          label: t('Calculation type'),
          default: 'values',
          choices: [
            [ComparisionType.Values, 'Actual values'],
            [ComparisionType.Difference, 'Difference'],
            [ComparisionType.Percentage, 'Percentage change'],
            [ComparisionType.Ratio, 'Ratio'],
          ],
          description: t(
            'How to display time shifts: as individual lines; as the ' +
              'difference between the main time series and each time shift; ' +
              'as the percentage change; or as the ratio between series and time shifts.',
          ),
        },
      },
    ],
    [<h1 className="section-header">{t('Resample')}</h1>],
    [
      {
        name: 'resample_rule',
        config: {
          type: 'SelectControl',
          freeForm: true,
          label: t('Rule'),
          default: null,
          choices: [
            ['1T', '1 minutely frequency'],
            ['1H', '1 hourly frequency'],
            ['1D', '1 calendar day frequency'],
            ['7D', '7 calendar day frequency'],
            ['1MS', '1 month start frequency'],
            ['1M', '1 month end frequency'],
            ['1AS', '1 year start frequency'],
            ['1A', '1 year end frequency'],
          ],
          description: t('Pandas resample rule'),
        },
      },
    ],
    [
      {
        name: 'resample_method',
        config: {
          type: 'SelectControl',
          freeForm: true,
          label: t('Fill method'),
          default: null,
          choices: [
            ['asfreq', 'Null imputation'],
            ['zerofill', 'Zero imputation'],
            ['ffill', 'Forward values'],
            ['bfill', 'Backward values'],
            ['median', 'Median values'],
            ['mean', 'Mean values'],
            ['sum', 'Sum values'],
          ],
          description: t('Pandas resample method'),
        },
      },
    ],
  ],
};
