(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /* eslint-disable camelcase */
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
import React from 'react';
import {
FeatureFlag,
t,
getCategoricalSchemeRegistry,
getSequentialSchemeRegistry,
isFeatureEnabled,

legacyValidateInteger,
validateNonEmpty } from
'@superset-ui/core';

import {
formatSelectOptions,
D3_FORMAT_OPTIONS,
D3_FORMAT_DOCS,
D3_TIME_FORMAT_OPTIONS,
D3_TIME_FORMAT_DOCS,
DEFAULT_TIME_FORMAT,
DEFAULT_NUMBER_FORMAT } from
'../utils';
import { TIME_FILTER_LABELS, TIME_COLUMN_OPTION } from '../constants';







import { ColumnOption } from '../components/ColumnOption';

import {
dnd_adhoc_filters,
dnd_adhoc_metric,
dnd_adhoc_metrics,
dnd_granularity_sqla,
dnd_sort_by,
dnd_secondary_metric,
dnd_size,
dnd_x,
dnd_y,
dndColumnsControl,
dndEntity,
dndGroupByControl,
dndSeries,
dnd_adhoc_metric_2 } from
'./dndControls';import { jsx as ___EmotionJSX } from "@emotion/react";

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const sequentialSchemeRegistry = getSequentialSchemeRegistry();

export const PRIMARY_COLOR = { r: 0, g: 122, b: 135, a: 1 };

const ROW_LIMIT_OPTIONS = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];
const SERIES_LIMITS = [5, 10, 25, 50, 100, 500];






const groupByControl = {
  type: 'SelectControl',
  label: t('Group by'),
  multi: true,
  freeForm: true,
  clearable: true,
  default: [],
  includeTime: false,
  description: t(
  'One or many columns to group by. High cardinality groupings should include a sort by metric ' +
  'and series limit to limit the number of fetched and rendered series.'),

  sortComparator: (a, b) =>
  a.label.localeCompare(b.label),
  optionRenderer: (c) => ___EmotionJSX(ColumnOption, { showType: true, column: c }),
  valueRenderer: (c) => ___EmotionJSX(ColumnOption, { column: c }),
  valueKey: 'column_name',
  allowAll: true,
  filterOption: ({ data: opt }, text) =>
  opt.column_name &&
  opt.column_name.toLowerCase().includes(text.toLowerCase()) ||
  opt.verbose_name &&
  opt.verbose_name.toLowerCase().includes(text.toLowerCase()) ||
  false,
  promptTextCreator: (label) => label,
  mapStateToProps(state, { includeTime }) {
    const newState = {};
    if (state.datasource) {
      const options = state.datasource.columns.filter((c) => c.groupby);
      if (includeTime) {
        options.unshift(TIME_COLUMN_OPTION);
      }
      newState.options = options;
    }
    return newState;
  },
  commaChoosesOption: false };


const metrics = {
  type: 'MetricsControl',
  multi: true,
  label: t('Metrics'),
  validators: [validateNonEmpty],
  mapStateToProps: ({ datasource }) => ({
    columns: datasource ? datasource.columns : [],
    savedMetrics: datasource ? datasource.metrics : [],
    datasource,
    datasourceType: datasource == null ? void 0 : datasource.type }),

  description: t('One or many metrics to display') };


const metric = {
  ...metrics,
  multi: false,
  label: t('Metric'),
  description: t('Metric') };


const datasourceControl = {
  type: 'DatasourceControl',
  label: t('Datasource'),
  default: null,
  description: null,
  mapStateToProps: ({ datasource, form_data }) => ({
    datasource,
    form_data }) };



const viz_type = {
  type: 'VizTypeControl',
  label: t('Visualization Type'),
  default: 'table',
  description: t('The type of visualization to display') };


const color_picker = {
  type: 'ColorPickerControl',
  label: t('Fixed Color'),
  description: t('Use this to define a static color for all circles'),
  default: PRIMARY_COLOR,
  renderTrigger: true };


const metric_2 = {
  ...metric,
  label: t('Right Axis Metric'),
  clearable: true,
  description: t('Choose a metric for right axis') };


