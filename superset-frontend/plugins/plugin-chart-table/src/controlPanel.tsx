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
  addLocaleData,
  ChartDataResponseResult,
  ensureIsArray,
  FeatureFlag,
  GenericDataType,
  isFeatureEnabled,
  QueryFormColumn,
  QueryMode,
  smartDateFormatter,
  t,
} from '@superset-ui/core';
import {
  ColumnOption,
  ControlConfig,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlStateMapping,
  D3_TIME_FORMAT_OPTIONS,
  QueryModeLabel,
  sections,
  sharedControls,
  ControlPanelState,
  ExtraControlProps,
  ControlState,
  emitFilterControl,
} from '@superset-ui/chart-controls';

import i18n from './i18n';
import { PAGE_SIZE_OPTIONS } from './consts';

addLocaleData(i18n);

function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value as
    | QueryFormColumn[]
    | undefined;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

/**
 * Visibility check
 */
function isQueryMode(mode: QueryMode) {
  return ({ controls }: Pick<ControlPanelsContainerProps, 'controls'>) =>
    getQueryMode(controls) === mode;
}

const isAggMode = isQueryMode(QueryMode.aggregate);
const isRawMode = isQueryMode(QueryMode.raw);

const validateAggControlValues = (
  controls: ControlStateMapping,
  values: any[],
) => {
  const areControlsEmpty = values.every(val => ensureIsArray(val).length === 0);
  return areControlsEmpty && isAggMode({ controls })
    ? [t('Group By, Metrics or Percentage Metrics must have a value')]
    : [];
};

const queryMode: ControlConfig<'RadioButtonControl'> = {
  type: 'RadioButtonControl',
  label: t('Query mode'),
  default: null,
  options: [
    [QueryMode.aggregate, QueryModeLabel[QueryMode.aggregate]],
    [QueryMode.raw, QueryModeLabel[QueryMode.raw]],
  ],
  mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
  rerender: ['all_columns', 'groupby', 'metrics', 'percent_metrics'],
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
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    options: datasource?.columns || [],
    queryMode: getQueryMode(controls),
    externalValidationErrors:
      isRawMode({ controls }) && ensureIsArray(controlState.value).length === 0
        ? [t('must have a value')]
        : [],
  }),
  visibility: isRawMode,
};

const dnd_all_columns: typeof sharedControls.groupby = {
  type: 'DndColumnSelect',
  label: t('Columns'),
  description: t('Columns to display'),
  default: [],
  mapStateToProps({ datasource, controls }, controlState) {
    const newState: ExtraControlProps = {};
    if (datasource) {
      const options = datasource.columns;
      newState.options = Object.fromEntries(
        options.map(option => [option.column_name, option]),
      );
    }
    newState.queryMode = getQueryMode(controls);
    newState.externalValidationErrors =
      isRawMode({ controls }) && ensureIsArray(controlState.value).length === 0
        ? [t('must have a value')]
        : [];
    return newState;
  },
  visibility: isRawMode,
};

const percent_metrics: typeof sharedControls.metrics = {
  type: 'MetricsControl',
  label: t('Percentage metrics'),
  description: t(
    'Metrics for which percentage of total are to be displayed. Calculated from only data within the row limit.',
  ),
  multi: true,
  visibility: isAggMode,
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    columns: datasource?.columns || [],
    savedMetrics: datasource?.metrics || [],
    datasource,
    datasourceType: datasource?.type,
    queryMode: getQueryMode(controls),
    externalValidationErrors: validateAggControlValues(controls, [
      controls.groupby?.value,
      controls.metrics?.value,
      controlState.value,
    ]),
  }),
  rerender: ['groupby', 'metrics'],
  default: [],
  validators: [],
};

