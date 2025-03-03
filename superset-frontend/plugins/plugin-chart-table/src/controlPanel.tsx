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
import {
  ColumnMeta,
  ColumnOption,
  ControlConfig,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlPanelState,
  ControlState,
  ControlStateMapping,
  D3_TIME_FORMAT_OPTIONS,
  Dataset,
  defineSavedMetrics,
  getStandardizedControls,
  QueryModeLabel,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  ensureIsArray,
  GenericDataType,
  isAdhocColumn,
  isPhysicalColumn,
  QueryFormColumn,
  QueryMode,
  SMART_DATE_ID,
  t,
} from '@superset-ui/core';

import { isEmpty } from 'lodash';
import { PAGE_SIZE_OPTIONS } from './consts';
import { ColorSchemeEnum } from './types';

function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.Aggregate || mode === QueryMode.Raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value as
    | QueryFormColumn[]
    | undefined;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.Raw : QueryMode.Aggregate;
}

/**
 * Visibility check
 */
function isQueryMode(mode: QueryMode) {
  return ({ controls }: Pick<ControlPanelsContainerProps, 'controls'>) =>
    getQueryMode(controls) === mode;
}

const isAggMode = isQueryMode(QueryMode.Aggregate);
const isRawMode = isQueryMode(QueryMode.Raw);

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
    [QueryMode.Aggregate, QueryModeLabel[QueryMode.Aggregate]],
    [QueryMode.Raw, QueryModeLabel[QueryMode.Raw]],
  ],
  mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
  rerender: ['all_columns', 'groupby', 'metrics', 'percent_metrics'],
};

const allColumnsControl: typeof sharedControls.groupby = {
  ...sharedControls.groupby,
  label: t('Columns'),
  description: t('Columns to display'),
  multi: true,
  freeForm: true,
  allowAll: true,
  commaChoosesOption: false,
  optionRenderer: c => <ColumnOption showType column={c} />,
  valueRenderer: c => <ColumnOption column={c} />,
  valueKey: 'column_name',
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    options: datasource?.columns || [],
    queryMode: getQueryMode(controls),
    externalValidationErrors:
      isRawMode({ controls }) && ensureIsArray(controlState?.value).length === 0
        ? [t('must have a value')]
        : [],
  }),
  visibility: isRawMode,
  resetOnHide: false,
};

const percentMetricsControl: typeof sharedControls.metrics = {
  ...sharedControls.metrics,
  label: t('Percentage metrics'),
  description: t(
    'Select one or many metrics to display, that will be displayed in the percentages of total. ' +
      'Percentage metrics will be calculated only from data within the row limit. ' +
      'You can use an aggregation function on a column or write custom SQL to create a percentage metric.',
  ),
  visibility: isAggMode,
  resetOnHide: false,
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    columns: datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    datasource,
    datasourceType: datasource?.type,
    queryMode: getQueryMode(controls),
    externalValidationErrors: validateAggControlValues(controls, [
      controls.groupby?.value,
      controls.metrics?.value,
      controlState?.value,
    ]),
  }),
  rerender: ['groupby', 'metrics'],
  default: [],
  validators: [],
};

/**
 * Generate comparison column names for a given column.
 */
const generateComparisonColumns = (colname: string) => [
  `${t('Main')} ${colname}`,
  `# ${colname}`,
  `△ ${colname}`,
  `% ${colname}`,
];
/**
 * Generate column types for the comparison columns.
 */
const generateComparisonColumnTypes = (count: number) =>
  Array(count).fill(GenericDataType.Numeric);

