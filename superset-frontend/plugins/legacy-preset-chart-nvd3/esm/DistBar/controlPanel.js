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
import { ensureIsArray, t, validateNonEmpty } from '@superset-ui/core';
import {


sections,
sharedControls } from
'@superset-ui/chart-controls';
import {
showLegend,
showControls,
xAxisLabel,
bottomMargin,
xTicksLayout,
showBarValue,
barStacked,
reduceXTicks,
yAxisLabel,
yAxisShowMinmax,
yAxisBounds,
richTooltip } from
'../NVD3Controls';

const config = {
  controlPanelSections: [
  sections.legacyRegularTime,
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
    ['metrics'],
    ['adhoc_filters'],
    ['groupby'],
    ['columns'],
    ['row_limit'],
    ['timeseries_limit_metric'],
    [
    {
      name: 'order_desc',
      config: {
        type: 'CheckboxControl',
        label: t('Sort Descending'),
        default: true,
        description: t('Whether to sort descending or ascending'),
        visibility: ({ controls }) =>
        Boolean(controls == null ? void 0 : controls.timeseries_limit_metric.value) } }],



    [
    {
      name: 'contribution',
      config: {
        type: 'CheckboxControl',
        label: t('Contribution'),
        default: false,
        description: t('Compute the contribution to the total') } }]] },





  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [
    ['color_scheme'],
    [showLegend],
    [showBarValue],
    [richTooltip],
    [barStacked],
    [
    {
      name: 'order_bars',
      config: {
        type: 'CheckboxControl',
        label: t('Sort Bars'),
        default: false,
        renderTrigger: true,
        description: t('Sort bars by x labels.') } }],



    ['y_axis_format'],
    [yAxisLabel],
    [showControls, null],
    [yAxisShowMinmax],
    [yAxisBounds]] },


  {
    label: t('X Axis'),
    expanded: true,
    controlSetRows: [
    [xAxisLabel],
    [bottomMargin],
    [xTicksLayout],
    [reduceXTicks]] }],



  controlOverrides: {
    groupby: {
      label: t('Series'),
      validators: [validateNonEmpty],
      mapStateToProps: (state, controlState) => {
        const groupbyProps =
        (sharedControls.groupby.mapStateToProps == null ? void 0 : sharedControls.groupby.mapStateToProps(state, controlState)) || {};
        groupbyProps.canDropValue = (column) => {var _state$controls, _state$controls$colum;return (
            !ensureIsArray((_state$controls = state.controls) == null ? void 0 : (_state$controls$colum = _state$controls.columns) == null ? void 0 : _state$controls$colum.value).includes(
            column.column_name));};

        return groupbyProps;
      },
      rerender: ['columns'] },

    columns: {
      label: t('Breakdowns'),
      description: t('Defines how each series is broken down'),
      mapStateToProps: (state, controlState) => {
        const columnsProps =
        (sharedControls.columns.mapStateToProps == null ? void 0 : sharedControls.columns.mapStateToProps(state, controlState)) || {};
        columnsProps.canDropValue = (column) => {var _state$controls2, _state$controls2$grou;return (
            !ensureIsArray((_state$controls2 = state.controls) == null ? void 0 : (_state$controls2$grou = _state$controls2.groupby) == null ? void 0 : _state$controls2$grou.value).includes(
            column.column_name));};

        return columnsProps;
      },
      rerender: ['groupby'] } } };const _default =




config;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(config, "config", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/DistBar/controlPanel.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/DistBar/controlPanel.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();