const dnd_percent_metrics = {
  ...percent_metrics,
  type: 'DndMetricSelect',
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
              mapStateToProps: (
                state: ControlPanelState,
                controlState: ControlState,
              ) => {
                const { controls } = state;
                const originalMapStateToProps =
                  sharedControls?.groupby?.mapStateToProps;
                const newState =
                  originalMapStateToProps?.(state, controlState) ?? {};
                newState.externalValidationErrors = validateAggControlValues(
                  controls,
                  [
                    controls.metrics?.value,
                    controls.percent_metrics?.value,
                    controlState.value,
                  ],
                );

                return newState;
              },
              rerender: ['metrics', 'percent_metrics'],
            },
          },
        ],
        [
          {
            name: 'metrics',
            override: {
              validators: [],
              visibility: isAggMode,
              mapStateToProps: (
                { controls, datasource, form_data }: ControlPanelState,
                controlState: ControlState,
              ) => ({
                columns: datasource?.columns.filter(c => c.filterable) || [],
                savedMetrics: datasource?.metrics || [],
                // current active adhoc metrics
                selectedMetrics:
                  form_data.metrics ||
                  (form_data.metric ? [form_data.metric] : []),
                datasource,
                externalValidationErrors: validateAggControlValues(controls, [
                  controls.groupby?.value,
                  controls.percent_metrics?.value,
                  controlState.value,
                ]),
              }),
              rerender: ['groupby', 'percent_metrics'],
            },
          },
          {
            name: 'all_columns',
            config: isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
              ? dnd_all_columns
              : all_columns,
          },
        ],
        [
          {
            name: 'percent_metrics',
            config: {
              ...(isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
                ? dnd_percent_metrics
                : percent_metrics),
            },
          },
        ],
        ['adhoc_filters'],
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
        isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) ||
        isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS)
          ? [
              {
                name: 'server_pagination',
                config: {
                  type: 'CheckboxControl',
                  label: t('Server pagination'),
                  description: t(
                    'Enable server side pagination of results (experimental feature)',
                  ),
                  default: false,
                },
              },
            ]
          : [],
        [
          {
            name: 'row_limit',
            override: {
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                !controls?.server_pagination?.value,
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
                Boolean(controls?.server_pagination?.value),
            },
          },
        ],
        [
          {
            name: 'include_time',
            config: {
              type: 'CheckboxControl',
              label: t('Include time'),
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
              label: t('Sort descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
              visibility: isAggMode,
            },
          },
        ],
        [
          {
            name: 'show_totals',
            config: {
              type: 'CheckboxControl',
              label: t('Show totals'),
              default: false,
              description: t(
                'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
              ),
              visibility: isAggMode,
            },
          },
        ],
        emitFilterControl,
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
              label: t('Timestamp format'),
              default: smartDateFormatter.id,
              renderTrigger: true,
              clearable: false,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: t('D3 time format for datetime columns'),
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
              label: t('Page length'),
              default: null,
              choices: PAGE_SIZE_OPTIONS,
              description: t('Rows per page, 0 means no pagination'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                !controls?.server_pagination?.value,
            },
          },
          null,
        ],
        [
          {
            name: 'include_search',
            config: {
              type: 'CheckboxControl',
              label: t('Search box'),
              renderTrigger: true,
              default: false,
              description: t('Whether to include a client-side search box'),
            },
          },
          {
            name: 'show_cell_bars',
            config: {
              type: 'CheckboxControl',
              label: t('Cell bars'),
              renderTrigger: true,
              default: true,
              description: t(
                'Whether to display a bar chart background in table columns',
              ),
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
                'Whether to align background charts with both positive and negative values at 0',
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
              description: t(
                'Whether to colorize numeric values by if they are positive or negative',
              ),
            },
          },
        ],
        [
          {
            name: 'rearrange_columns',
            config: {
              type: 'CheckboxControl',
              label: t('Allow columns to be rearranged'),
              renderTrigger: true,
              default: false,
              description: t(
                'Allow the end user to drag-and-drop the column headers to rearrange them.',
              ),
            },
          },
        ],
        [
          {
            name: 'column_config',
            config: {
              type: 'ColumnConfigControl',
              label: t('Customize columns'),
              description: t('Further customize how to display each column'),
              renderTrigger: true,
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(explore, _, chart) {
                return {
                  queryResponse: chart?.queriesResponse?.[0] as
                    | ChartDataResponseResult
                    | undefined,
                  emitFilter: explore?.controls?.table_filter?.value,
                };
              },
            },
          },
        ],
        [
          {
            name: 'conditional_formatting',
            config: {
              type: 'ConditionalFormattingControl',
              renderTrigger: true,
              label: t('Conditional formatting'),
              description: t(
                'Apply conditional color formatting to numeric columns',
              ),
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(explore, _, chart) {
                const verboseMap = explore?.datasource?.verbose_map ?? {};
                const { colnames, coltypes } =
                  chart?.queriesResponse?.[0] ?? {};
                const numericColumns =
                  Array.isArray(colnames) && Array.isArray(coltypes)
                    ? colnames
                        .filter(
                          (colname: string, index: number) =>
                            coltypes[index] === GenericDataType.NUMERIC,
                        )
                        .map(colname => ({
                          value: colname,
                          label: verboseMap[colname] ?? colname,
                        }))
                    : [];
                return {
                  columnOptions: numericColumns,
                  verboseMap,
                };
              },
            },
          },
        ],
      ],
    },
  ],
};

export default config;
