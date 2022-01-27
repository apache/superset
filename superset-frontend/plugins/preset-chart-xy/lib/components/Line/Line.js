import _pt from "prop-types";import _values from "lodash/values";import _uniqueId from "lodash/uniqueId";import _flatMap from "lodash/flatMap";import _groupBy from "lodash/groupBy";import _kebabCase from "lodash/kebabCase";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import {
AreaSeries,
LinearGradient,
LineSeries,
XYChart,
CrossHair,
WithTooltip } from
'@data-ui/xy-chart';
import { chartTheme } from '@data-ui/theme';
import { WithLegend } from '@superset-ui/core';
import { createSelector } from 'reselect';

import DefaultTooltipRenderer from './DefaultTooltipRenderer';
import createMarginSelector, {
DEFAULT_MARGIN } from
'../../utils/createMarginSelector';
import convertScaleToDataUIScale from '../../utils/convertScaleToDataUIScaleShape';
import createXYChartLayoutWithTheme from '../../utils/createXYChartLayoutWithTheme';
import createRenderLegend from '../legend/createRenderLegend';

import {
lineEncoderFactory } from




'./Encoder';
import DefaultLegendItemMarkRenderer from './DefaultLegendItemMarkRenderer';import { jsx as ___EmotionJSX } from "@emotion/react";











const defaultProps = {
  className: '',
  encoding: {},
  LegendItemMarkRenderer: DefaultLegendItemMarkRenderer,
  margin: DEFAULT_MARGIN,
  theme: chartTheme,
  TooltipRenderer: DefaultTooltipRenderer };


/** Part of formData that is needed for rendering logic in this file */



































const CIRCLE_STYLE = { strokeWidth: 1.5 };

export default class LineChart extends PureComponent {constructor(...args) {super(...args);this.
    createEncoder = lineEncoderFactory.createSelector();this.

    createAllSeries = createSelector(
    (input) => input.encoder,
    (input) => input.data,
    (encoder, data) => {
      const { channels } = encoder;
      const fieldNames = encoder.getGroupBys();

      const groups = _groupBy(data, (row) =>
      fieldNames.map((f) => `${f}=${row[f]}`).join(','));


      const allSeries = _values(groups).map((seriesData) => {
        const firstDatum = seriesData[0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const key = fieldNames.map((f) => firstDatum[f]).join(',');
        const series = {
          key: key.length === 0 ? channels.y.getTitle() : key,
          fill: channels.fill.encodeDatum(firstDatum, false),
          stroke: channels.stroke.encodeDatum(firstDatum, '#222'),
          strokeDasharray: channels.strokeDasharray.encodeDatum(firstDatum, ''),
          strokeWidth: channels.strokeWidth.encodeDatum(firstDatum, 1),
          values: [] };


        series.values = seriesData.
        map((v) => ({
          x: channels.x.getValueFromDatum(v),
          y: channels.y.getValueFromDatum(v),
          data: v,
          parent: series })).

        sort((a, b) => {
          const aTime = a.x instanceof Date ? a.x.getTime() : a.x;
          const bTime = b.x instanceof Date ? b.x.getTime() : b.x;

          return aTime - bTime;
        });

        return series;
      });

      return allSeries;
    });this.


    createMargin = createMarginSelector();this.
















































    renderChart = (dim) => {
      const { width, height } = dim;
      const { data, margin, theme, TooltipRenderer, encoding } = this.props;

      const encoder = this.createEncoder(encoding);
      const { channels } = encoder;

      encoder.setDomainFromDataset(data);

      const allSeries = this.createAllSeries({ encoder, data });

      const layout = createXYChartLayoutWithTheme({
        width,
        height,
        margin: this.createMargin(margin),
        theme,
        xEncoder: channels.x,
        yEncoder: channels.y });


      return layout.renderChartWithFrame((chartDim) =>
      ___EmotionJSX(WithTooltip, {
        renderTooltip: ({
          datum,
          series }) =>






        ___EmotionJSX(TooltipRenderer, {
          encoder: encoder,
          allSeries: allSeries,
          datum: datum,
          series: series,
          theme: theme }) },



      ({
        onMouseLeave,
        onMouseMove,
        tooltipData }) =>





      ___EmotionJSX(XYChart, {
        showYGrid: true,
        snapTooltipToDataX: true,
        width: chartDim.width,
        height: chartDim.height,
        ariaLabel: "LineChart",
        eventTrigger: "container",
        margin: layout.margin,
        renderTooltip: null,
        theme: theme,
        tooltipData: tooltipData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        , xScale: convertScaleToDataUIScale(
        channels.x.definition.scale)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        , yScale: convertScaleToDataUIScale(
        channels.y.definition.scale),

        onMouseMove: onMouseMove,
        onMouseLeave: onMouseLeave },

      layout.renderXAxis(),
      layout.renderYAxis(),
      this.renderSeries(allSeries),
      ___EmotionJSX(CrossHair, {
        fullHeight: true,
        showCircle: true,
        showMultipleCircles: true,
        strokeDasharray: "",
        showHorizontalLine: false,
        circleFill: (d) =>
        d.y === tooltipData.datum.y ? d.parent.stroke : '#fff',

        circleSize: (d) =>
        d.y === tooltipData.datum.y ? 6 : 4,

        circleStroke: (d) =>
        d.y === tooltipData.datum.y ? '#fff' : d.parent.stroke,

        circleStyles: CIRCLE_STYLE,
        stroke: "#ccc" }))));





    };} // eslint-disable-next-line class-methods-use-this
  renderSeries(allSeries) {const filledSeries = _flatMap(allSeries.filter(({ fill }) => fill).map((series) => {const gradientId = _uniqueId(_kebabCase(`gradient-${series.key}`));return [___EmotionJSX(LinearGradient, { key: `${series.key}-gradient`, id: gradientId, from: series.stroke, to: "#fff" }), ___EmotionJSX(AreaSeries, { key: `${series.key}-fill`, seriesKey: series.key, data: series.values, interpolation: "linear", fill: `url(#${gradientId})`, stroke: series.stroke, strokeWidth: series.strokeWidth })];}));const unfilledSeries = allSeries.filter(({ fill }) => !fill).map((series) => ___EmotionJSX(LineSeries, { key: series.key, seriesKey: series.key, interpolation: "linear", data: series.values, stroke: series.stroke, strokeDasharray: series.strokeDasharray, strokeWidth: series.strokeWidth }));return filledSeries.concat(unfilledSeries);}
  render() {
    const { className, data, width, height, encoding } = this.props;

    return (
      ___EmotionJSX(WithLegend, {
        className: `superset-chart-line ${className}`,
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
    this[key] = eval(code);}}LineChart.propTypes = { className: _pt.string, width: _pt.oneOfType([_pt.string, _pt.number]).isRequired, height: _pt.oneOfType([_pt.string, _pt.number]).isRequired, TooltipRenderer: _pt.elementType, theme: _pt.any };LineChart.defaultProps = defaultProps;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/Line.tsx");reactHotLoader.register(CIRCLE_STYLE, "CIRCLE_STYLE", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/Line.tsx");reactHotLoader.register(LineChart, "LineChart", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/Line.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();