(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /* eslint-disable react/no-array-index-key */
/**
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
import { PathLayer } from 'deck.gl';
import React from 'react';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';import { jsx as ___EmotionJSX } from "@emotion/react";

function setTooltipContent(o) {
  return (
    o.object.extraProps &&
    ___EmotionJSX("div", { className: "deckgl-tooltip" },
    Object.keys(o.object.extraProps).map((prop, index) =>
    ___EmotionJSX(TooltipRow, {
      key: `prop-${index}`,
      label: `${prop}: `,
      value: `${o.object.extraProps[prop]}` }))));





}

export function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  let data = payload.data.features.map((feature) => ({
    ...feature,
    path: feature.path,
    width: fd.line_width,
    color: fixedColor }));


  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new PathLayer({
    id: `path-layer-${fd.slice_id}`,
    getColor: (d) => d.color,
    getPath: (d) => d.path,
    getWidth: (d) => d.width,
    data,
    rounded: true,
    widthScale: 1,
    ...commonLayerProps(fd, setTooltip, setTooltipContent) });

}

function getPoints(data) {
  let points = [];
  data.forEach((d) => {
    points = points.concat(d.path);
  });

  return points;
}const _default =

createDeckGLComponent(getLayer, getPoints);export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(setTooltipContent, "setTooltipContent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Path/Path.jsx");reactHotLoader.register(getLayer, "getLayer", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Path/Path.jsx");reactHotLoader.register(getPoints, "getPoints", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Path/Path.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Path/Path.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();