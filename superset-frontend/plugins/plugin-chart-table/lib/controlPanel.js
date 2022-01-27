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
import React from 'react';
import {
addLocaleData,

ensureIsArray,
FeatureFlag,
GenericDataType,
isFeatureEnabled,

QueryMode,
smartDateFormatter,
t } from
'@superset-ui/core';
import {
ColumnOption,




D3_TIME_FORMAT_OPTIONS,
QueryModeLabel,
sections,
sharedControls,



emitFilterControl } from
'@superset-ui/chart-controls';

import i18n from './i18n';
import { PAGE_SIZE_OPTIONS } from './consts';import { jsx as ___EmotionJSX } from "@emotion/react";

addLocaleData(i18n);

function getQueryMode(controls) {var _controls$query_mode, _controls$all_columns;
  const mode = controls == null ? void 0 : (_controls$query_mode = controls.query_mode) == null ? void 0 : _controls$query_mode.value;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode;
  }
  const rawColumns = controls == null ? void 0 : (_controls$all_columns = controls.all_columns) == null ? void 0 : _controls$all_columns.value;


  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

/**
 * Visibility check
 */
function isQueryMode(mode) {
  return ({ controls }) =>
  getQueryMode(controls) === mode;
}

const isAggMode = isQueryMode(QueryMode.aggregate);
const isRawMode = isQueryMode(QueryMode.raw);

const validateAggControlValues = (
controls,
values) =>
{
  const areControlsEmpty = values.every((val) => ensureIsArray(val).length === 0);
  return areControlsEmpty && isAggMode({ controls }) ?
  [t('Group By, Metrics or Percentage Metrics must have a value')] :
  [];
};

const queryMode = {
  type: 'RadioButtonControl',
  label: t('Query mode'),
  default: null,
  options: [
  [QueryMode.aggregate, QueryModeLabel[QueryMode.aggregate]],
  [QueryMode.raw, QueryModeLabel[QueryMode.raw]]],

  mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
  rerender: ['all_columns', 'groupby', 'metrics', 'percent_metrics'] };


const all_columns = {
  type: 'SelectControl',
  label: t('Columns'),
  description: t('Columns to display'),
  multi: true,
  freeForm: true,
  allowAll: true,
  commaChoosesOption: false,
  default: [],
  optionRenderer: (c) => ___EmotionJSX(ColumnOption, { showType: true, column: c }),
  valueRenderer: (c) => ___EmotionJSX(ColumnOption, { column: c }),
  valueKey: 'column_name',
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    options: (datasource == null ? void 0 : datasource.columns) || [],
    queryMode: getQueryMode(controls),
    externalValidationErrors:
    isRawMode({ controls }) && ensureIsArray(controlState.value).length === 0 ?
    [t('must have a value')] :
    [] }),

  sortComparator: (a, b) =>
  a.label.localeCompare(b.label),
  visibility: isRawMode };


const dnd_all_columns = {
  type: 'DndColumnSelect',
  label: t('Columns'),
  description: t('Columns to display'),
  default: [],
  mapStateToProps({ datasource, controls }, controlState) {
    const newState = {};
    if (datasource) {
      const options = datasource.columns;
      newState.options = Object.fromEntries(
      options.map((option) => [option.column_name, option]));

    }
    newState.queryMode = getQueryMode(controls);
    newState.externalValidationErrors =
    isRawMode({ controls }) && ensureIsArray(controlState.value).length === 0 ?
    [t('must have a value')] :
    [];
    return newState;
  },
  visibility: isRawMode };


const percent_metrics = {
  type: 'MetricsControl',
  label: t('Percentage metrics'),
  description: t(
  'Metrics for which percentage of total are to be displayed. Calculated from only data within the row limit.'),

  multi: true,
  visibility: isAggMode,
  mapStateToProps: ({ datasource, controls }, controlState) => {var _controls$groupby, _controls$metrics;return {
      columns: (datasource == null ? void 0 : datasource.columns) || [],
      savedMetrics: (datasource == null ? void 0 : datasource.metrics) || [],
      datasource,
      datasourceType: datasource == null ? void 0 : datasource.type,
      queryMode: getQueryMode(controls),
      externalValidationErrors: validateAggControlValues(controls, [(_controls$groupby =
      controls.groupby) == null ? void 0 : _controls$groupby.value, (_controls$metrics =
      controls.metrics) == null ? void 0 : _controls$metrics.value,
      controlState.value]) };},


  rerender: ['groupby', 'metrics'],
  default: [],
  validators: [] };


