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
import { XYChart, PointSeries } from '@data-ui/xy-chart';
import { chartTheme } from '@data-ui/theme';
import { WithLegend } from '@superset-ui/core';
import { isFieldDef } from 'encodable';

import {
scatterPlotEncoderFactory } from



'./Encoder';
import createMarginSelector, {
DEFAULT_MARGIN } from
'../../utils/createMarginSelector';
import DefaultTooltipRenderer from './DefaultTooltipRenderer';
import convertScaleToDataUIScale from '../../utils/convertScaleToDataUIScaleShape';
import createXYChartLayoutWithTheme from '../../utils/createXYChartLayoutWithTheme';
import createRenderLegend from '../legend/createRenderLegend';import { jsx as ___EmotionJSX } from "@emotion/react";







const defaultProps = {
  className: '',
  margin: DEFAULT_MARGIN,
  encoding: {},
  theme: chartTheme,
  TooltipRenderer: DefaultTooltipRenderer };

















export default class ScatterPlot extends PureComponent {constructor(...args) {super(...args);this.
    createEncoder = scatterPlotEncoderFactory.createSelector();this.

    createMargin = createMarginSelector();this.



    renderChart = (dim) => {
      const { width, height } = dim;
      const { data, margin, theme, TooltipRenderer, encoding } = this.props;
      const encoder = this.createEncoder(encoding);
      const { channels } = encoder;

      encoder.setDomainFromDataset(data);

      const encodedData = data.map((d) => ({
        x: channels.x.getValueFromDatum(d),
        y: channels.y.getValueFromDatum(d),
        ...d }));


      const layout = createXYChartLayoutWithTheme({
        width,
        height,
        margin: this.createMargin(margin),
        theme,
        xEncoder: channels.x,
        yEncoder: channels.y });


      return layout.renderChartWithFrame((chartDim) =>
      ___EmotionJSX(XYChart, {
        showYGrid: true,
        width: chartDim.width,
        height: chartDim.height,
        ariaLabel: "ScatterPlot",
        margin: layout.margin,
        renderTooltip: ({ datum }) =>
        ___EmotionJSX(TooltipRenderer, { datum: datum, encoder: encoder }),

        theme: theme
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        , xScale: convertScaleToDataUIScale(channels.x.definition.scale)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        , yScale: convertScaleToDataUIScale(channels.y.definition.scale) },

      layout.renderXAxis(),
      layout.renderYAxis(),
      ___EmotionJSX(PointSeries, {
        key:
        isFieldDef(channels.x.definition) ? channels.x.definition.field : '',

        data: encodedData,
        fill: (d) => channels.fill.encodeDatum(d),
        fillOpacity: 0.5,
        stroke: (d) => channels.stroke.encodeDatum(d),
        size: (d) => channels.size.encodeDatum(d) })));



    };}

  render() {
    const { className, data, width, height, encoding } = this.props;

    return (
      ___EmotionJSX(WithLegend, {
        className: `superset-chart-scatter-plot ${className}`,
        width: width,
        height: height,
        position: "top",
        renderLegend: createRenderLegend(
        this.createEncoder(encoding),
        data,
        this.props),

        renderChart: this.renderChart }));


  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}ScatterPlot.propTypes = { className: _pt.string, width: _pt.oneOfType([_pt.string, _pt.number]).isRequired, height: _pt.oneOfType([_pt.string, _pt.number]).isRequired, TooltipRenderer: _pt.elementType };ScatterPlot.defaultProps = defaultProps;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/ScatterPlot/ScatterPlot.tsx");reactHotLoader.register(ScatterPlot, "ScatterPlot", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/ScatterPlot/ScatterPlot.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();