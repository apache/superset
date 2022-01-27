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
import { smartDateFormatter, t } from '@superset-ui/core';
import {

D3_FORMAT_DOCS,
D3_TIME_FORMAT_OPTIONS,
sections } from
'@superset-ui/chart-controls';
import { headerFontSize, subheaderFontSize } from '../sharedControls';const _default =

{
  controlPanelSections: [
  sections.legacyTimeseriesTime,
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [['metric'], ['adhoc_filters']] },

  {
    label: t('Options'),
    expanded: true,
    tabOverride: 'data',
    controlSetRows: [
    [
    {
      name: 'subheader',
      config: {
        type: 'TextControl',
        label: t('Subheader'),
        renderTrigger: true,
        description: t(
        'Description text that shows up below your Big Number') } }]] },






  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [
    [headerFontSize],
    [subheaderFontSize],
    ['y_axis_format'],
    [
    {
      name: 'time_format',
      config: {
        type: 'SelectControl',
        freeForm: true,
        label: t('Date format'),
        renderTrigger: true,
        choices: D3_TIME_FORMAT_OPTIONS,
        description: D3_FORMAT_DOCS,
        default: smartDateFormatter.id } }],



    [
    {
      name: 'force_timestamp_formatting',
      config: {
        type: 'CheckboxControl',
        label: t('Force date format'),
        renderTrigger: true,
        default: false,
        description: t(
        'Use date formatting even when metric value is not a timestamp') } }]] }],







  controlOverrides: {
    y_axis_format: {
      label: t('Number format') } } };export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberTotal/controlPanel.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();