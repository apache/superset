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

/**
 * This file exports all controls available for use in chart plugins internal to Superset.
 * It is not recommended to use the controls here for any third-party plugins.
 *
 * While the React components located in `controls/components` represent different
 * types of controls (CheckboxControl, SelectControl, TextControl, ...), the controls here
 * represent instances of control types, that can be reused across visualization types.
 *
 * When controls are reused across viz types, their values are carried over as a user
 * changes the chart types.
 *
 * While the keys defined in the control itself get passed to the controlType as props,
 * here's a list of the keys that are common to all controls, and as a result define the
 * control interface.
 */
import { isEmpty } from 'lodash';
import {
  t,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
  legacyValidateInteger,
  ComparisonType,
  ensureIsArray,
  isDefined,
  NO_TIME_RANGE,
  validateMaxValue,
} from '@superset-ui/core';

import {
  formatSelectOptions,
  displayTimeRelatedControls,
  getColorControlsProps,
  D3_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
  D3_TIME_FORMAT_DOCS,
  DEFAULT_TIME_FORMAT,
  DEFAULT_NUMBER_FORMAT,
} from '../utils';
import { DEFAULT_MAX_ROW, TIME_FILTER_LABELS } from '../constants';
import {
  SharedControlConfig,
  Dataset,
  ControlState,
  ControlPanelState,
} from '../types';

import {
  dndAdhocFilterControl,
  dndAdhocMetricControl,
  dndAdhocMetricsControl,
  dndGranularitySqlaControl,
  dndSortByControl,
  dndSecondaryMetricControl,
  dndSizeControl,
  dndXControl,
  dndYControl,
  dndColumnsControl,
  dndEntityControl,
  dndGroupByControl,
  dndSeriesControl,
  dndAdhocMetricControl2,
  dndXAxisControl,
} from './dndControls';

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const sequentialSchemeRegistry = getSequentialSchemeRegistry();

export const PRIMARY_COLOR = { r: 0, g: 122, b: 135, a: 1 };

const ROW_LIMIT_OPTIONS = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];
const SERIES_LIMITS = [5, 10, 25, 50, 100, 500];

const appContainer = document.getElementById('app');
const { user } = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}',
);

type SelectDefaultOption = {
  label: string;
  value: string;
};

const datasourceControl: SharedControlConfig<'DatasourceControl'> = {
  type: 'DatasourceControl',
  label: t('Datasource'),
  default: null,
  description: null,
  mapStateToProps: ({ datasource, form_data }) => ({
    datasource,
    form_data,
    user,
  }),
};

const viz_type: SharedControlConfig<'VizTypeControl'> = {
  type: 'VizTypeControl',
  label: t('Visualization Type'),
  default: 'table',
  description: t('The type of visualization to display'),
};

const color_picker: SharedControlConfig<'ColorPickerControl'> = {
  type: 'ColorPickerControl',
  label: t('Fixed Color'),
  description: t('Use this to define a static color for all circles'),
  default: PRIMARY_COLOR,
  renderTrigger: true,
};

const linear_color_scheme: SharedControlConfig<'ColorSchemeControl'> = {
  type: 'ColorSchemeControl',
  label: t('Linear Color Scheme'),
  choices: () =>
    (sequentialSchemeRegistry.values() as SequentialScheme[]).map(value => [
      value.id,
      value.label,
    ]),
  default: sequentialSchemeRegistry.getDefaultKey(),
  clearable: false,
  description: '',
  renderTrigger: true,
  schemes: () => sequentialSchemeRegistry.getMap(),
  isLinear: true,
  mapStateToProps: state => getColorControlsProps(state),
};

const granularity: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: TIME_FILTER_LABELS.granularity,
  default: 'one day',
  choices: [
    [null, t('all')],
    ['PT5S', t('5 seconds')],
    ['PT30S', t('30 seconds')],
    ['PT1M', t('1 minute')],
    ['PT5M', t('5 minutes')],
    ['PT30M', t('30 minutes')],
    ['PT1H', t('1 hour')],
    ['PT6H', t('6 hour')],
    ['P1D', t('1 day')],
    ['P7D', t('7 days')],
    ['P1W', t('week')],
    ['week_starting_sunday', t('week starting Sunday')],
    ['week_ending_saturday', t('week ending Saturday')],
    ['P1M', t('month')],
    ['P3M', t('quarter')],
    ['P1Y', t('year')],
  ],
  description: t(
    'The time granularity for the visualization. Note that you ' +
      'can type and use simple natural language as in `10 seconds`, ' +
      '`1 day` or `56 weeks`',
  ),
};

