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


sharedControls } from
'@superset-ui/chart-controls';
import { DEFAULT_LEGEND_FORM_DATA } from './types';import { jsx as ___EmotionJSX } from "@emotion/react";

const { legendMargin, legendOrientation, legendType, showLegend } =
DEFAULT_LEGEND_FORM_DATA;

const showLegendControl = {
  name: 'show_legend',
  config: {
    type: 'CheckboxControl',
    label: t('Show legend'),
    renderTrigger: true,
    default: showLegend,
    description: t('Whether to display a legend for the chart') } };



const legendMarginControl = {
  name: 'legendMargin',
  config: {
    type: 'TextControl',
    label: t('Margin'),
    renderTrigger: true,
    isInt: true,
    default: legendMargin,
    description: t('Additional padding for legend.'),
    visibility: ({ controls }) => {var _controls$show_legend;return (
        Boolean(controls == null ? void 0 : (_controls$show_legend = controls.show_legend) == null ? void 0 : _controls$show_legend.value));} } };



const legendTypeControl = {
  name: 'legendType',
  config: {
    type: 'SelectControl',
    freeForm: false,
    label: 'Type',
    choices: [
    ['scroll', 'Scroll'],
    ['plain', 'Plain']],

    default: legendType,
    renderTrigger: true,
    description: t('Legend type'),
    visibility: ({ controls }) => {var _controls$show_legend2;return (
        Boolean(controls == null ? void 0 : (_controls$show_legend2 = controls.show_legend) == null ? void 0 : _controls$show_legend2.value));} } };



const legendOrientationControl = {
  name: 'legendOrientation',
  config: {
    type: 'SelectControl',
    freeForm: false,
    label: 'Orientation',
    choices: [
    ['top', 'Top'],
    ['bottom', 'Bottom'],
    ['left', 'Left'],
    ['right', 'Right']],

    default: legendOrientation,
    renderTrigger: true,
    description: t('Legend type'),
    visibility: ({ controls }) => {var _controls$show_legend3;return (
        Boolean(controls == null ? void 0 : (_controls$show_legend3 = controls.show_legend) == null ? void 0 : _controls$show_legend3.value));} } };



export const legendSection = [
[___EmotionJSX("h1", { className: "section-header" }, t('Legend'))],
[showLegendControl],
[legendTypeControl],
[legendOrientationControl],
[legendMarginControl]];


const showValueControl = {
  name: 'show_value',
  config: {
    type: 'CheckboxControl',
    label: t('Show Value'),
    default: false,
    renderTrigger: true,
    description: t('Show series values on the chart') } };



const stackControl = {
  name: 'stack',
  config: {
    type: 'CheckboxControl',
    label: t('Stack series'),
    renderTrigger: true,
    default: false,
    description: t('Stack series on top of each other') } };



const onlyTotalControl = {
  name: 'only_total',
  config: {
    type: 'CheckboxControl',
    label: t('Only Total'),
    default: true,
    renderTrigger: true,
    description: t(
    'Only show the total value on the stacked chart, and not show on the selected category'),

    visibility: ({ controls }) => {var _controls$show_value, _controls$stack;return (
        Boolean(controls == null ? void 0 : (_controls$show_value = controls.show_value) == null ? void 0 : _controls$show_value.value) && Boolean(controls == null ? void 0 : (_controls$stack = controls.stack) == null ? void 0 : _controls$stack.value));} } };



export const showValueSection = [
[showValueControl],
[stackControl],
[onlyTotalControl]];


const richTooltipControl = {
  name: 'rich_tooltip',
  config: {
    type: 'CheckboxControl',
    label: t('Rich tooltip'),
    renderTrigger: true,
    default: true,
    description: t(
    'Shows a list of all series available at that point in time') } };




const tooltipTimeFormatControl = {
  name: 'tooltipTimeFormat',
  config: {
    ...sharedControls.x_axis_time_format,
    label: t('Tooltip time format'),
    default: 'smart_date',
    clearable: false } };



const tooltipSortByMetricControl = {
  name: 'tooltipSortByMetric',
  config: {
    type: 'CheckboxControl',
    label: t('Tooltip sort by metric'),
    renderTrigger: true,
    default: false,
    description: t(
    'Whether to sort tooltip by the selected metric in descending order.'),

    visibility: ({ controls }) => {var _controls$rich_toolti;return (
        Boolean(controls == null ? void 0 : (_controls$rich_toolti = controls.rich_tooltip) == null ? void 0 : _controls$rich_toolti.value));} } };



export const richTooltipSection = [
[___EmotionJSX("h1", { className: "section-header" }, t('Tooltip'))],
[richTooltipControl],
[tooltipSortByMetricControl],
[tooltipTimeFormatControl]];;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(legendMargin, "legendMargin", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(legendOrientation, "legendOrientation", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(legendType, "legendType", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(showLegend, "showLegend", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(showLegendControl, "showLegendControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(legendMarginControl, "legendMarginControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(legendTypeControl, "legendTypeControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(legendOrientationControl, "legendOrientationControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(legendSection, "legendSection", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(showValueControl, "showValueControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(stackControl, "stackControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(onlyTotalControl, "onlyTotalControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(showValueSection, "showValueSection", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(richTooltipControl, "richTooltipControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(tooltipTimeFormatControl, "tooltipTimeFormatControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(tooltipSortByMetricControl, "tooltipSortByMetricControl", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");reactHotLoader.register(richTooltipSection, "richTooltipSection", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/controls.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();