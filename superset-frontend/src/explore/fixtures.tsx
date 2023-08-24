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
import { DatasourceType, t } from '@superset-ui/core';
import {
  ColumnMeta,
  ColumnOption,
  ControlConfig,
  ControlPanelSectionConfig,
} from '@superset-ui/chart-controls';
import { ExplorePageInitialData } from './types';

export const controlPanelSectionsChartOptions: (ControlPanelSectionConfig | null)[] =
  [
    null,
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          'color_scheme',
          {
            name: 'rose_area_proportion',
            config: {
              type: 'CheckboxControl',
              label: t('Use Area Proportions'),
              description: t(
                'Check if the Rose Chart should use segment area instead of ' +
                  'segment radius for proportioning',
              ),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'stacked_style',
            config: {
              type: 'SelectControl',
              label: t('Stacked Style'),
              renderTrigger: true,
              choices: [
                ['stack', t('stack')],
                ['stream', t('stream')],
                ['expand', t('expand')],
              ],
              default: 'stack',
              description: '',
            },
          },
        ],
      ],
    },
  ];

export const controlPanelSectionsChartOptionsOnlyColorScheme: ControlPanelSectionConfig[] =
  [
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [['color_scheme']],
    },
  ];

export const controlPanelSectionsChartOptionsTable: ControlPanelSectionConfig[] =
  [
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          'metric',
          'metrics',
          {
            name: 'all_columns',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Columns'),
              default: [],
              description: t('Columns to display'),
              optionRenderer: c => <ColumnOption column={c} showType />,
              valueKey: 'column_name',
              mapStateToProps: stateRef => ({
                options: stateRef.datasource?.columns || [],
              }),
              freeForm: true,
            } as ControlConfig<'SelectControl', ColumnMeta>,
          },
        ],
      ],
    },
  ];

export const exploreInitialData: ExplorePageInitialData = {
  form_data: {
    datasource: '8__table',
    metric: 'count',
    slice_id: 371,
    viz_type: 'table',
  },
  slice: {
    cache_timeout: null,
    description: null,
    slice_id: 371,
    slice_name: 'Age distribution of respondents',
    is_managed_externally: false,
    form_data: {
      datasource: '8__table',
      metric: 'count',
      slice_id: 371,
      viz_type: 'table',
    },
  },
  dataset: {
    id: 8,
    type: DatasourceType.Table,
    columns: [{ column_name: 'a' }],
    metrics: [{ metric_name: 'first' }, { metric_name: 'second' }],
    column_formats: {},
    currency_formats: {},
    verbose_map: {},
    main_dttm_col: '',
    datasource_name: '8__table',
    description: null,
  },
};

export const fallbackExploreInitialData: ExplorePageInitialData = {
  form_data: {
    datasource: '0__table',
    viz_type: 'table',
  },
  dataset: {
    id: 0,
    type: DatasourceType.Table,
    columns: [],
    metrics: [],
    column_formats: {},
    currency_formats: {},
    verbose_map: {},
    main_dttm_col: '',
    owners: [],
    datasource_name: 'missing_datasource',
    name: 'missing_datasource',
    description: null,
  },
  slice: null,
};