const time_grain_sqla: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  label: TIME_FILTER_LABELS.time_grain_sqla,
  placeholder: t('None'),
  initialValue: (control: ControlState, state: ControlPanelState) => {
    if (!isDefined(state)) {
      // If a chart is in a Dashboard, the ControlPanelState is empty.
      return control.value;
    }
    // If a chart is a new one that isn't saved, metadata is null. In this
    // case we want to default P1D. If the chart has been saved, we want
    // to use whichever value was chosen, either nothing or valid a time grain.
    return state?.metadata || 'time_grain_sqla' in (state?.form_data ?? {})
      ? state?.form_data?.time_grain_sqla
      : 'P1D';
  },
  description: t(
    'Select a time grain for the visualization. The ' +
      'grain is the time interval represented by a ' +
      'single point on the chart.',
  ),
  mapStateToProps: ({ datasource }) => ({
    choices: (datasource as Dataset)?.time_grain_sqla || [],
  }),
  visibility: displayTimeRelatedControls,
};

const time_range: SharedControlConfig<'DateFilterControl'> = {
  type: 'DateFilterControl',
  freeForm: true,
  label: TIME_FILTER_LABELS.time_range,
  default: NO_TIME_RANGE, // this value is an empty filter constant so shouldn't translate it.
  description: t(
    'This control filters the whole chart based on the selected time range. All relative times, e.g. "Last month", ' +
      '"Last 7 days", "now", etc. are evaluated on the server using the server\'s ' +
      'local time (sans timezone). All tooltips and placeholder times are expressed ' +
      'in UTC (sans timezone). The timestamps are then evaluated by the database ' +
      "using the engine's local timezone. Note one can explicitly set the timezone " +
      'per the ISO 8601 format if specifying either the start and/or end time.',
  ),
};

const row_limit: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Row limit'),
  clearable: false,
  mapStateToProps: state => ({ maxValue: state?.common?.conf?.SQL_MAX_ROW }),
  validators: [
    legacyValidateInteger,
    (v, state) => validateMaxValue(v, state?.maxValue || DEFAULT_MAX_ROW),
  ],
  default: 10000,
  choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
  description: t(
    'Limits the number of the rows that are computed in the query that is the source of the data used for this chart.',
  ),
};

const order_desc: SharedControlConfig<'CheckboxControl'> = {
  type: 'CheckboxControl',
  label: t('Sort Descending'),
  default: true,
  description: t(
    'If enabled, this control sorts the results/values descending, otherwise it sorts the results ascending.',
  ),
  visibility: ({ controls }) =>
    Boolean(
      controls?.timeseries_limit_metric.value &&
        !isEmpty(controls?.timeseries_limit_metric.value),
    ),
};

const limit: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Series limit'),
  placeholder: t('None'),
  validators: [legacyValidateInteger],
  choices: formatSelectOptions(SERIES_LIMITS),
  clearable: true,
  description: t(
    'Limits the number of series that get displayed. A joined subquery (or an extra phase ' +
      'where subqueries are not supported) is applied to limit the number of series that get ' +
      'fetched and rendered. This feature is useful when grouping by high cardinality ' +
      'column(s) though does increase the query complexity and cost.',
  ),
};

const series_limit: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Series limit'),
  placeholder: t('None'),
  validators: [legacyValidateInteger],
  choices: formatSelectOptions(SERIES_LIMITS),
  description: t(
    'Limits the number of series that get displayed. A joined subquery (or an extra phase ' +
      'where subqueries are not supported) is applied to limit the number of series that get ' +
      'fetched and rendered. This feature is useful when grouping by high cardinality ' +
      'column(s) though does increase the query complexity and cost.',
  ),
};

