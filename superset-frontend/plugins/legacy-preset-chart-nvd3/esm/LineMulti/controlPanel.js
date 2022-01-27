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
import { t, validateNonEmpty } from '@superset-ui/core';
import { sections } from '@superset-ui/chart-controls';
import {
lineInterpolation,
showLegend,
xAxisLabel,
bottomMargin,
xTicksLayout,
xAxisFormat,
xAxisShowMinmax,
showMarkers,
yAxis2Format,
yAxisShowMinmax,
yAxisBounds,
yAxis2ShowMinmax,
yAxis2Bounds } from
'../NVD3Controls';










const config = {
  controlPanelSections: [
  {
    ...sections.legacyRegularTime,
    controlSetRows: [['time_range']] },

  {
    label: t('Chart Options'),
    tabOverride: 'customize',
    expanded: true,
    controlSetRows: [
    ['color_scheme'],
    [
    {
      name: 'prefix_metric_with_slice_name',
      config: {
        type: 'CheckboxControl',
        label: t('Prefix metric name with slice name'),
        default: false,
        renderTrigger: true } },


    null],

    [showLegend],
    [showMarkers],
    [lineInterpolation, null]] },


  {
    label: t('X Axis'),
    expanded: true,
    controlSetRows: [
    [xAxisLabel],
    [bottomMargin],
    [xTicksLayout],
    [xAxisFormat],
    [xAxisShowMinmax, null]] },


  {
    label: t('Y Axis Left'),
    expanded: true,
    controlSetRows: [
    [
    {
      name: 'line_charts',
      config: {
        type: 'SelectAsyncControl',
        multi: true,
        label: t('Left Axis chart(s)'),
        validators: [validateNonEmpty],
        default: [],
        description: t('Choose one or more charts for left axis'),
        dataEndpoint:
        '/sliceasync/api/read?_flt_0_viz_type=line&_flt_7_viz_type=line_multi',
        placeholder: t('Select charts'),
        onAsyncErrorMessage: t('Error while fetching charts'),
        mutator: (data) => {
          if (!data || !data.result) {
            return [];
          }
          return data.result.map((o) => ({
            value: o.id,
            label: o.slice_name }));

        } } }],



    ['y_axis_format'],
    [yAxisShowMinmax],
    [yAxisBounds]] },


  {
    label: t('Y Axis Right'),
    expanded: false,
    controlSetRows: [
    [
    {
      name: 'line_charts_2',
      config: {
        type: 'SelectAsyncControl',
        multi: true,
        label: t('Right Axis chart(s)'),
        validators: [],
        default: [],
        description: t('Choose one or more charts for right axis'),
        dataEndpoint:
        '/sliceasync/api/read?_flt_0_viz_type=line&_flt_7_viz_type=line_multi',
        placeholder: t('Select charts'),
        onAsyncErrorMessage: t('Error while fetching charts'),
        mutator: (data) => {
          if (!data || !data.result) {
            return [];
          }
          return data.result.map((o) => ({
            value: o.id,
            label: o.slice_name }));

        } } }],



    [yAxis2Format],
    [yAxis2ShowMinmax],
    [yAxis2Bounds]] },


  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [['adhoc_filters']] },

  sections.annotations],

  controlOverrides: {
    y_axis_format: {
      label: t('Left Axis Format') } } };const _default =




config;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(config, "config", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/LineMulti/controlPanel.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/LineMulti/controlPanel.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();