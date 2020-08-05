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
import { t, addLocaleData } from '@superset-ui/translation';
import {
  formatSelectOptions,
  D3_TIME_FORMAT_OPTIONS,
  ControlConfig,
  ColumnOption,
  ControlStateMapping,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  sharedControls,
} from '@superset-ui/chart-controls';
import { validateNonEmpty } from '@superset-ui/validator';
import { smartDateFormatter } from '@superset-ui/time-format';
import i18n from './i18n';

addLocaleData(i18n);

export const PAGE_SIZE_OPTIONS = formatSelectOptions<number>([
  [0, t('page_size.all')],
  10,
  20,
  50,
  100,
  200,
]);

export enum QueryMode {
  aggregate = 'aggregate',
  raw = 'raw',
}

const QueryModeLabel = {
  [QueryMode.aggregate]: t('Aggregate'),
  [QueryMode.raw]: t('Raw Records'),
};

function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value;
  const hasRawColumns = rawColumns && (rawColumns as string[])?.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

/**
 * Visibility check
 */
function isQueryMode(mode: QueryMode) {
  return ({ controls }: ControlPanelsContainerProps) => {
    return getQueryMode(controls) === mode;
  };
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
  mapStateToProps: ({ controls }) => {
    return { value: getQueryMode(controls) };
  },
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
  description: t('Metrics for which percentage of total are to be displayed'),
  multi: true,
  visibility: isAggMode,
  mapStateToProps: ({ datasource, controls }) => {
    return {
      columns: datasource?.columns || [],
      savedMetrics: datasource?.metrics || [],
      datasourceType: datasource?.type,
      queryMode: getQueryMode(controls),
    };
  },
  default: [],
  validators: [],
};

const config: ControlPanelConfig = {
  controlPanelSections: [
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
              description: t('One or many metrics to display'),
              multi: true,
              default: [],
              mapStateToProps: ({ datasource }) => ({
                choices: datasource?.order_by_choices || [],
              }),
              visibility: isRawMode,
            },
          },
        ],
        ['row_limit'],
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
  sectionOverrides: {
    druidTimeSeries: {
      controlSetRows: [['granularity', 'druid_time_origin'], ['time_range']],
    },
    sqlaTimeSeries: {
      controlSetRows: [['granularity_sqla', 'time_grain_sqla'], ['time_range']],
    },
  },
};

export default config;