const linear_color_scheme = {
  type: 'ColorSchemeControl',
  label: t('Linear Color Scheme'),
  choices: () =>
  sequentialSchemeRegistry.values().map((value) => [
  value.id,
  value.label]),

  default: sequentialSchemeRegistry.getDefaultKey(),
  clearable: false,
  description: '',
  renderTrigger: true,
  schemes: () => sequentialSchemeRegistry.getMap(),
  isLinear: true };


const secondary_metric = {
  ...metric,
  label: t('Color Metric'),
  default: null,
  validators: [],
  description: t('A metric to use for color') };


const columnsControl = {
  ...groupByControl,
  label: t('Columns'),
  description: t('One or many columns to pivot as columns') };


const druid_time_origin = {
  type: 'SelectControl',
  freeForm: true,
  label: TIME_FILTER_LABELS.druid_time_origin,
  choices: [
  ['', 'default'],
  ['now', 'now']],

  default: null,
  description: t(
  'Defines the origin where time buckets start, ' +
  'accepts natural dates as in `now`, `sunday` or `1970-01-01`') };



const granularity = {
  type: 'SelectControl',
  freeForm: true,
  label: TIME_FILTER_LABELS.granularity,
  default: 'one day',
  choices: [
  [null, 'all'],
  ['PT5S', '5 seconds'],
  ['PT30S', '30 seconds'],
  ['PT1M', '1 minute'],
  ['PT5M', '5 minutes'],
  ['PT30M', '30 minutes'],
  ['PT1H', '1 hour'],
  ['PT6H', '6 hour'],
  ['P1D', '1 day'],
  ['P7D', '7 days'],
  ['P1W', 'week'],
  ['week_starting_sunday', 'week starting Sunday'],
  ['week_ending_saturday', 'week ending Saturday'],
  ['P1M', 'month'],
  ['P3M', 'quarter'],
  ['P1Y', 'year']],

  description: t(
  'The time granularity for the visualization. Note that you ' +
  'can type and use simple natural language as in `10 seconds`, ' +
  '`1 day` or `56 weeks`') };



const granularity_sqla = {
  type: 'SelectControl',
  label: TIME_FILTER_LABELS.granularity_sqla,
  description: t(
  'The time column for the visualization. Note that you ' +
  'can define arbitrary expression that return a DATETIME ' +
  'column in the table. Also note that the ' +
  'filter below is applied against this column or ' +
  'expression'),

  default: (c) => c.default,
  clearable: false,
  optionRenderer: (c) => ___EmotionJSX(ColumnOption, { showType: true, column: c }),
  valueRenderer: (c) => ___EmotionJSX(ColumnOption, { column: c }),
  valueKey: 'column_name',
  mapStateToProps: (state) => {
    const props = {};
    if (state.datasource) {
      props.options = state.datasource.columns.filter((c) => c.is_dttm);
      props.default = null;
      if (state.datasource.main_dttm_col) {
        props.default = state.datasource.main_dttm_col;
      } else if (props.options && props.options.length > 0) {
        props.default = props.options[0].column_name;
      }
    }
    return props;
  } };


const time_grain_sqla = {
  type: 'SelectControl',
  label: TIME_FILTER_LABELS.time_grain_sqla,
  default: 'P1D',
  description: t(
  'The time granularity for the visualization. This ' +
  'applies a date transformation to alter ' +
  'your time column and defines a new time granularity. ' +
  'The options here are defined on a per database ' +
  'engine basis in the Superset source code.'),

  mapStateToProps: ({ datasource }) => ({
    choices: (datasource == null ? void 0 : datasource.time_grain_sqla) || null }) };



const time_range = {
  type: 'DateFilterControl',
  freeForm: true,
  label: TIME_FILTER_LABELS.time_range,
  default: t('No filter'), // this value is translated, but the backend wouldn't understand a translated value?
  description: t(
  'The time range for the visualization. All relative times, e.g. "Last month", ' +
  '"Last 7 days", "now", etc. are evaluated on the server using the server\'s ' +
  'local time (sans timezone). All tooltips and placeholder times are expressed ' +
  'in UTC (sans timezone). The timestamps are then evaluated by the database ' +
  "using the engine's local timezone. Note one can explicitly set the timezone " +
  'per the ISO 8601 format if specifying either the start and/or end time.'),

  mapStateToProps: ({ datasource, form_data }) => ({
    datasource,
    endpoints: (form_data == null ? void 0 : form_data.time_range_endpoints) || null }) };



