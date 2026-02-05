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
  DEFAULT_MAX_ROW,
  DEFAULT_MAX_ROW_TABLE_SERVER,
  defineSavedMetrics,
  getStandardizedControls,
  QueryModeLabel,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  ensureIsArray,
  isAdhocColumn,
  isPhysicalColumn,
  QueryFormColumn,
  QueryMode,
  SMART_DATE_ID,
  legacyValidateInteger,
  validateMaxValue,
  validateServerPagination,
} from '@superset-ui/core';
import { t } from '@apache-superset/core';
import { GenericDataType } from '@apache-superset/core/api/core';

import { isEmpty } from 'lodash';
// Removed unused imports for non-split/split editors; using ActionsTabbedControl instead
import ActionsTabbedControl from './components/controls/ActionsTabbedControl';
import { PAGE_SIZE_OPTIONS, SERVER_PAGE_SIZE_OPTIONS } from './consts';
import DescriptionMarkdownControl from './components/controls/DescriptionMarkdownControl';
import { ColorSchemeEnum } from './types';
import JsonConfigManagerControl from './components/controls/JsonConfigManagerControl';
import { isBlockedJsonKey } from './utils/jsonConfig';

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
  optionRenderer: (c: any) => <ColumnOption showType column={c} />,
  valueRenderer: (c: any) => <ColumnOption column={c} />,
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
const fileDownloadSection= {
  label: t('File Download'),
  expanded: true,
  controlSetRows: [
    [
      {
        name: 'file_download_prefix',
        config: {
          type: 'TextControl',
          renderTrigger: true,
          label: t('File Download Prefix'),
          description: t('Prefix to use for file download,defaults to chart name'),
          default: '',
          tabOverride: 'customize',
        }
      }
    ]
  ]};



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
              description: t('Paginate results on the server. For precise totals, enable "Exact total row count" below (adds a COUNT(*) query).'),
              default: true,
            },
          },
        ],
        [
          {
            name: 'server_rowcount_exact',
            config: {
              type: 'CheckboxControl',
              label: t('Exact total row count'),
              description: t(
                'When enabled, runs an extra COUNT(*) query to compute total rows for pagination. Disable for faster responses on large tables.',
              ),
              default: false,
              // Only meaningful when server pagination is enabled
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.server_pagination?.value),
            },
          },
        ],
        [
          {
            name: 'row_limit',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Row limit'),
              clearable: false,
              mapStateToProps: state => ({
                maxValue: state?.common?.conf?.TABLE_VIZ_MAX_ROW_SERVER,
                server_pagination: state?.form_data?.server_pagination,
                maxValueWithoutServerPagination: state?.common?.conf?.SQL_MAX_ROW,
              }),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                !controls?.server_pagination?.value,
              validators: [
                legacyValidateInteger,
                (v, s) => validateMaxValue(v, s?.maxValue || DEFAULT_MAX_ROW_TABLE_SERVER),
                (v, s) =>
                  validateServerPagination(
                    v,
                    s?.server_pagination,
                    s?.maxValueWithoutServerPagination || DEFAULT_MAX_ROW,
                    s?.maxValue || DEFAULT_MAX_ROW_TABLE_SERVER,
                  ),
              ],
              validationDependancies: ['server_pagination'],
              default: 10000,
              description: t(
                'Limits the number of the rows that are computed in the query that is the source of the data used for this chart.',
              ),
            },
            override: {
              default: 1000,
            },
          },
          {
            name: 'server_page_length',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Server Page Length'),
              default: 50,
              choices: SERVER_PAGE_SIZE_OPTIONS,
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
      label: t('Configuration'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'json_config_manager',
            config: {
              type: JsonConfigManagerControl,
              label: t('Import / Export / Edit JSON'),
              description: t(
                'Manage the full chart configuration as JSON. Import, export, or edit; applied changes update the preview.',
              ),
              renderTrigger: true,
              tabOverride: 'customize',
              mapStateToProps: (state: ControlPanelState) => ({
                // Pass through all controls and current form_data for export
                controls: state.controls,
                form_data: state.form_data,
              }),
            },
          },
        ],
      ],
    },
    {
      label: t('Description'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'show_description',
            config: {
              type: 'CheckboxControl',
              label: t('Show description'),
              renderTrigger: true,
              default: false,
              description: t('Show a description block rendered as Markdown below the table header.'),
              tabOverride: 'customize',
            },
          },
        ],
        [
          {
            name: 'description_markdown',
            config: {
              type: DescriptionMarkdownControl,
              label: t('Description (Markdown)'),
              renderTrigger: true,
              rows: 4,
              default: '',
              description: t('Description text to render using Markdown. If empty, nothing is shown.'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.show_description?.value),
              offerEditInModal: true,
              tabOverride: 'customize',
            },
          },
        ],
      ],
    },
    {
      label: t('Search & Pagination'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'show_search_column_select',
            config: {
              type: 'CheckboxControl',
              label: t('Show Search Column Select'),
              renderTrigger: true,
              default: false,
              description: t(
                'Adds a dropdown for choosing the search column.\n' +
                  '- With Server pagination enabled: search text is sent to the backend and applied to the selected column.\n' +
                  '- Without Server pagination: search is applied locally to only the selected column. If the dropdown is hidden, the search scans all columns.'
              ),
            },
          },
        ],
        [
          {
            name: 'server_search_match_mode',
            config: {
              type: 'SelectControl',
              label: t('Server Search Match'),
              default: 'contains',
              renderTrigger: true,
              choices: [
                ['prefix', t('Starts with')],
                ['contains', t('Contains')],
              ],
              description: t('When using server pagination with search column, choose how the backend search matches.'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.server_pagination?.value),
            },
          },
        ],
        [
          {
            name: 'enable_highlight_search',
            config: {
              type: 'CheckboxControl',
              label: t('Highlight search matches'),
              renderTrigger: true,
              default: false,
              description: t('Highlight matching text in cells based on search input (server pagination only).'),
            },
          },
        ],
      ],
    },
    {
      label: t('Interactivity'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'enable_quick_filters',
            config: {
              type: 'CheckboxControl',
              label: t('Enable per-column quick filters'),
              renderTrigger: true,
              default: false,
              description: t('Adds per-column quick filters (client-side only).'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                !Boolean(controls?.server_pagination?.value),
            },
          },
          {
            name: 'enable_advanced_column_filters',
            config: {
              type: 'CheckboxControl',
              label: t('Enable advanced column filters'),
              renderTrigger: true,
              default: false,
              description: t('Show a filter icon in headers to build complex per-column filters (client-side only).'),
            },
          },
        ],
        [
          {
            name: 'enable_pin_columns',
            config: {
              type: 'CheckboxControl',
              label: t('Enable pin columns (left/right)'),
              renderTrigger: true,
              default: false,
              description: t('Allow pinning columns to the left/right (experimental).'),
            },
          },
          {
            name: 'enable_context_menu_export',
            config: {
              type: 'CheckboxControl',
              label: t('Enable right-click copy/export'),
              renderTrigger: true,
              default: true,
              description: t('Show a context menu on right-click to copy cell/row and export visible data to CSV/Excel.'),
            },
          },
        ],
      ],
    },
    {
      label: t('Columns & Layout'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'include_row_numbers',
            config: {
              type: 'CheckboxControl',
              label: t('Row numbers'),
              renderTrigger: true,
              default: true,
              description: t('Whether to include a client-side row numbers'),
            },
          },
        ],
        [
          {
            name: 'enable_column_visibility',
            config: {
              type: 'CheckboxControl',
              label: t('Enable column visibility menu'),
              renderTrigger: true,
              default: false,
              description: t('Allow users to toggle visible columns at runtime with persistence.'),
            },
          },
          {
            name: 'enable_column_resize',
            config: {
              type: 'CheckboxControl',
              label: t('Enable column drag-resize'),
              renderTrigger: true,
              default: false,
              description: t('Allow users to drag resize column widths with persistence.'),
            },
          },
        ],
        [
          {
            name: 'humanize_headers',
            config: {
              type: 'CheckboxControl',
              label: t('Humanize headers'),
              renderTrigger: true,
              default: true,
              description: (
                t("Replace '_' with space and capitalize words for default column labels. Custom labels are unchanged. Also applies to the search column dropdown (values still use raw keys).\n") +
                t('Examples:') +
                '\n- ' + t('user_name -> User Name') +
                '\n- ' + t('orders_total -> Orders Total') +
                '\n- ' + t("'Customer ID' -> 'Customer ID' (unchanged)")
              ),
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
              // Treat as query-affecting to ensure fresh data when config changes
              renderTrigger: false,
              clearable: false,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: t('D3 time format for datetime columns'),
              tabOverride: 'customize',
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
              default: 50,
              choices: PAGE_SIZE_OPTIONS,
              description: t('Rows per page, 0 means no pagination'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                !controls?.server_pagination?.value,
              tabOverride: 'customize',
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
              default: true,
              description: t('Whether to include a client-side search box'),
              tabOverride: 'customize',
            },
          }],
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
              tabOverride: 'customize',
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
                'Renders table cells as HTML when applicable. For example, HTML &lt;a&gt; tags will be rendered as hyperlinks.',
              ),
              tabOverride: 'customize',
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
              tabOverride: 'customize',
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
              label: t('Show cell bars'),
              renderTrigger: true,
              default: false,
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
              label: t('Add colors to cell bars for +/-'),
              renderTrigger: true,
              default: false,
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
              label: t('Basic conditional formatting'),
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
              label: t('Custom conditional formatting'),
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
                            : verboseMap[colname],
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
    fileDownloadSection,
  {
      label: t('Actions'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'actions_config',
            config: {
              type: ActionsTabbedControl,
              label: t('Configure Actions'),
              description: t('Defaults: publish events ON; server pagination ON (50 rows); humanized headers ON. Bulk actions bound to selection require at least one selected row and publish a single event with values as row objects.'),
              renderTrigger: true,
              offerEditInModal: true,
              tabOverride: 'customize',
              mapStateToProps: ({ datasource, controls }: any) => ({
                columns: datasource?.columns?.map((c: any) => c.column_name) || [],
                valueColumn: controls?.row_id_column?.value || controls?.bulk_action_id_column?.value || controls?.table_actions_id_column?.value,
                selectionEnabledLegacy: Boolean(controls?.selection_enabled?.value),
                bulkEnabledLegacy: Boolean(controls?.enable_bulk_actions?.value),
                tableActionsEnabledLegacy: Boolean(controls?.enable_table_actions?.value),
              }),
            },
          },
        ],
        [
          {
            name: 'actions_security_note',
            config: {
              type: DescriptionMarkdownControl,
              label: t('Security & Embedding Notes'),
              description: t('Information about action URL allowlist and messaging restrictions.'),
              renderTrigger: false,
              offerEditInModal: false,
              tabOverride: 'customize',
              // Static informational text; does not affect queries
              default: (
                [
                  t('Outbound action URLs are restricted to same-origin by default. Cross-origin navigation is allowed only if the origin is in REMITA_TABLE_ALLOWED_ACTION_ORIGINS. In development, a wildcard (*) may allow all origins — do not enable in production.'),
                  t('Embedded postMessage events are sent only to same-origin or allowlisted parent origins.'),
                  t('Configure allowlist in superset/config.py: REMITA_TABLE_ALLOWED_ACTION_ORIGINS = ["https://example.com", ...]'),
                ].join('\n\n')
              ),
            },
          },
        ],
      ],
    },
  ],
  formDataOverrides: formData => {
    // Allow applying bulk JSON overrides stored in `json_config_manager`.
    const rawJson = (formData as any).json_config_manager;
    let jsonOverrides: any = {};
    if (rawJson) {
      try {
        const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        Object.keys(parsed || {}).forEach(k => {
          if (!isBlockedJsonKey(k)) jsonOverrides[k] = parsed[k];
        });
      } catch (e) {
        // ignore invalid JSON; rely on control-side validation
      }
    }

    // Start from incoming form data, then apply JSON overrides
    const merged: any = {
      ...formData,
      ...jsonOverrides,
    };

    // Compose final overrides and migrations
    return {
      ...merged,
      metrics: getStandardizedControls().popAllMetrics(),
      groupby: getStandardizedControls().popAllColumns(),
      // Global include_native_filters deprecated; handled per-action
      // Migrate legacy flags to new ones for seamless editing
      retain_selection_across_navigation:
        merged.retain_selection_across_navigation ??
        merged.retain_selection_accross_navigation,
      show_search_column_select:
        merged.show_search_column_select ??
        merged.enable_server_search_column_selector,
      // Respect explicit server_rowcount_exact when provided; default remains false
      server_rowcount_exact: merged.server_rowcount_exact,
      // Build actions_config from legacy individual controls if not present
      actions_config:
        merged.actions_config ?? {
          enable_bulk_actions: merged.enable_bulk_actions,
          selection_enabled: merged.selection_enabled,
          selection_mode: merged.selection_mode,
          row_id_column: merged.row_id_column || merged.bulk_action_id_column || merged.table_actions_id_column,
          bulk_action_label: merged.bulk_action_label,
          show_split_buttons_in_slice_header: merged.show_split_buttons_in_slice_header,
          split_actions: merged.split_actions,
          non_split_actions: merged.non_split_actions,
          enable_table_actions: merged.enable_table_actions,
          hide_row_id_column: merged.hide_row_id_column || merged.hide_table_actions_id_column,
          table_actions: merged.table_actions,
          retain_selection_across_navigation:
            merged.retain_selection_across_navigation ??
            merged.retain_selection_accross_navigation,
        },
    };
  },
};

export default config;
