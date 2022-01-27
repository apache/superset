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


import DefaultLegend from './DefaultLegend';import { jsx as ___EmotionJSX } from "@emotion/react";

export default function createRenderLegend(
encoder,
data,
props)
{
  if (encoder.hasLegend()) {
    const {
      LegendRenderer = DefaultLegend,
      LegendGroupRenderer,
      LegendItemRenderer,
      LegendItemLabelRenderer,
      LegendItemMarkRenderer } =
    props;

    return () =>
    ___EmotionJSX(LegendRenderer, {
      groups: encoder.getLegendInformation(data),
      LegendGroupRenderer: LegendGroupRenderer,
      LegendItemRenderer: LegendItemRenderer,
      LegendItemMarkRenderer: LegendItemMarkRenderer,
      LegendItemLabelRenderer: LegendItemLabelRenderer });


  }

  return undefined;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(createRenderLegend, "createRenderLegend", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/legend/createRenderLegend.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();