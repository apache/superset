import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import React, { PureComponent } from 'react';
import { ParentSize } from '@vx/responsive';import { jsx as ___EmotionJSX } from "@emotion/react";

const defaultProps = {
  className: '',
  height: 'auto',
  position: 'top',
  width: 'auto' };













const LEGEND_STYLE_BASE = {
  display: 'flex',
  flexGrow: 0,
  flexShrink: 0,
  order: -1 };


const CHART_STYLE_BASE = {
  flexBasis: 'auto',
  flexGrow: 1,
  flexShrink: 1,
  position: 'relative' };


class WithLegend extends PureComponent {


  getContainerDirection() {
    const { position } = this.props;

    if (position === 'left') {
      return 'row';
    }
    if (position === 'right') {
      return 'row-reverse';
    }
    if (position === 'bottom') {
      return 'column-reverse';
    }

    return 'column';
  }

  getLegendJustifyContent() {
    const { legendJustifyContent, position } = this.props;
    if (legendJustifyContent) {
      return legendJustifyContent;
    }

    if (position === 'left' || position === 'right') {
      return 'flex-start';
    }

    return 'flex-end';
  }

  render() {
    const {
      className,
      debounceTime,
      width,
      height,
      position,
      renderChart,
      renderLegend } =
    this.props;

    const isHorizontal = position === 'left' || position === 'right';

    const style = {
      display: 'flex',
      flexDirection: this.getContainerDirection(),
      height,
      width };


    const chartStyle = { ...CHART_STYLE_BASE };
    if (isHorizontal) {
      chartStyle.width = 0;
    } else {
      chartStyle.height = 0;
    }

    const legendDirection = isHorizontal ? 'column' : 'row';
    const legendStyle = {
      ...LEGEND_STYLE_BASE,
      flexDirection: legendDirection,
      justifyContent: this.getLegendJustifyContent() };


    return (
      ___EmotionJSX("div", { className: `with-legend ${className}`, style: style },
      renderLegend &&
      ___EmotionJSX("div", { className: "legend-container", style: legendStyle },
      renderLegend({
        // Pass flexDirection for @vx/legend to arrange legend items
        direction: legendDirection })),



      ___EmotionJSX("div", { className: "main-container", style: chartStyle },
      ___EmotionJSX(ParentSize, { debounceTime: debounceTime },
      (parent) =>
      parent.width > 0 && parent.height > 0 ?
      // Only render when necessary
      renderChart(parent) :
      null))));





  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}WithLegend.propTypes = { className: _pt.string.isRequired, debounceTime: _pt.number, width: _pt.oneOfType([_pt.number, _pt.string]).isRequired, height: _pt.oneOfType([_pt.number, _pt.string]).isRequired, legendJustifyContent: _pt.oneOf(['center', 'flex-start', 'flex-end']), position: _pt.oneOf(['top', 'left', 'bottom', 'right']).isRequired, renderChart: _pt.func.isRequired, renderLegend: _pt.func };WithLegend.defaultProps = defaultProps;const _default =
WithLegend;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/legend/WithLegend.tsx");reactHotLoader.register(LEGEND_STYLE_BASE, "LEGEND_STYLE_BASE", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/legend/WithLegend.tsx");reactHotLoader.register(CHART_STYLE_BASE, "CHART_STYLE_BASE", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/legend/WithLegend.tsx");reactHotLoader.register(WithLegend, "WithLegend", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/legend/WithLegend.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/legend/WithLegend.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();