const y_axis_format: SharedControlConfig<'SelectControl', SelectDefaultOption> =
  {
    type: 'SelectControl',
    freeForm: true,
    label: t('Y Axis Format'),
    renderTrigger: true,
    default: DEFAULT_NUMBER_FORMAT,
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
    tokenSeparators: ['\n', '\t', ';'],
    filterOption: ({ data: option }, search) =>
      option.label.includes(search) || option.value.includes(search),
    mapStateToProps: state => {
      const isPercentage =
        state.controls?.comparison_type?.value === ComparisonType.Percentage;
      return {
        choices: isPercentage
          ? D3_FORMAT_OPTIONS.filter(option => option[0].includes('%'))
          : D3_FORMAT_OPTIONS,
      };
    },
  };

const currency_format: SharedControlConfig<'CurrencyControl'> = {
  type: 'CurrencyControl',
  label: t('Currency format'),
  renderTrigger: true,
};

const x_axis_time_format: SharedControlConfig<
  'SelectControl',
  SelectDefaultOption
> = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Time format'),
  renderTrigger: true,
  default: DEFAULT_TIME_FORMAT,
  choices: D3_TIME_FORMAT_OPTIONS,
  description: D3_TIME_FORMAT_DOCS,
  filterOption: ({ data: option }, search) =>
    option.label.includes(search) || option.value.includes(search),
};

const color_scheme: SharedControlConfig<'ColorSchemeControl'> = {
  type: 'ColorSchemeControl',
  label: t('Color Scheme'),
  default: categoricalSchemeRegistry.getDefaultKey(),
  renderTrigger: true,
  choices: () => categoricalSchemeRegistry.keys().map(s => [s, s]),
  description: t('The color scheme for rendering chart'),
  schemes: () => categoricalSchemeRegistry.getMap(),
  mapStateToProps: state => getColorControlsProps(state),
};

const truncate_metric: SharedControlConfig<'CheckboxControl'> = {
  type: 'CheckboxControl',
  label: t('Truncate Metric'),
  default: true,
  description: t('Whether to truncate metrics'),
};

const show_empty_columns: SharedControlConfig<'CheckboxControl'> = {
  type: 'CheckboxControl',
  label: t('Show empty columns'),
  default: true,
  description: t('Show empty columns'),
};

const temporal_columns_lookup: SharedControlConfig<'HiddenControl'> = {
  type: 'HiddenControl',
  initialValue: (control: ControlState, state: ControlPanelState | null) =>
    Object.fromEntries(
      ensureIsArray<Record<string, any>>(state?.datasource?.columns)
        .filter(option => option.is_dttm)
        .map(option => [option.column_name ?? option.name, option.is_dttm]),
    ),
};

const sort_by_metric: SharedControlConfig<'CheckboxControl'> = {
  type: 'CheckboxControl',
  label: t('Sort by metric'),
  description: t(
    'Whether to sort results by the selected metric in descending order.',
  ),
};

export default {
  metrics: dndAdhocMetricsControl,
  metric: dndAdhocMetricControl,
  datasource: datasourceControl,
  viz_type,
  color_picker,
  metric_2: dndAdhocMetricControl2,
  linear_color_scheme,
  secondary_metric: dndSecondaryMetricControl,
  groupby: dndGroupByControl,
  columns: dndColumnsControl,
  granularity,
  granularity_sqla: dndGranularitySqlaControl,
  time_grain_sqla,
  time_range,
  row_limit,
  limit,
  timeseries_limit_metric: dndSortByControl,
  orderby: dndSortByControl,
  order_desc,
  series: dndSeriesControl,
  entity: dndEntityControl,
  x: dndXControl,
  y: dndYControl,
  size: dndSizeControl,
  y_axis_format,
  x_axis_time_format,
  adhoc_filters: dndAdhocFilterControl,
  color_scheme,
  series_columns: dndColumnsControl,
  series_limit,
  series_limit_metric: dndSortByControl,
  legacy_order_by: dndSortByControl,
  truncate_metric,
  x_axis: dndXAxisControl,
  show_empty_columns,
  temporal_columns_lookup,
  currency_format,
  sort_by_metric,
};
