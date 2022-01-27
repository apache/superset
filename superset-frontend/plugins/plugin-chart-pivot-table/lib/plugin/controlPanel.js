(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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

smartDateFormatter,
t,
validateNonEmpty } from
'@superset-ui/core';
import {

D3_TIME_FORMAT_OPTIONS,
formatSelectOptions,
sections,
sharedControls,
emitFilterControl } from
'@superset-ui/chart-controls';
import { MetricsLayoutEnum } from '../types';import { jsx as ___EmotionJSX } from "@emotion/react";

const config = {
  controlPanelSections: [
  { ...sections.legacyTimeseriesTime, expanded: false },
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
    [
    {
      name: 'groupbyColumns',
      config: {
        ...sharedControls.groupby,
        label: t('Columns'),
        description: t('Columns to group by on the columns') } }],



    [
    {
      name: 'groupbyRows',
      config: {
        ...sharedControls.groupby,
        label: t('Rows'),
        description: t('Columns to group by on the rows') } }],



    [
    {
      name: 'metrics',
      config: {
        ...sharedControls.metrics,
        validators: [validateNonEmpty] } }],



    [
    {
      name: 'metricsLayout',
      config: {
        type: 'RadioButtonControl',
        renderTrigger: true,
        label: t('Apply metrics on'),
        default: MetricsLayoutEnum.COLUMNS,
        options: [
        [MetricsLayoutEnum.COLUMNS, t('Columns')],
        [MetricsLayoutEnum.ROWS, t('Rows')]],

        description: t(
        'Use metrics as a top level group for columns or for rows') } }],




    ['adhoc_filters'],
    emitFilterControl,
    ['series_limit'],
    [
    {
      name: 'row_limit',
      config: {
        ...sharedControls.row_limit,
        label: t('Cell limit'),
        description: t('Limits the number of cells that get retrieved.') } }],



    // TODO(kgabryje): add series_columns control after control panel is redesigned to avoid clutter
    [
    {
      name: 'series_limit_metric',
      config: {
        ...sharedControls.series_limit_metric,
        description: t(
        'Metric used to define how the top series are sorted if a series or cell limit is present. ' +
        'If undefined reverts to the first metric (where appropriate).') } }],




    [
    {
      name: 'order_desc',
      config: {
        type: 'CheckboxControl',
        label: t('Sort Descending'),
        default: true,
        description: t('Whether to sort descending or ascending') } }]] },





  {
    label: t('Options'),
    expanded: true,
    tabOverride: 'data',
    controlSetRows: [
    [
    {
      name: 'aggregateFunction',
      config: {
        type: 'SelectControl',
        label: t('Aggregation function'),
        clearable: false,
        choices: formatSelectOptions([
        'Count',
        'Count Unique Values',
        'List Unique Values',
        'Sum',
        'Average',
        'Median',
        'Sample Variance',
        'Sample Standard Deviation',
        'Minimum',
        'Maximum',
        'First',
        'Last',
        'Sum as Fraction of Total',
        'Sum as Fraction of Rows',
        'Sum as Fraction of Columns',
        'Count as Fraction of Total',
        'Count as Fraction of Rows',
        'Count as Fraction of Columns']),

        default: 'Sum',
        description: t(
        'Aggregate function to apply when pivoting and computing the total rows and columns'),

        renderTrigger: true } }],



    [
    {
      name: 'rowTotals',
      config: {
        type: 'CheckboxControl',
        label: t('Show rows total'),
        default: false,
        renderTrigger: true,
        description: t('Display row level total') } }],



    [
    {
      name: 'colTotals',
      config: {
        type: 'CheckboxControl',
        label: t('Show columns total'),
        default: false,
        renderTrigger: true,
        description: t('Display column level total') } }],



    [
    {
      name: 'transposePivot',
      config: {
        type: 'CheckboxControl',
        label: t('Transpose pivot'),
        default: false,
        description: t('Swap rows and columns'),
        renderTrigger: true } }],



    [
    {
      name: 'combineMetric',
      config: {
        type: 'CheckboxControl',
        label: t('Combine metrics'),
        default: false,
        description: t(
        'Display metrics side by side within each column, as ' +
        'opposed to each column being displayed side by side for each metric.'),

        renderTrigger: true } }]] },





  {
    label: t('Options'),
    expanded: true,
    controlSetRows: [
    [
    {
      name: 'valueFormat',
      config: {
        ...sharedControls.y_axis_format,
        label: t('Value format') } }],



    [
    {
      name: 'date_format',
      config: {
        type: 'SelectControl',
        freeForm: true,
        label: t('Date format'),
        default: smartDateFormatter.id,
        renderTrigger: true,
        choices: D3_TIME_FORMAT_OPTIONS,
        description: t('D3 time format for datetime columns') } }],



    [
    {
      name: 'rowOrder',
      config: {
        type: 'SelectControl',
        label: t('Sort rows by'),
        default: 'key_a_to_z',
        choices: [
        // [value, label]
        ['key_a_to_z', t('key a-z')],
        ['key_z_to_a', t('key z-a')],
        ['value_a_to_z', t('value ascending')],
        ['value_z_to_a', t('value descending')]],

        renderTrigger: true,
        description:
        ___EmotionJSX(React.Fragment, null,
        ___EmotionJSX("div", null, t('Change order of rows.')),
        ___EmotionJSX("div", null, t('Available sorting modes:')),
        ___EmotionJSX("ul", null,
        ___EmotionJSX("li", null, t('By key: use row names as sorting key')),
        ___EmotionJSX("li", null, t('By value: use metric values as sorting key')))) } }],






    [
    {
      name: 'colOrder',
      config: {
        type: 'SelectControl',
        label: t('Sort columns by'),
        default: 'key_a_to_z',
        choices: [
        // [value, label]
        ['key_a_to_z', t('key a-z')],
        ['key_z_to_a', t('key z-a')],
        ['value_a_to_z', t('value ascending')],
        ['value_z_to_a', t('value descending')]],

        renderTrigger: true,
        description:
        ___EmotionJSX(React.Fragment, null,
        ___EmotionJSX("div", null, t('Change order of columns.')),
        ___EmotionJSX("div", null, t('Available sorting modes:')),
        ___EmotionJSX("ul", null,
        ___EmotionJSX("li", null, t('By key: use column names as sorting key')),
        ___EmotionJSX("li", null, t('By value: use metric values as sorting key')))) } }],






    [
    {
      name: 'rowSubtotalPosition',
      config: {
        type: 'SelectControl',
        label: t('Rows subtotal position'),
        default: false,
        choices: [
        // [value, label]
        [true, t('Top')],
        [false, t('Bottom')]],

        renderTrigger: true,
        description: t('Position of row level subtotal') } }],



    [
    {
      name: 'colSubtotalPosition',
      config: {
        type: 'SelectControl',
        label: t('Columns subtotal position'),
        default: false,
        choices: [
        // [value, label]
        [true, t('Left')],
        [false, t('Right')]],

        renderTrigger: true,
        description: t('Position of column level subtotal') } }],



    [
    {
      name: 'conditional_formatting',
      config: {
        type: 'ConditionalFormattingControl',
        renderTrigger: true,
        label: t('Conditional formatting'),
        description: t('Apply conditional color formatting to metrics'),
        mapStateToProps(explore) {var _ref, _explore$controls, _explore$controls$met, _explore$datasource$v, _explore$datasource;
          const values = (_ref =
          explore == null ? void 0 : (_explore$controls = explore.controls) == null ? void 0 : (_explore$controls$met = _explore$controls.metrics) == null ? void 0 : _explore$controls$met.value) != null ? _ref :
          [];
          const verboseMap = (_explore$datasource$v = explore == null ? void 0 : (_explore$datasource = explore.datasource) == null ? void 0 : _explore$datasource.verbose_map) != null ? _explore$datasource$v : {};
          const metricColumn = values.map((value) => {
            if (typeof value === 'string') {var _verboseMap$value;
              return { value, label: (_verboseMap$value = verboseMap[value]) != null ? _verboseMap$value : value };
            }
            return { value: value.label, label: value.label };
          });
          return {
            columnOptions: metricColumn,
            verboseMap };

        } } }]] }] };const _default =








config;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(config, "config", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/plugin/controlPanel.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/plugin/controlPanel.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();