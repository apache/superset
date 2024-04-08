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
import { t, ComparisonType } from '@superset-ui/core';

import { ControlPanelSectionConfig } from '../types';

export const timeComparisonControls: ControlPanelSectionConfig = {
  label: t('Time Comparison'),
  tabOverride: 'data',
  description: t(
    'This section contains options ' +
      'that allow for time comparison ' +
      'of query results using some portions of the ' +
      'existing advanced analytics section',
  ),
  controlSetRows: [
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
    ['time_grain_sqla'],
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
  ],
};
