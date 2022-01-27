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
import { GridLayer } from 'deck.gl';
import React from 'react';
import { t } from '@superset-ui/core';

import { commonLayerProps, getAggFunc } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';import { jsx as ___EmotionJSX } from "@emotion/react";

function setTooltipContent(o) {
  return (
    ___EmotionJSX("div", { className: "deckgl-tooltip" },
    ___EmotionJSX(TooltipRow, {
      label: `${t('Longitude and Latitude')}: `,
      value: `${o.coordinate[0]}, ${o.coordinate[1]}` }),

    ___EmotionJSX(TooltipRow, {
      label: `${t('Height')}: `,
      value: `${o.object.elevationValue}` })));



}

export function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const c = fd.color_picker;
  let data = payload.data.features.map((d) => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a] }));


  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const aggFunc = getAggFunc(fd.js_agg_function, (p) => p.weight);

  return new GridLayer({
    id: `grid-layer-${fd.slice_id}`,
    data,
    pickable: true,
    cellSize: fd.grid_size,
    minColor: [0, 0, 0, 0],
    extruded: fd.extruded,
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getElevationValue: aggFunc,
    getColorValue: aggFunc,
    ...commonLayerProps(fd, setTooltip, setTooltipContent) });

}

function getPoints(data) {
  return data.map((d) => d.position);
}const _default =

createDeckGLComponent(getLayer, getPoints);export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(setTooltipContent, "setTooltipContent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Grid/Grid.jsx");reactHotLoader.register(getLayer, "getLayer", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Grid/Grid.jsx");reactHotLoader.register(getPoints, "getPoints", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Grid/Grid.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Grid/Grid.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();