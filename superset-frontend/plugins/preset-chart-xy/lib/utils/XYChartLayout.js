import _extends from "@babel/runtime-corejs3/helpers/extends";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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
import { XAxis, YAxis } from '@data-ui/xy-chart';
import { ChartFrame, mergeMargin } from '@superset-ui/core';







import createTickComponent from './createTickComponent';
import computeAxisLayout from './computeAxisLayout';import { jsx as ___EmotionJSX } from "@emotion/react";

export const DEFAULT_LABEL_ANGLE = 40;

// Additional margin to avoid content hidden behind scroll bar
const OVERFLOW_MARGIN = 8;




















export default class XYChartLayout


{


















  constructor(config) {this.chartWidth = void 0;this.chartHeight = void 0;this.containerWidth = void 0;this.containerHeight = void 0;this.margin = void 0;this.xEncoder = void 0;this.xLayout = void 0;this.yEncoder = void 0;this.yLayout = void 0;
    const {
      width,
      height,
      minContentWidth = 0,
      minContentHeight = 0,
      margin,
      xEncoder,
      xTickSize,
      xTickTextStyle,
      autoAdjustXMargin = true,
      yEncoder,
      yTickSize,
      yTickTextStyle,
      autoAdjustYMargin = true } =
    config;

    this.xEncoder = xEncoder;
    this.yEncoder = yEncoder;

    if (typeof yEncoder.axis !== 'undefined') {
      this.yLayout = computeAxisLayout(yEncoder.axis, {
        axisWidth: Math.max(height - margin.top - margin.bottom),
        defaultTickSize: yTickSize,
        tickTextStyle: yTickTextStyle });

    }

    const secondMargin =
    this.yLayout && autoAdjustYMargin ?
    mergeMargin(margin, this.yLayout.minMargin) :
    margin;
    const innerWidth = Math.max(
    width - secondMargin.left - secondMargin.right,
    minContentWidth);


    if (typeof xEncoder.axis !== 'undefined') {
      this.xLayout = computeAxisLayout(xEncoder.axis, {
        axisWidth: innerWidth,
        defaultTickSize: xTickSize,
        tickTextStyle: xTickTextStyle });

    }

    const finalMargin =
    this.xLayout && autoAdjustXMargin ?
    mergeMargin(secondMargin, this.xLayout.minMargin) :
    secondMargin;

    const innerHeight = Math.max(
    height - finalMargin.top - finalMargin.bottom,
    minContentHeight);


    const chartWidth = Math.round(
    innerWidth + finalMargin.left + finalMargin.right);

    const chartHeight = Math.round(
    innerHeight + finalMargin.top + finalMargin.bottom);


    const isOverFlowX = chartWidth > width;
    const isOverFlowY = chartHeight > height;
    if (isOverFlowX) {
      finalMargin.bottom += OVERFLOW_MARGIN;
    }
    if (isOverFlowY) {
      finalMargin.right += OVERFLOW_MARGIN;
    }
    this.chartWidth = isOverFlowX ? chartWidth + OVERFLOW_MARGIN : chartWidth;
    this.chartHeight = isOverFlowY ?
    chartHeight + OVERFLOW_MARGIN :
    chartHeight;
    this.containerWidth = width;
    this.containerHeight = height;
    this.margin = finalMargin;
  }

  renderChartWithFrame(renderChart) {
    return (
      ___EmotionJSX(ChartFrame, {
        width: this.containerWidth,
        height: this.containerHeight,
        contentWidth: this.chartWidth,
        contentHeight: this.chartHeight,
        renderContent: renderChart }));


  }

  renderXAxis(props) {
    const { axis } = this.xEncoder;

    return axis && this.xLayout ?
    ___EmotionJSX(XAxis, _extends({
      label: axis.getTitle(),
      labelOffset: this.xLayout.labelOffset,
      numTicks: axis.config.tickCount,
      orientation: axis.config.orient,
      tickComponent: createTickComponent(this.xLayout),
      tickFormat: axis.formatValue },
    props)) :

    null;
  }

  renderYAxis(props) {
    const { axis } = this.yEncoder;

    return axis && this.yLayout ?
    ___EmotionJSX(YAxis, _extends({
      label: axis.getTitle(),
      labelOffset: this.yLayout.labelOffset,
      numTicks: axis.config.tickCount,
      orientation: axis.config.orient,
      tickFormat: axis.formatValue },
    props)) :

    null;
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_LABEL_ANGLE, "DEFAULT_LABEL_ANGLE", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/utils/XYChartLayout.tsx");reactHotLoader.register(OVERFLOW_MARGIN, "OVERFLOW_MARGIN", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/utils/XYChartLayout.tsx");reactHotLoader.register(XYChartLayout, "XYChartLayout", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/utils/XYChartLayout.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();