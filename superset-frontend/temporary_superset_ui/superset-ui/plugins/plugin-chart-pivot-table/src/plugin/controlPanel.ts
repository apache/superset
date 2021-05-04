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
import { FeatureFlag, isFeatureEnabled, t, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  formatSelectOptions,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    { ...sections.legacyTimeseriesTime, expanded: false },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupbyRows',
            config: {
              ...sharedControls.groupby,
              label: t('Rows'),
              description: t('Columns to group by on the rows'),
            },
          },
        ],
        [
          {
            name: 'groupbyColumns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Columns to group by on the columns'),
            },
          },
        ],
        [
          {
            name: 'metrics',
            config: {
              ...sharedControls.metrics,
              validators: [validateNonEmpty],
            },
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: {
              ...sharedControls.row_limit,
            },
          },
        ],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      tabOverride: 'data',
      controlSetRows: [
        [
          {
            name: 'aggregateFunction',
            config: {
              type: 'SelectControl',
              label: t('Aggregation function'),
              clearable: false,
              choices: formatSelectOptions([
                'Count',
                'Count Unique Values',
                'List Unique Values',
                'Sum',
                'Average',
                'Median',
                'Sample Variance',
                'Sample Standard Deviation',
                'Minimum',
                'Maximum',
                'First',
                'Last',
                'Sum as Fraction of Total',
                'Sum as Fraction of Rows',
                'Sum as Fraction of Columns',
                'Count as Fraction of Total',
                'Count as Fraction of Rows',
                'Count as Fraction of Columns',
              ]),
              default: 'Sum',
              description: t(
                'Aggregate function to apply when pivoting and computing the total rows and columns',
              ),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'transposePivot',
            config: {
              type: 'CheckboxControl',
              label: t('Transpose pivot'),
              default: false,
              description: t('Swap rows and columns'),
              renderTrigger: true,
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
            name: 'valueFormat',
            config: { ...sharedControls.y_axis_format, label: t('Value format') },
          },
        ],
        [
          {
            name: 'tableRenderer',
            config: {
              type: 'SelectControl',
              label: t('Pivot table type'),
              default: 'Table With Subtotal',
              choices: [
                // [value, label]
                ['Table With Subtotal', t('Table')],
                ['Table With Subtotal Heatmap', t('Table Heatmap')],
                ['Table With Subtotal Col Heatmap', t('Table Col Heatmap')],
                ['Table With Subtotal Row Heatmap', t('Table Row Heatmap')],
                ['Table With Subtotal Barchart', t('Table Barchart')],
                ['Table With Subtotal Col Barchart', t('Table Col Barchart')],
                ['Table With Subtotal Row Barchart', t('Table Row Barchart')],
              ],
              renderTrigger: true,
              description: t('The type of pivot table visualization'),
            },
          },
        ],
        [
          {
            name: 'rowOrder',
            config: {
              type: 'SelectControl',
              label: t('Rows sort by'),
              default: 'key_a_to_z',
              choices: [
                // [value, label]
                ['key_a_to_z', t('key a-z')],
                ['key_z_to_a', t('key z-a')],
                ['value_a_to_z', t('value ascending')],
                ['value_z_to_a', t('value descending')],
              ],
              renderTrigger: true,
              description: t('Order of rows'),
            },
          },
          {
            name: 'colOrder',
            config: {
              type: 'SelectControl',
              label: t('Cols sort by'),
              default: 'key_a_to_z',
              choices: [
                // [value, label]
                ['key_a_to_z', t('key a-z')],
                ['key_z_to_a', t('key z-a')],
                ['value_a_to_z', t('value ascending')],
                ['value_z_to_a', t('value descending')],
              ],
              renderTrigger: true,
              description: t('Order of columns'),
            },
          },
        ],
        [
          {
            name: 'rowSubtotalPosition',
            config: {
              type: 'SelectControl',
              label: t('Rows subtotals position'),
              default: false,
              choices: [
                // [value, label]
                [true, t('Top')],
                [false, t('Bottom')],
              ],
              renderTrigger: true,
              description: t('Position of row level subtotals'),
            },
          },
          {
            name: 'colSubtotalPosition',
            config: {
              type: 'SelectControl',
              label: t('Cols subtotals position'),
              default: false,
              choices: [
                // [value, label]
                [true, t('Left')],
                [false, t('Right')],
              ],
              renderTrigger: true,
              description: t('Position of column level subtotals'),
            },
          },
        ],
        [
          {
            name: 'rowTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show rows totals'),
              default: true,
              renderTrigger: true,
              description: t('Display row level totals'),
            },
          },
          {
            name: 'colTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show cols totals'),
              default: true,
              renderTrigger: true,
              description: t('Display column level totals'),
            },
          },
        ],
        isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)
          ? [
              {
                name: 'emitFilter',
                config: {
                  type: 'CheckboxControl',
                  label: t('Enable emitting filters'),
                  renderTrigger: true,
                  default: false,
                  description: t(
                    'Whether to apply filter to dashboards when table cells are clicked',
                  ),
                },
              },
            ]
          : [],
      ],
    },
  ],
};

export default config;
