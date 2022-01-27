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
import { ArcLayer } from 'deck.gl';
import React from 'react';
import { t } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';import { jsx as ___EmotionJSX } from "@emotion/react";

function getPoints(data) {
  const points = [];
  data.forEach((d) => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });

  return points;
}

function setTooltipContent(formData) {
  return (o) =>
  ___EmotionJSX("div", { className: "deckgl-tooltip" },
  ___EmotionJSX(TooltipRow, {
    label: `${t('Start (Longitude, Latitude)')}: `,
    value: `${o.object.sourcePosition[0]}, ${o.object.sourcePosition[1]}` }),

  ___EmotionJSX(TooltipRow, {
    label: `${t('End (Longitude, Latitude)')}: `,
    value: `${o.object.targetPosition[0]}, ${o.object.targetPosition[1]}` }),

  formData.dimension &&
  ___EmotionJSX(TooltipRow, {
    label: `${formData.dimension}: `,
    value: `${o.object.cat_color}` }));




}

export function getLayer(fd, payload, onAddFilter, setTooltip) {
  const data = payload.data.features;
  const sc = fd.color_picker;
  const tc = fd.target_color_picker;

  return new ArcLayer({
    data,
    getSourceColor: (d) =>
    d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a],
    getTargetColor: (d) =>
    d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a],
    id: `path-layer-${fd.slice_id}`,
    strokeWidth: fd.stroke_width ? fd.stroke_width : 3,
    ...commonLayerProps(fd, setTooltip, setTooltipContent(fd)) });

}const _default =

createCategoricalDeckGLComponent(getLayer, getPoints);export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(getPoints, "getPoints", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Arc/Arc.jsx");reactHotLoader.register(setTooltipContent, "setTooltipContent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Arc/Arc.jsx");reactHotLoader.register(getLayer, "getLayer", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Arc/Arc.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Arc/Arc.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();