const processComparisonColumns = (columns: any[], suffix: string) =>
  columns
    .map(col => {
      if (!col.label.includes(suffix)) {
        return [
          {
            label: `${t('Main')} ${col.label}`,
            value: `${t('Main')} ${col.value}`,
          },
          {
            label: `# ${col.label}`,
            value: `# ${col.value}`,
          },
          {
            label: `△ ${col.label}`,
            value: `△ ${col.value}`,
          },
          {
            label: `% ${col.label}`,
            value: `% ${col.value}`,
          },
        ];
      }
      return [];
    })
    .flat();

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
              resetOnHide: false,
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
            name: 'time_grain_sqla',
            config: {
              ...sharedControls.time_grain_sqla,
              visibility: ({ controls }) => {
                const dttmLookup = Object.fromEntries(
                  ensureIsArray(controls?.groupby?.options).map(option => [
                    option.column_name,
                    option.is_dttm,
                  ]),
                );

                return ensureIsArray(controls?.groupby.value)
                  .map(selection => {
                    if (isAdhocColumn(selection)) {
                      return true;
                    }
                    if (isPhysicalColumn(selection)) {
                      return !!dttmLookup[selection];
                    }
                    return false;
                  })
                  .some(Boolean);
              },
            },
          },
          'temporal_columns_lookup',
        ],
        [
          {
            name: 'metrics',
            override: {
              validators: [],
              visibility: isAggMode,
              resetOnHide: false,
              mapStateToProps: (
                { controls, datasource, form_data }: ControlPanelState,
                controlState: ControlState,
              ) => ({
                columns: datasource?.columns[0]?.hasOwnProperty('filterable')
                  ? (datasource as Dataset)?.columns?.filter(
                      (c: ColumnMeta) => c.filterable,
                    )
                  : datasource?.columns,
                savedMetrics: defineSavedMetrics(datasource),
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
            config: allColumnsControl,
          },
        ],
        [
          {
            name: 'percent_metrics',
            config: percentMetricsControl,
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'timeseries_limit_metric',
            override: {
              visibility: isAggMode,
              resetOnHide: false,
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
                choices: datasource?.hasOwnProperty('order_by_choices')
                  ? (datasource as Dataset)?.order_by_choices
                  : datasource?.columns || [],
              }),
              visibility: isRawMode,
              resetOnHide: false,
            },
          },
        ],
        [
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
        ],
        [
          {
            name: 'row_limit',
            override: {
              default: 1000,
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
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort descending'),
              default: true,
              description: t(
                'If enabled, this control sorts the results/values descending, otherwise it sorts the results ascending.',
              ),
              visibility: isAggMode,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'show_totals',
            config: {
              type: 'CheckboxControl',
              label: t('Show summary'),
              default: false,
              description: t(
                'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
              ),
              visibility: isAggMode,
              resetOnHide: false,
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
            name: 'table_timestamp_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Timestamp format'),
              default: SMART_DATE_ID,
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
        ],
        [
          {
            name: 'allow_rearrange_columns',
            config: {
              type: 'CheckboxControl',
              label: t('Allow columns to be rearranged'),
              renderTrigger: true,
              default: false,
              description: t(
                "Allow end user to drag-and-drop column headers to rearrange them. Note their changes won't persist for the next time they open the chart.",
              ),
              visibility: ({ controls }) =>
                isEmpty(controls?.time_compare?.value),
            },
          },
        ],
        [
          {
            name: 'allow_render_html',
            config: {
              type: 'CheckboxControl',
              label: t('Render columns in HTML format'),
              renderTrigger: true,
              default: true,
              description: t(
                'Renders table cells as HTML when applicable. For example, HTML <a> tags will be rendered as hyperlinks.',
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
              width: 400,
              height: 320,
              renderTrigger: true,
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(explore, _, chart) {
                const timeComparisonStatus =
                  !!explore?.controls?.time_compare?.value;

                const { colnames: _colnames, coltypes: _coltypes } =
                  chart?.queriesResponse?.[0] ?? {};
                let colnames: string[] = _colnames || [];
                let coltypes: GenericDataType[] = _coltypes || [];

                if (timeComparisonStatus) {
                  /**
                   * Replace numeric columns with sets of comparison columns.
                   */
                  const updatedColnames: string[] = [];
                  const updatedColtypes: GenericDataType[] = [];
                  colnames.forEach((colname, index) => {
                    if (coltypes[index] === GenericDataType.Numeric) {
                      updatedColnames.push(
                        ...generateComparisonColumns(colname),
                      );
                      updatedColtypes.push(...generateComparisonColumnTypes(4));
                    } else {
                      updatedColnames.push(colname);
                      updatedColtypes.push(coltypes[index]);
                    }
                  });

                  colnames = updatedColnames;
                  coltypes = updatedColtypes;
                }
                return {
                  columnsPropsObject: { colnames, coltypes },
                };
              },
            },
          },
        ],
      ],
    },
    {
      label: t('Visual formatting'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_cell_bars',
            config: {
              type: 'CheckboxControl',
              label: t('Show Cell bars'),
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
        ],
        [
          {
            name: 'color_pn',
            config: {
              type: 'CheckboxControl',
              label: t('add colors to cell bars for +/-'),
              renderTrigger: true,
              default: true,
              description: t(
                'Whether to colorize numeric values by whether they are positive or negative',
              ),
            },
          },
        ],
        [
          {
            name: 'comparison_color_enabled',
            config: {
              type: 'CheckboxControl',
              label: t('basic conditional formatting'),
              renderTrigger: true,
              visibility: ({ controls }) =>
                !isEmpty(controls?.time_compare?.value),
              default: false,
              description: t(
                'This will be applied to the whole table. Arrows (↑ and ↓) will be added to ' +
                  'main columns for increase and decrease. Basic conditional formatting can be ' +
                  'overwritten by conditional formatting below.',
              ),
            },
          },
        ],
        [
          {
            name: 'comparison_color_scheme',
            config: {
              type: 'SelectControl',
              label: t('color type'),
              default: ColorSchemeEnum.Green,
              renderTrigger: true,
              choices: [
                [ColorSchemeEnum.Green, 'Green for increase, red for decrease'],
                [ColorSchemeEnum.Red, 'Red for increase, green for decrease'],
              ],
              visibility: ({ controls }) =>
                !isEmpty(controls?.time_compare?.value) &&
                Boolean(controls?.comparison_color_enabled?.value),
              description: t(
                'Adds color to the chart symbols based on the positive or ' +
                  'negative change from the comparison value.',
              ),
            },
          },
        ],
        [
          {
            name: 'conditional_formatting',
            config: {
              type: 'ConditionalFormattingControl',
              renderTrigger: true,
              label: t('Custom Conditional Formatting'),
              extraColorChoices: [
                {
                  value: ColorSchemeEnum.Green,
                  label: t('Green for increase, red for decrease'),
                },
                {
                  value: ColorSchemeEnum.Red,
                  label: t('Red for increase, green for decrease'),
                },
              ],
              description: t(
                'Apply conditional color formatting to numeric columns',
              ),
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(explore, _, chart) {
                const verboseMap = explore?.datasource?.hasOwnProperty(
                  'verbose_map',
                )
                  ? (explore?.datasource as Dataset)?.verbose_map
                  : (explore?.datasource?.columns ?? {});
                const chartStatus = chart?.chartStatus;
                const { colnames, coltypes } =
                  chart?.queriesResponse?.[0] ?? {};
                const numericColumns =
                  Array.isArray(colnames) && Array.isArray(coltypes)
                    ? colnames
                        .filter(
                          (colname: string, index: number) =>
                            coltypes[index] === GenericDataType.Numeric,
                        )
                        .map((colname: string) => ({
                          value: colname,
                          label: Array.isArray(verboseMap)
                            ? colname
                            : (verboseMap[colname] ?? colname),
                        }))
                    : [];
                const columnOptions = explore?.controls?.time_compare?.value
                  ? processComparisonColumns(
                      numericColumns || [],
                      ensureIsArray(
                        explore?.controls?.time_compare?.value,
                      )[0]?.toString() || '',
                    )
                  : numericColumns;

                return {
                  removeIrrelevantConditions: chartStatus === 'success',
                  columnOptions,
                  verboseMap,
                };
              },
            },
          },
        ],
      ],
    },
    {
      ...sections.timeComparisonControls({
        multi: false,
        showCalculationType: false,
        showFullChoices: false,
      }),
      visibility: isAggMode,
    },
  ],
  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
    groupby: getStandardizedControls().popAllColumns(),
  }),
};

export default config;
