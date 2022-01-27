import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
t,
getNumberFormatter,

smartDateVerboseFormatter,

computeMaxFontSize,
BRAND_COLOR,
styled } from
'@superset-ui/core';

import Echart from '../components/Echart';import { jsx as ___EmotionJSX } from "@emotion/react";


const defaultNumberFormatter = getNumberFormatter();

const PROPORTION = {
  // text size: proportion of the chart container sans trendline
  KICKER: 0.1,
  HEADER: 0.3,
  SUBHEADER: 0.125,
  // trendline size: proportion of the whole chart container
  TRENDLINE: 0.3 };
























class BigNumberVis extends React.PureComponent {















  getClassName() {
    const { className, showTrendLine, bigNumberFallback } = this.props;
    const names = `superset-legacy-chart-big-number ${className} ${
    bigNumberFallback ? 'is-fallback-value' : ''
    }`;
    if (showTrendLine) return names;
    return `${names} no-trendline`;
  }

  createTemporaryContainer() {
    const container = document.createElement('div');
    container.className = this.getClassName();
    container.style.position = 'absolute'; // so it won't disrupt page layout
    container.style.opacity = '0'; // and not visible
    return container;
  }

  renderFallbackWarning() {
    const { bigNumberFallback, formatTime, showTimestamp } = this.props;
    if (!bigNumberFallback || showTimestamp) return null;
    return (
      ___EmotionJSX("span", {
        className: "alert alert-warning",
        role: "alert",
        title: t(
        `Last available value seen on %s`,
        formatTime(bigNumberFallback[0])) },


      t('Not up to date')));


  }

  renderKicker(maxHeight) {
    const { timestamp, showTimestamp, formatTime, width } = this.props;
    if (!showTimestamp) return null;

    const text = timestamp === null ? '' : formatTime(timestamp);

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width,
      maxHeight,
      className: 'kicker',
      container });

    container.remove();

    return (
      ___EmotionJSX("div", {
        className: "kicker",
        style: {
          fontSize,
          height: maxHeight } },


      text));


  }

  renderHeader(maxHeight) {
    const { bigNumber, headerFormatter, width } = this.props;
    const text = bigNumber === null ? t('No data') : headerFormatter(bigNumber);

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width,
      maxHeight,
      className: 'header-line',
      container });

    container.remove();

    return (
      ___EmotionJSX("div", {
        className: "header-line",
        style: {
          fontSize,
          height: maxHeight } },


      text));


  }

  renderSubheader(maxHeight) {
    const { bigNumber, subheader, width, bigNumberFallback } = this.props;
    let fontSize = 0;

    const NO_DATA_OR_HASNT_LANDED = t(
    'No data after filtering or data is NULL for the latest time record');

    const NO_DATA = t(
    'Try applying different filters or ensuring your datasource has data');

    let text = subheader;
    if (bigNumber === null) {
      text = bigNumberFallback ? NO_DATA : NO_DATA_OR_HASNT_LANDED;
    }
    if (text) {
      const container = this.createTemporaryContainer();
      document.body.append(container);
      fontSize = computeMaxFontSize({
        text,
        maxWidth: width,
        maxHeight,
        className: 'subheader-line',
        container });

      container.remove();

      return (
        ___EmotionJSX("div", {
          className: "subheader-line",
          style: {
            fontSize,
            height: maxHeight } },


        text));


    }
    return null;
  }

  renderTrendline(maxHeight) {
    const { width, trendLineData, echartOptions } = this.props;

    // if can't find any non-null values, no point rendering the trendline
    if (!(trendLineData != null && trendLineData.some((d) => d[1] !== null))) {
      return null;
    }

    return (
      ___EmotionJSX(Echart, {
        width: Math.floor(width),
        height: maxHeight,
        echartOptions: echartOptions }));


  }

  render() {
    const {
      showTrendLine,
      height,
      kickerFontSize,
      headerFontSize,
      subheaderFontSize } =
    this.props;
    const className = this.getClassName();

    if (showTrendLine) {
      const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
      const allTextHeight = height - chartHeight;

      return (
        ___EmotionJSX("div", { className: className },
        ___EmotionJSX("div", { className: "text-container", style: { height: allTextHeight } },
        this.renderFallbackWarning(),
        this.renderKicker(
        Math.ceil(kickerFontSize * (1 - PROPORTION.TRENDLINE) * height)),

        this.renderHeader(
        Math.ceil(headerFontSize * (1 - PROPORTION.TRENDLINE) * height)),

        this.renderSubheader(
        Math.ceil(
        subheaderFontSize * (1 - PROPORTION.TRENDLINE) * height))),



        this.renderTrendline(chartHeight)));


    }

    return (
      ___EmotionJSX("div", { className: className, style: { height } },
      this.renderFallbackWarning(),
      this.renderKicker(kickerFontSize * height),
      this.renderHeader(Math.ceil(headerFontSize * height)),
      this.renderSubheader(Math.ceil(subheaderFontSize * height))));


  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}BigNumberVis.propTypes = { className: _pt.string, width: _pt.number.isRequired, height: _pt.number.isRequired, bigNumber: _pt.oneOfType([_pt.number, _pt.oneOf([null])]), headerFontSize: _pt.number, kickerFontSize: _pt.number, subheader: _pt.string, subheaderFontSize: _pt.number, showTimestamp: _pt.bool, showTrendLine: _pt.bool, startYAxisAtZero: _pt.bool, timeRangeFixed: _pt.bool, timestamp: _pt.number, trendLineData: _pt.array, mainColor: _pt.string };BigNumberVis.defaultProps = { className: '', headerFormatter: defaultNumberFormatter, formatTime: smartDateVerboseFormatter, headerFontSize: PROPORTION.HEADER, kickerFontSize: PROPORTION.KICKER, mainColor: BRAND_COLOR, showTimestamp: false, showTrendLine: false, startYAxisAtZero: true, subheader: '', subheaderFontSize: PROPORTION.SUBHEADER, timeRangeFixed: false };const _default =
styled(BigNumberVis)`
  font-family: ${({ theme }) => theme.typography.families.sansSerif};
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;

  &.no-trendline .subheader-line {
    padding-bottom: 0.3em;
  }

  .text-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    .alert {
      font-size: ${({ theme }) => theme.typography.sizes.s};
      margin: -0.5em 0 0.4em;
      line-height: 1;
      padding: 2px 4px 3px;
      border-radius: 3px;
    }
  }

  .kicker {
    font-weight: ${({ theme }) => theme.typography.weights.light};
    line-height: 1em;
    padding-bottom: 2em;
  }

  .header-line {
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    position: relative;
    line-height: 1em;
    span {
      position: absolute;
      bottom: 0;
    }
  }

  .subheader-line {
    font-weight: ${({ theme }) => theme.typography.weights.light};
    line-height: 1em;
    padding-bottom: 0;
  }

  &.is-fallback-value {
    .kicker,
    .header-line,
    .subheader-line {
      opacity: 0.5;
    }
  }

  .superset-data-ui-tooltip {
    z-index: 1000;
    background: #000;
  }
`;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(defaultNumberFormatter, "defaultNumberFormatter", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberViz.tsx");reactHotLoader.register(PROPORTION, "PROPORTION", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberViz.tsx");reactHotLoader.register(BigNumberVis, "BigNumberVis", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberViz.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberViz.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();