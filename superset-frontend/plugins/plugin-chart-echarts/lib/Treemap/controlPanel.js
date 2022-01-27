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
import { t } from '@superset-ui/core';
import {

D3_FORMAT_DOCS,
D3_FORMAT_OPTIONS,
D3_TIME_FORMAT_OPTIONS,
sections,
emitFilterControl } from
'@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';import { jsx as ___EmotionJSX } from "@emotion/react";

const { labelType, numberFormat, showLabels, showUpperLabels, dateFormat } =
DEFAULT_FORM_DATA;

const config = {
  controlPanelSections: [
  sections.legacyRegularTime,
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
    ['groupby'],
    ['metric'],
    ['row_limit'],
    [
    {
      name: 'sort_by_metric',
      config: {
        type: 'CheckboxControl',
        label: t('Sort by metric'),
        description: t(
        'Whether to sort results by the selected metric in descending order.') } }],




    ['adhoc_filters'],
    emitFilterControl] },


  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [
    ['color_scheme'],
    [___EmotionJSX("h1", { className: "section-header" }, t('Labels'))],
    [
    {
      name: 'show_labels',
      config: {
        type: 'CheckboxControl',
        label: t('Show Labels'),
        renderTrigger: true,
        default: showLabels,
        description: t('Whether to display the labels.') } }],



    [
    {
      name: 'show_upper_labels',
      config: {
        type: 'CheckboxControl',
        label: t('Show Upper Labels'),
        renderTrigger: true,
        default: showUpperLabels,
        description: t('Show labels when the node has children.') } }],



    [
    {
      name: 'label_type',
      config: {
        type: 'SelectControl',
        label: t('Label Type'),
        default: labelType,
        renderTrigger: true,
        choices: [
        ['Key', 'Key'],
        ['value', 'Value'],
        ['key_value', 'Category and Value']],

        description: t('What should be shown on the label?') } }],



    [
    {
      name: 'number_format',
      config: {
        type: 'SelectControl',
        freeForm: true,
        label: t('Number format'),
        renderTrigger: true,
        default: numberFormat,
        choices: D3_FORMAT_OPTIONS,
        description: `${t(
        'D3 format syntax: https://github.com/d3/d3-format. ')
        } ${t('Only applies when "Label Type" is set to show values.')}` } }],



    [
    {
      name: 'date_format',
      config: {
        type: 'SelectControl',
        freeForm: true,
        label: t('Date format'),
        renderTrigger: true,
        choices: D3_TIME_FORMAT_OPTIONS,
        default: dateFormat,
        description: D3_FORMAT_DOCS } }]] }] };const _default =








config;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(labelType, "labelType", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/controlPanel.tsx");reactHotLoader.register(numberFormat, "numberFormat", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/controlPanel.tsx");reactHotLoader.register(showLabels, "showLabels", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/controlPanel.tsx");reactHotLoader.register(showUpperLabels, "showUpperLabels", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/controlPanel.tsx");reactHotLoader.register(dateFormat, "dateFormat", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/controlPanel.tsx");reactHotLoader.register(config, "config", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/controlPanel.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/controlPanel.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();