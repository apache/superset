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
import { t, RollingType, ComparisonType } from '@superset-ui/core';

import { ControlSubSectionHeader } from '../components/ControlSubSectionHeader';
import { ControlPanelSectionConfig } from '../types';
import { formatSelectOptions, displayTimeRelatedControls } from '../utils';

export const advancedAnalyticsControls: ControlPanelSectionConfig = {
  label: t('Advanced analytics'),
  tabOverride: 'data',
  description: t(
    'This section contains options ' +
      'that allow for advanced analytical post processing ' +
      'of query results',
  ),
  visibility: displayTimeRelatedControls,
  controlSetRows: [
    [<ControlSubSectionHeader>{t('Rolling window')}</ControlSubSectionHeader>],
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
          visibility: ({ controls }, { name }) => {
            // `rolling_type_b` refer to rolling_type in mixed timeseries Query B
            const rollingTypeControlName = name.endsWith('_b')
              ? 'rolling_type_b'
              : 'rolling_type';
            return (
              Boolean(controls[rollingTypeControlName]?.value) &&
              controls[rollingTypeControlName]?.value !== RollingType.Cumsum
            );
          },
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
          visibility: ({ controls }, { name }) => {
            // `rolling_type_b` refer to rolling_type in mixed timeseries Query B
            const rollingTypeControlName = name.endsWith('_b')
              ? 'rolling_type_b'
              : 'rolling_type';
            return (
              Boolean(controls[rollingTypeControlName]?.value) &&
              controls[rollingTypeControlName]?.value !== RollingType.Cumsum
            );
          },
        },
      },
    ],
    [<ControlSubSectionHeader>{t('Time comparison')}</ControlSubSectionHeader>],
    [
      {
        name: 'time_compare',
        config: {
          type: 'SelectControl',
          multi: true,
          freeForm: true,
          label: t('Time shift'),
          choices: [
            ['1 day ago', t('1 day ago')],
            ['1 week ago', t('1 week ago')],
            ['28 days ago', t('28 days ago')],
            ['30 days ago', t('30 days ago')],
            ['52 weeks ago', t('52 weeks ago')],
            ['1 year ago', t('1 year ago')],
            ['104 weeks ago', t('104 weeks ago')],
            ['2 years ago', t('2 years ago')],
            ['156 weeks ago', t('156 weeks ago')],
            ['3 years ago', t('3 years ago')],
          ],
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
            [ComparisonType.Values, t('Actual values')],
            [ComparisonType.Difference, t('Difference')],
            [ComparisonType.Percentage, t('Percentage change')],
            [ComparisonType.Ratio, t('Ratio')],
          ],
          description: t(
            'How to display time shifts: as individual lines; as the ' +
              'difference between the main time series and each time shift; ' +
              'as the percentage change; or as the ratio between series and time shifts.',
          ),
        },
      },
    ],
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
            ['1T', t('1 minutely frequency')],
            ['1H', t('1 hourly frequency')],
            ['1D', t('1 calendar day frequency')],
            ['7D', t('7 calendar day frequency')],
            ['1MS', t('1 month start frequency')],
            ['1M', t('1 month end frequency')],
            ['1AS', t('1 year start frequency')],
            ['1A', t('1 year end frequency')],
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
          label: t('Fill method'),
          default: null,
          choices: [
            ['asfreq', t('Null imputation')],
            ['zerofill', t('Zero imputation')],
            ['linear', t('Linear interpolation')],
            ['ffill', t('Forward values')],
            ['bfill', t('Backward values')],
            ['median', t('Median values')],
            ['mean', t('Mean values')],
            ['sum', t('Sum values')],
          ],
          description: t('Pandas resample method'),
        },
      },
    ],
  ],
};