const dnd_percent_metrics = {
  ...percent_metrics,
  type: 'DndMetricSelect' };


const config = {
  controlPanelSections: [
  sections.legacyTimeseriesTime,
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
    [
    {
      name: 'query_mode',
      config: queryMode }],


    [
    {
      name: 'groupby',
      override: {
        visibility: isAggMode,
        mapStateToProps: (
        state,
        controlState) =>
        {var _sharedControls$group, _originalMapStateToPr, _controls$metrics2, _controls$percent_met;
          const { controls } = state;
          const originalMapStateToProps =
          sharedControls == null ? void 0 : (_sharedControls$group = sharedControls.groupby) == null ? void 0 : _sharedControls$group.mapStateToProps;
          const newState = (_originalMapStateToPr =
          originalMapStateToProps == null ? void 0 : originalMapStateToProps(state, controlState)) != null ? _originalMapStateToPr : {};
          newState.externalValidationErrors = validateAggControlValues(
          controls,
          [(_controls$metrics2 =
          controls.metrics) == null ? void 0 : _controls$metrics2.value, (_controls$percent_met =
          controls.percent_metrics) == null ? void 0 : _controls$percent_met.value,
          controlState.value]);



          return newState;
        },
        rerender: ['metrics', 'percent_metrics'] } }],



    [
    {
      name: 'metrics',
      override: {
        validators: [],
        visibility: isAggMode,
        mapStateToProps: (
        { controls, datasource, form_data },
        controlState) => {var _controls$groupby2, _controls$percent_met2;return (
            {
              columns: (datasource == null ? void 0 : datasource.columns.filter((c) => c.filterable)) || [],
              savedMetrics: (datasource == null ? void 0 : datasource.metrics) || [],
              // current active adhoc metrics
              selectedMetrics:
              form_data.metrics || (
              form_data.metric ? [form_data.metric] : []),
              datasource,
              externalValidationErrors: validateAggControlValues(controls, [(_controls$groupby2 =
              controls.groupby) == null ? void 0 : _controls$groupby2.value, (_controls$percent_met2 =
              controls.percent_metrics) == null ? void 0 : _controls$percent_met2.value,
              controlState.value]) });},


        rerender: ['groupby', 'percent_metrics'] } },


    {
      name: 'all_columns',
      config: isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP) ?
      dnd_all_columns :
      all_columns }],


    [
    {
      name: 'percent_metrics',
      config: {
        ...(isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP) ?
        dnd_percent_metrics :
        percent_metrics) } }],



    ['adhoc_filters'],
    [
    {
      name: 'timeseries_limit_metric',
      override: {
        visibility: isAggMode } },


    {
      name: 'order_by_cols',
      config: {
        type: 'SelectControl',
        label: t('Ordering'),
        description: t('Order results by selected columns'),
        multi: true,
        default: [],
        mapStateToProps: ({ datasource }) => ({
          choices: (datasource == null ? void 0 : datasource.order_by_choices) || [] }),

        visibility: isRawMode,
        sortComparator: (a, b) =>
        a.label.localeCompare(b.label) } }],



    isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) ||
    isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) ?
    [
    {
      name: 'server_pagination',
      config: {
        type: 'CheckboxControl',
        label: t('Server pagination'),
        description: t(
        'Enable server side pagination of results (experimental feature)'),

        default: false } }] :



    [],
    [
    {
      name: 'row_limit',
      override: {
        visibility: ({ controls }) => {var _controls$server_pagi;return (
            !(controls != null && (_controls$server_pagi = controls.server_pagination) != null && _controls$server_pagi.value));} } },


    {
      name: 'server_page_length',
      config: {
        type: 'SelectControl',
        freeForm: true,
        label: t('Server Page Length'),
        default: 10,
        choices: PAGE_SIZE_OPTIONS,
        description: t('Rows per page, 0 means no pagination'),
        visibility: ({ controls }) => {var _controls$server_pagi2;return (
            Boolean(controls == null ? void 0 : (_controls$server_pagi2 = controls.server_pagination) == null ? void 0 : _controls$server_pagi2.value));} } }],



    [
    {
      name: 'include_time',
      config: {
        type: 'CheckboxControl',
        label: t('Include time'),
        description: t(
        'Whether to include the time granularity as defined in the time section'),

        default: false,
        visibility: isAggMode } },


    {
      name: 'order_desc',
      config: {
        type: 'CheckboxControl',
        label: t('Sort descending'),
        default: true,
        description: t('Whether to sort descending or ascending'),
        visibility: isAggMode } }],



    [
    {
      name: 'show_totals',
      config: {
        type: 'CheckboxControl',
        label: t('Show totals'),
        default: false,
        description: t(
        'Show total aggregations of selected metrics. Note that row limit does not apply to the result.'),

        visibility: isAggMode } }],



    emitFilterControl] },


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
        description: t('D3 time format for datetime columns') } }],



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
        visibility: ({ controls }) => {var _controls$server_pagi3;return (
            !(controls != null && (_controls$server_pagi3 = controls.server_pagination) != null && _controls$server_pagi3.value));} } },


    null],

    [
    {
      name: 'include_search',
      config: {
        type: 'CheckboxControl',
        label: t('Search box'),
        renderTrigger: true,
        default: false,
        description: t('Whether to include a client-side search box') } },


    {
      name: 'show_cell_bars',
      config: {
        type: 'CheckboxControl',
        label: t('Cell bars'),
        renderTrigger: true,
        default: true,
        description: t(
        'Whether to display a bar chart background in table columns') } }],




    [
    {
      name: 'align_pn',
      config: {
        type: 'CheckboxControl',
        label: t('Align +/-'),
        renderTrigger: true,
        default: false,
        description: t(
        'Whether to align background charts with both positive and negative values at 0') } },



    {
      name: 'color_pn',
      config: {
        type: 'CheckboxControl',
        label: t('Color +/-'),
        renderTrigger: true,
        default: true,
        description: t(
        'Whether to colorize numeric values by if they are positive or negative') } }],




    [
    {
      name: 'column_config',
      config: {
        type: 'ColumnConfigControl',
        label: t('Customize columns'),
        description: t('Further customize how to display each column'),
        renderTrigger: true,
        mapStateToProps(explore, control, chart) {var _chart$queriesRespons, _explore$controls, _explore$controls$tab;
          return {
            queryResponse: chart == null ? void 0 : (_chart$queriesRespons = chart.queriesResponse) == null ? void 0 : _chart$queriesRespons[0],


            emitFilter: explore == null ? void 0 : (_explore$controls = explore.controls) == null ? void 0 : (_explore$controls$tab = _explore$controls.table_filter) == null ? void 0 : _explore$controls$tab.value };

        } } }],



    [
    {
      name: 'conditional_formatting',
      config: {
        type: 'ConditionalFormattingControl',
        renderTrigger: true,
        label: t('Conditional formatting'),
        description: t(
        'Apply conditional color formatting to numeric columns'),

        mapStateToProps(explore, control, chart) {var _explore$datasource$v, _explore$datasource, _chart$queriesRespons2, _chart$queriesRespons3;
          const verboseMap = (_explore$datasource$v = explore == null ? void 0 : (_explore$datasource = explore.datasource) == null ? void 0 : _explore$datasource.verbose_map) != null ? _explore$datasource$v : {};
          const { colnames, coltypes } = (_chart$queriesRespons2 =
          chart == null ? void 0 : (_chart$queriesRespons3 = chart.queriesResponse) == null ? void 0 : _chart$queriesRespons3[0]) != null ? _chart$queriesRespons2 : {};
          const numericColumns =
          Array.isArray(colnames) && Array.isArray(coltypes) ?
          colnames.
          filter(
          (colname, index) =>
          coltypes[index] === GenericDataType.NUMERIC).

          map((colname) => {var _verboseMap$colname;return {
              value: colname,
              label: (_verboseMap$colname = verboseMap[colname]) != null ? _verboseMap$colname : colname };}) :

          [];
          return {
            columnOptions: numericColumns,
            verboseMap };

        } } }]] }] };const _default =








config;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(getQueryMode, "getQueryMode", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(isQueryMode, "isQueryMode", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(isAggMode, "isAggMode", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(isRawMode, "isRawMode", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(validateAggControlValues, "validateAggControlValues", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(queryMode, "queryMode", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(all_columns, "all_columns", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(dnd_all_columns, "dnd_all_columns", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(percent_metrics, "percent_metrics", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(dnd_percent_metrics, "dnd_percent_metrics", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(config, "config", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();