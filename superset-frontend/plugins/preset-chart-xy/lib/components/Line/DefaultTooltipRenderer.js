(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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
import { TooltipFrame, TooltipTable } from '@superset-ui/core';
import { chartTheme } from '@data-ui/theme';import { jsx as ___EmotionJSX } from "@emotion/react";


const MARK_STYLE = { marginRight: 4 };

export default function DefaultTooltipRenderer({
  allSeries,
  datum,
  encoder,
  series = {},
  theme = chartTheme })
{
  return (
    ___EmotionJSX(TooltipFrame, null,
    ___EmotionJSX(React.Fragment, null,
    ___EmotionJSX("div", { style: { fontFamily: theme.labelStyles.fontFamily } },
    ___EmotionJSX("strong", null, encoder.channels.x.formatValue(datum.x))),

    ___EmotionJSX("br", null),
    series &&
    ___EmotionJSX(TooltipTable, {
      data: allSeries.
      filter(({ key }) => series[key]).
      concat().
      sort((a, b) => series[b.key].y - series[a.key].y).
      map(({ key, stroke, strokeDasharray, strokeWidth }) => ({
        key,
        keyColumn:
        ___EmotionJSX(React.Fragment, null,
        ___EmotionJSX("svg", { width: "12", height: "8", style: MARK_STYLE },
        ___EmotionJSX("line", {
          x2: "12",
          y1: "3",
          y2: "3",
          stroke: stroke,
          strokeWidth: strokeWidth,
          strokeDasharray: strokeDasharray })),


        series[key] === datum ? ___EmotionJSX("b", null, key) : key),


        valueColumn: encoder.channels.y.formatValue(series[key].y) })) }))));






};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(MARK_STYLE, "MARK_STYLE", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/DefaultTooltipRenderer.tsx");reactHotLoader.register(DefaultTooltipRenderer, "DefaultTooltipRenderer", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/DefaultTooltipRenderer.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();