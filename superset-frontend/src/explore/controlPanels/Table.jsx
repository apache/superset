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
import { validateNonEmpty } from '@superset-ui/validator';
import { D3_TIME_FORMAT_OPTIONS } from '../controls';
import { formatSelectOptions } from '../../modules/utils';
import ColumnOption from '../../components/ColumnOption';

export default {
  controlPanelSections: [
    {
      label: t('GROUP BY'),
      description: t('Use this section if you want a query that aggregates'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metrics'],
        [
          {
            name: 'percent_metrics',
            config: {
              type: 'MetricsControl',
              multi: true,
              mapStateToProps: state => {
                const datasource = state.datasource;
                return {
                  columns: datasource ? datasource.columns : [],
                  savedMetrics: datasource ? datasource.metrics : [],
                  datasourceType: datasource && datasource.type,
                };
              },
              default: [],
              label: t('Percentage Metrics'),
              validators: [],
              description: t(
                'Metrics for which percentage of total are to be displayed',
              ),
            },
          },
        ],
        ['timeseries_limit_metric', 'row_limit'],
        [
          {
            name: 'include_time',
            config: {
              type: 'CheckboxControl',
              label: t('Include Time'),
              description: t(
                'Whether to include the time granularity as defined in the time section',
              ),
              default: false,
            },
          },
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
            },
          },
        ],
      ],
    },
    {
      label: t('NOT GROUPED BY'),
      description: t('Use this section if you want to query atomic rows'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'all_columns',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Columns'),
              default: [],
              description: t('Columns to display'),
              optionRenderer: c => <ColumnOption column={c} showType />,
              valueRenderer: c => <ColumnOption column={c} />,
              valueKey: 'column_name',
              allowAll: true,
              mapStateToProps: state => ({
                options: state.datasource ? state.datasource.columns : [],
              }),
              commaChoosesOption: false,
              freeForm: true,
            },
          },
        ],
        [
          {
            name: 'order_by_cols',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Ordering'),
              default: [],
              description: t('One or many metrics to display'),
              mapStateToProps: state => ({
                choices: state.datasource
                  ? state.datasource.order_by_choices
                  : [],
              }),
            },
          },
        ],
        ['row_limit', null],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['adhoc_filters']],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'table_timestamp_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Table Timestamp Format'),
              default: '%Y-%m-%d %H:%M:%S',
              renderTrigger: true,
              validators: [validateNonEmpty],
              clearable: false,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: t('Timestamp Format'),
            },
          },
        ],
        [
          {
            name: 'page_length',
            config: {
              type: 'SelectControl',
              freeForm: true,
              renderTrigger: true,
              label: t('Page Length'),
              default: 0,
              choices: formatSelectOptions([
                0,
                10,
                25,
                40,
                50,
                75,
                100,
                150,
                200,
              ]),
              description: t('Rows per page, 0 means no pagination'),
            },
          },
          null,
        ],
        [
          {
            name: 'include_search',
            config: {
              type: 'CheckboxControl',
              label: t('Search Box'),
              renderTrigger: true,
              default: false,
              description: t('Whether to include a client-side search box'),
            },
          },
          {
            name: 'table_filter',
            config: {
              type: 'CheckboxControl',
              label: t('Emit Filter Events'),
              renderTrigger: true,
              default: false,
              description: t('Whether to apply filter when items are clicked'),
            },
          },
        ],
        [
          {
            name: 'align_pn',
            config: {
              type: 'CheckboxControl',
              label: t('Align +/-'),
              renderTrigger: true,
              default: false,
              description: t(
                'Whether to align the background chart for +/- values',
              ),
            },
          },
          {
            name: 'color_pn',
            config: {
              type: 'CheckboxControl',
              label: t('Color +/-'),
              renderTrigger: true,
              default: true,
              description: t('Whether to color +/- values'),
            },
          },
        ],
        [
          {
            name: 'show_cell_bars',
            config: {
              type: 'CheckboxControl',
              label: t('Show Cell Bars'),
              renderTrigger: true,
              default: true,
              description: t(
                'Enable to display bar chart background elements in table columns',
              ),
            },
          },
          null,
        ],
      ],
    },
  ],
  controlOverrides: {
    metrics: {
      validators: [],
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
