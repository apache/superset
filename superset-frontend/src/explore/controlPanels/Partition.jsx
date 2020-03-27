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
import { t } from '@superset-ui/translation';
import { NVD3TimeSeries } from './sections';
import OptionDescription from '../../components/OptionDescription';
import { nonEmpty } from '../validators';

export default {
  controlPanelSections: [
    NVD3TimeSeries[0],
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
              validators: [nonEmpty],
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
              optionRenderer: op => <OptionDescription option={op} />,
              valueRenderer: op => <OptionDescription option={op} />,
              description: t('Settings for time series'),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme', 'label_colors'],
        ['number_format', 'date_time_format'],
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
          'log_scale',
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
        ['rich_tooltip'],
      ],
    },
    NVD3TimeSeries[1],
  ],
};