const row_limit = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Row limit'),
  validators: [legacyValidateInteger],
  default: 10000,
  choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
  description: t('Limits the number of rows that get displayed.') };


const limit = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Series limit'),
  validators: [legacyValidateInteger],
  choices: formatSelectOptions(SERIES_LIMITS),
  clearable: true,
  description: t(
  'Limits the number of series that get displayed. A joined subquery (or an extra phase ' +
  'where subqueries are not supported) is applied to limit the number of series that get ' +
  'fetched and rendered. This feature is useful when grouping by high cardinality ' +
  'column(s) though does increase the query complexity and cost.') };



const series_limit = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Series limit'),
  validators: [legacyValidateInteger],
  choices: formatSelectOptions(SERIES_LIMITS),
  description: t(
  'Limits the number of series that get displayed. A joined subquery (or an extra phase ' +
  'where subqueries are not supported) is applied to limit the number of series that get ' +
  'fetched and rendered. This feature is useful when grouping by high cardinality ' +
  'column(s) though does increase the query complexity and cost.') };



const sort_by = {
  type: 'MetricsControl',
  label: t('Sort by'),
  default: null,
  description: t(
  'Metric used to define how the top series are sorted if a series or row limit is present. ' +
  'If undefined reverts to the first metric (where appropriate).'),

  mapStateToProps: ({ datasource }) => ({
    columns: (datasource == null ? void 0 : datasource.columns) || [],
    savedMetrics: (datasource == null ? void 0 : datasource.metrics) || [],
    datasource,
    datasourceType: datasource == null ? void 0 : datasource.type }) };



const series = {
  ...groupByControl,
  label: t('Series'),
  multi: false,
  default: null,
  description: t(
  'Defines the grouping of entities. ' +
  'Each series is shown as a specific color on the chart and ' +
  'has a legend toggle') };



const entity = {
  ...groupByControl,
  label: t('Entity'),
  default: null,
  multi: false,
  validators: [validateNonEmpty],
  description: t('This defines the element to be plotted on the chart') };


const x = {
  ...metric,
  label: t('X Axis'),
  description: t('Metric assigned to the [X] axis'),
  default: null };


const y = {
  ...metric,
  label: t('Y Axis'),
  default: null,
  description: t('Metric assigned to the [Y] axis') };


const size = {
  ...metric,
  label: t('Bubble Size'),
  description: t('Metric used to calculate bubble size'),
  default: null };


const y_axis_format = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Y Axis Format'),
  renderTrigger: true,
  default: DEFAULT_NUMBER_FORMAT,
  choices: D3_FORMAT_OPTIONS,
  description: D3_FORMAT_DOCS,
  mapStateToProps: (state) => {var _state$controls, _state$controls$compa;
    const showWarning = ((_state$controls = state.controls) == null ? void 0 : (_state$controls$compa = _state$controls.comparison_type) == null ? void 0 : _state$controls$compa.value) === 'percentage';
    return {
      warning: showWarning ?
      t(
      'When `Calculation type` is set to "Percentage change", the Y ' +
      'Axis Format is forced to `.1%`') :

      null,
      disabled: showWarning };

  } };


const x_axis_time_format = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Time format'),
  renderTrigger: true,
  default: DEFAULT_TIME_FORMAT,
  choices: D3_TIME_FORMAT_OPTIONS,
  description: D3_TIME_FORMAT_DOCS };


const adhoc_filters = {
  type: 'AdhocFilterControl',
  label: t('Filters'),
  default: null,
  description: '',
  mapStateToProps: ({ datasource, form_data }) => ({
    columns: (datasource == null ? void 0 : datasource.columns.filter((c) => c.filterable)) || [],
    savedMetrics: (datasource == null ? void 0 : datasource.metrics) || [],
    // current active adhoc metrics
    selectedMetrics:
    form_data.metrics || (form_data.metric ? [form_data.metric] : []),
    datasource }) };



