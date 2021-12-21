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
  formatSelectOptions,
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  sections,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['columns'],
        ['row_limit', null],
        ['timeseries_limit_metric'],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
              visibility: ({ controls }) =>
                Boolean(controls?.timeseries_limit_metric.value),
            },
          },
        ],
      ],
    },
    {
      label: t('Pivot Options'),
      controlSetRows: [
        [
          {
            name: 'pandas_aggfunc',
            config: {
              type: 'SelectControl',
              label: t('Aggregation function'),
              clearable: false,
              choices: formatSelectOptions([
                'sum',
                'mean',
                'min',
                'max',
                'std',
                'var',
              ]),
              default: 'sum',
              description: t(
                'Aggregate function to apply when pivoting and ' +
                  'computing the total rows and columns',
              ),
            },
          },
          null,
        ],
        [
          {
            name: 'pivot_margins',
            config: {
              type: 'CheckboxControl',
              label: t('Show totals'),
              default: true,
              description: t('Display total row/column'),
            },
          },
          {
            name: 'combine_metric',
            config: {
              type: 'CheckboxControl',
              label: t('Combine Metrics'),
              default: false,
              description: t(
                'Display metrics side by side within each column, as ' +
                  'opposed to each column being displayed side by side for each metric.',
              ),
            },
          },
        ],
        [
          {
            name: 'transpose_pivot',
            config: {
              type: 'CheckboxControl',
              label: t('Transpose Pivot'),
              default: false,
              description: t('Swap Groups and Columns'),
            },
          },
        ],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
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
        ],
        [
          {
            name: 'date_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              default: 'smart_date',
              description: D3_FORMAT_DOCS,
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: { includeTime: true },
    columns: { includeTime: true },
  },
};

export default config;
