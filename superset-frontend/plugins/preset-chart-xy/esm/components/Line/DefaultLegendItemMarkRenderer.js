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

import React from 'react';import { jsx as ___EmotionJSX } from "@emotion/react";



const MARK_WIDTH = 12;
const MARK_HEIGHT = 8;

const MARK_STYLE = { display: 'inline-block' };

export default function DefaultLegendItemMarkRenderer({
  item })
{var _item$output$stroke, _item$output$strokeWi, _item$output$strokeDa;
  return (
    ___EmotionJSX("svg", { width: MARK_WIDTH, height: MARK_HEIGHT, style: MARK_STYLE },
    ___EmotionJSX("line", {
      stroke: (_item$output$stroke = item.output.stroke) != null ? _item$output$stroke : 'none',
      strokeWidth: (_item$output$strokeWi = item.output.strokeWidth) != null ? _item$output$strokeWi : 2,
      strokeDasharray: (_item$output$strokeDa = item.output.strokeDasharray) != null ? _item$output$strokeDa : 'none',
      x1: 0,
      x2: MARK_WIDTH,
      y1: MARK_HEIGHT / 2,
      y2: MARK_HEIGHT / 2 })));



};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(MARK_WIDTH, "MARK_WIDTH", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/DefaultLegendItemMarkRenderer.tsx");reactHotLoader.register(MARK_HEIGHT, "MARK_HEIGHT", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/DefaultLegendItemMarkRenderer.tsx");reactHotLoader.register(MARK_STYLE, "MARK_STYLE", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/DefaultLegendItemMarkRenderer.tsx");reactHotLoader.register(DefaultLegendItemMarkRenderer, "DefaultLegendItemMarkRenderer", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/DefaultLegendItemMarkRenderer.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();