const color_scheme = {
  type: 'ColorSchemeControl',
  label: t('Color Scheme'),
  default: categoricalSchemeRegistry.getDefaultKey(),
  renderTrigger: true,
  choices: () => categoricalSchemeRegistry.keys().map((s) => [s, s]),
  description: t('The color scheme for rendering chart'),
  schemes: () => categoricalSchemeRegistry.getMap(),
  mapStateToProps: (state) => {var _state$form_data;return {
      dashboardId: state == null ? void 0 : (_state$form_data = state.form_data) == null ? void 0 : _state$form_data.dashboardId };} };



const enableExploreDnd = isFeatureEnabled(
FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP);


const sharedControls = {
  metrics: enableExploreDnd ? dnd_adhoc_metrics : metrics,
  metric: enableExploreDnd ? dnd_adhoc_metric : metric,
  datasource: datasourceControl,
  viz_type,
  color_picker,
  metric_2: enableExploreDnd ? dnd_adhoc_metric_2 : metric_2,
  linear_color_scheme,
  secondary_metric: enableExploreDnd ? dnd_secondary_metric : secondary_metric,
  groupby: enableExploreDnd ? dndGroupByControl : groupByControl,
  columns: enableExploreDnd ? dndColumnsControl : columnsControl,
  druid_time_origin,
  granularity,
  granularity_sqla: enableExploreDnd ? dnd_granularity_sqla : granularity_sqla,
  time_grain_sqla,
  time_range,
  row_limit,
  limit,
  timeseries_limit_metric: enableExploreDnd ? dnd_sort_by : sort_by,
  orderby: enableExploreDnd ? dnd_sort_by : sort_by,
  series: enableExploreDnd ? dndSeries : series,
  entity: enableExploreDnd ? dndEntity : entity,
  x: enableExploreDnd ? dnd_x : x,
  y: enableExploreDnd ? dnd_y : y,
  size: enableExploreDnd ? dnd_size : size,
  y_axis_format,
  x_axis_time_format,
  adhoc_filters: enableExploreDnd ? dnd_adhoc_filters : adhoc_filters,
  color_scheme,
  series_columns: enableExploreDnd ? dndColumnsControl : columnsControl,
  series_limit,
  series_limit_metric: enableExploreDnd ? dnd_sort_by : sort_by,
  legacy_order_by: enableExploreDnd ? dnd_sort_by : sort_by };


export { sharedControls, dndEntity, dndColumnsControl };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(categoricalSchemeRegistry, "categoricalSchemeRegistry", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(sequentialSchemeRegistry, "sequentialSchemeRegistry", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(PRIMARY_COLOR, "PRIMARY_COLOR", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(ROW_LIMIT_OPTIONS, "ROW_LIMIT_OPTIONS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(SERIES_LIMITS, "SERIES_LIMITS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(groupByControl, "groupByControl", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(metrics, "metrics", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(metric, "metric", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(datasourceControl, "datasourceControl", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(viz_type, "viz_type", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(color_picker, "color_picker", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(metric_2, "metric_2", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(linear_color_scheme, "linear_color_scheme", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(secondary_metric, "secondary_metric", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(columnsControl, "columnsControl", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(druid_time_origin, "druid_time_origin", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(granularity, "granularity", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(granularity_sqla, "granularity_sqla", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(time_grain_sqla, "time_grain_sqla", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(time_range, "time_range", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(row_limit, "row_limit", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(limit, "limit", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(series_limit, "series_limit", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(sort_by, "sort_by", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(series, "series", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(entity, "entity", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(x, "x", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(y, "y", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(size, "size", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(y_axis_format, "y_axis_format", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(x_axis_time_format, "x_axis_time_format", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(adhoc_filters, "adhoc_filters", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(color_scheme, "color_scheme", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(enableExploreDnd, "enableExploreDnd", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");reactHotLoader.register(sharedControls, "sharedControls", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/index.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();