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
import { ScatterplotLayer } from 'deck.gl';
import React from 'react';
import { getMetricLabel, t } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { unitToRadius } from '../../utils/geo';import { jsx as ___EmotionJSX } from "@emotion/react";

function getPoints(data) {
  return data.map((d) => d.position);
}

function setTooltipContent(formData, verboseMap) {
  return (o) => {var _formData$point_radiu;
    const label =
    (verboseMap == null ? void 0 : verboseMap[formData.point_radius_fixed.value]) ||
    getMetricLabel((_formData$point_radiu = formData.point_radius_fixed) == null ? void 0 : _formData$point_radiu.value);
    return (
      ___EmotionJSX("div", { className: "deckgl-tooltip" },
      ___EmotionJSX(TooltipRow, {
        label: `${t('Longitude and Latitude')}: `,
        value: `${o.object.position[0]}, ${o.object.position[1]}` }),

      o.object.cat_color &&
      ___EmotionJSX(TooltipRow, {
        label: `${t('Category')}: `,
        value: `${o.object.cat_color}` }),


      o.object.metric &&
      ___EmotionJSX(TooltipRow, { label: `${label}: `, value: `${o.object.metric}` })));



  };
}

export function getLayer(
formData,
payload,
onAddFilter,
setTooltip,
datasource)
{
  const fd = formData;
  const dataWithRadius = payload.data.features.map((d) => {
    let radius = unitToRadius(fd.point_unit, d.radius) || 10;
    if (fd.multiplier) {
      radius *= fd.multiplier;
    }
    if (d.color) {
      return { ...d, radius };
    }
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const color = [c.r, c.g, c.b, c.a * 255];

    return { ...d, radius, color };
  });

  return new ScatterplotLayer({
    id: `scatter-layer-${fd.slice_id}`,
    data: dataWithRadius,
    fp64: true,
    getFillColor: (d) => d.color,
    getRadius: (d) => d.radius,
    radiusMinPixels: fd.min_radius || null,
    radiusMaxPixels: fd.max_radius || null,
    stroked: false,
    ...commonLayerProps(
    fd,
    setTooltip,
    setTooltipContent(fd, datasource == null ? void 0 : datasource.verboseMap)) });


}const _default =

createCategoricalDeckGLComponent(getLayer, getPoints);export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(getPoints, "getPoints", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/Scatter.jsx");reactHotLoader.register(setTooltipContent, "setTooltipContent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/Scatter.jsx");reactHotLoader.register(getLayer, "getLayer", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/Scatter.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/Scatter.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();