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
import { t } from '@superset-ui/core';
import {
  ControlPanelSectionConfig,
  ControlSubSectionHeader,
} from '@superset-ui/chart-controls';

export const datasourceAndVizType: ControlPanelSectionConfig = {
  controlSetRows: [
    ['datasource'],
    ['viz_type'],
    [
      {
        name: 'slice_id',
        config: {
          type: 'HiddenControl',
          label: t('Chart ID'),
          hidden: true,
          description: t('The id of the active chart'),
        },
      },
      {
        name: 'cache_timeout',
        config: {
          type: 'HiddenControl',
          label: t('Cache Timeout (seconds)'),
          hidden: true,
          description: t('The number of seconds before expiring the cache'),
        },
      },
      {
        name: 'url_params',
        config: {
          type: 'HiddenControl',
          label: t('URL parameters'),
          hidden: true,
          description: t('Extra parameters for use in jinja templated queries'),
        },
      },
    ],
  ],
};

export const colorScheme: ControlPanelSectionConfig = {
  label: t('Color scheme'),
  controlSetRows: [['color_scheme']],
};

export const sqlaTimeSeries: ControlPanelSectionConfig = {
  label: t('Time'),
  description: t('Time related form attributes'),
  expanded: true,
  controlSetRows: [['granularity_sqla'], ['time_range']],
};

export const annotations: ControlPanelSectionConfig = {
  label: t('Annotations and layers'),
  tabOverride: 'data',
  expanded: true,
  controlSetRows: [
    [
      {
        name: 'annotation_layers',
        config: {
          type: 'AnnotationLayerControl',
          label: '',
          default: [],
          description: t('Annotation layers'),
          renderTrigger: true,
          tabOverride: 'data',
        },
      },
    ],
  ],
};

export const NVD3TimeSeries: ControlPanelSectionConfig[] = [
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
      ['metrics'],
      ['adhoc_filters'],
      ['groupby'],
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
  },
  {
    label: t('Advanced analytics'),
    tabOverride: 'data',
    description: t(
      'This section contains options ' +
        'that allow for advanced analytical post processing ' +
        'of query results',
    ),
    controlSetRows: [
      [
        <ControlSubSectionHeader>
          {t('Rolling window')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'rolling_type',
          config: {
            type: 'SelectControl',
            label: t('Rolling function'),
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
            label: t('Min periods'),
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
      [
        <ControlSubSectionHeader>
          {t('Time comparison')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'time_compare',
          config: {
            type: 'SelectControl',
            multi: true,
            freeForm: true,
            label: t('Time shift'),
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
                'in natural language (example: 24 hours, 7 days, ' +
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
              ['values', t('Actual values')],
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
];
