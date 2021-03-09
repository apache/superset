/* eslint-disable camelcase */
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
import {
  t,
  validateNonEmpty,
  addLocaleData,
  smartDateFormatter,
  QueryMode,
  QueryFormColumn,
} from '@superset-ui/core';
import {
  D3_TIME_FORMAT_OPTIONS,
  ControlConfig,
  ColumnOption,
  ControlStateMapping,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  sharedControls,
  sections,
} from '@superset-ui/chart-controls';

import i18n from './i18n';
import { PAGE_SIZE_OPTIONS } from './consts';

addLocaleData(i18n);

const QueryModeLabel = {
  [QueryMode.aggregate]: t('Aggregate'),
  [QueryMode.raw]: t('Raw Records'),
};

function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value as QueryFormColumn[] | undefined;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

/**
 * Visibility check
 */
function isQueryMode(mode: QueryMode) {
  return ({ controls }: ControlPanelsContainerProps) => getQueryMode(controls) === mode;
}

const isAggMode = isQueryMode(QueryMode.aggregate);
const isRawMode = isQueryMode(QueryMode.raw);

const queryMode: ControlConfig<'RadioButtonControl'> = {
  type: 'RadioButtonControl',
  label: t('Query Mode'),
  default: null,
  options: [
    {
      label: QueryModeLabel[QueryMode.aggregate],
      value: QueryMode.aggregate,
    },
    {
      label: QueryModeLabel[QueryMode.raw],
      value: QueryMode.raw,
    },
  ],
  mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
};

const all_columns: typeof sharedControls.groupby = {
  type: 'SelectControl',
  label: t('Columns'),
  description: t('Columns to display'),
  multi: true,
  freeForm: true,
  allowAll: true,
  commaChoosesOption: false,
  default: [],
  optionRenderer: c => <ColumnOption showType column={c} />,
  valueRenderer: c => <ColumnOption column={c} />,
  valueKey: 'column_name',
  mapStateToProps: ({ datasource, controls }) => ({
    options: datasource?.columns || [],
    queryMode: getQueryMode(controls),
  }),
  visibility: isRawMode,
};

const percent_metrics: typeof sharedControls.metrics = {
  type: 'MetricsControl',
  label: t('Percentage Metrics'),
  description: t(
    'Metrics for which percentage of total are to be displayed. Calculated from only data within the row limit.',
  ),
  multi: true,
  visibility: isAggMode,
  mapStateToProps: ({ datasource, controls }) => ({
    columns: datasource?.columns || [],
    savedMetrics: datasource?.metrics || [],
    datasourceType: datasource?.type,
    queryMode: getQueryMode(controls),
  }),
  default: [],
  validators: [],
};

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'query_mode',
            config: queryMode,
          },
        ],
        [
          {
            name: 'groupby',
            override: {
              visibility: isAggMode,
            },
          },
        ],
        [
          {
            name: 'metrics',
            override: {
              validators: [],
              visibility: isAggMode,
            },
          },
          {
            name: 'all_columns',
            config: all_columns,
          },
        ],
        [
          {
            name: 'percent_metrics',
            config: percent_metrics,
          },
        ],
        [
          {
            name: 'timeseries_limit_metric',
            override: {
              visibility: isAggMode,
            },
          },
          {
            name: 'order_by_cols',
            config: {
              type: 'SelectControl',
              label: t('Ordering'),
              description: t('Order results by selected columns'),
              multi: true,
              default: [],
              mapStateToProps: ({ datasource }) => ({
                choices: datasource?.order_by_choices || [],
              }),
              visibility: isRawMode,
            },
          },
        ],
        [
          {
            name: 'server_pagination',
            config: {
              type: 'CheckboxControl',
              label: t('Server pagination'),
              description: t('Enable server side pagination of results (experimental feature)'),
              default: false,
            },
          },
        ],
        [
          {
            name: 'row_limit',
            override: {
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                !controls.server_pagination.value,
            },
          },
          {
            name: 'server_page_length',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Server Page Length'),
              default: 10,
              choices: PAGE_SIZE_OPTIONS,
              description: t('Rows per page, 0 means no pagination'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls.server_pagination.value),
            },
          },
        ],
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
              visibility: isAggMode,
            },
          },
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
              visibility: isAggMode,
            },
          },
        ],
        ['adhoc_filters'],
      ],
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
              default: smartDateFormatter.id,
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
              default: null,
              choices: PAGE_SIZE_OPTIONS,
              description: t('Rows per page, 0 means no pagination'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                !controls.server_pagination.value,
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
              description: t('Whether to apply filter to dashboards when table cells are clicked'),
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
              description: t('Whether to align the background chart for +/- values'),
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
              description: t('Enable to display bar chart background elements in table columns'),
            },
          },
          null,
        ],
      ],
    },
  ],
};

export default config;
