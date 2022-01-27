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
import { LegendItem, LegendLabel } from '@vx/legend';import { jsx as ___EmotionJSX } from "@emotion/react";



const MARK_SIZE = 8;

const MARK_STYLE = { display: 'inline-block' };

export default function DefaultLegendItem({
  group,
  item,
  MarkRenderer,
  LabelRenderer })
{var _ref, _ref2, _item$output$color, _item$output$stroke;
  return (
    ___EmotionJSX(LegendItem, { key: `legend-item-${group.field}-${item.input}`, margin: "0 5px" },
    typeof MarkRenderer === 'undefined' ?
    ___EmotionJSX("svg", { width: MARK_SIZE, height: MARK_SIZE, style: MARK_STYLE },
    ___EmotionJSX("circle", {
      fill:
      // @ts-ignore
      (_ref = (_ref2 = (_item$output$color = item.output.color) != null ? _item$output$color :
      // @ts-ignore
      item.output.fill) != null ? _ref2 :
      // @ts-ignore
      item.output.stroke) != null ? _ref :
      '#ccc',

      stroke:
      // @ts-ignore
      (_item$output$stroke = item.output.stroke) != null ? _item$output$stroke : 'none',

      r: MARK_SIZE / 2,
      cx: MARK_SIZE / 2,
      cy: MARK_SIZE / 2 })) :



    ___EmotionJSX(MarkRenderer, { group: group, item: item }),

    typeof LabelRenderer === 'undefined' ?
    ___EmotionJSX(LegendLabel, { align: "left", margin: "0 0 0 4px" },
    item.input) :


    ___EmotionJSX(LabelRenderer, { group: group, item: item })));



};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(MARK_SIZE, "MARK_SIZE", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/legend/DefaultLegendItem.tsx");reactHotLoader.register(MARK_STYLE, "MARK_STYLE", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/legend/DefaultLegendItem.tsx");reactHotLoader.register(DefaultLegendItem, "DefaultLegendItem", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/legend/DefaultLegendItem.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();