function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

/* eslint-disable react/no-array-index-key */

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
import TooltipRow from '../../TooltipRow';

function setTooltipContent(o) {
  return o.object.extraProps && React.createElement("div", {
    className: "deckgl-tooltip"
  }, Object.keys(o.object.extraProps).map((prop, index) => React.createElement(TooltipRow, {
    key: "prop-" + index,
    label: prop + ": ",
    value: "" + o.object.extraProps[prop]
  })));
}

export function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  let data = payload.data.features.map(feature => _extends({}, feature, {
    path: feature.path,
    width: fd.line_width,
    color: fixedColor
  }));

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new PathLayer(_extends({
    id: "path-layer-" + fd.slice_id,
    getColor: d => d.color,
    getPath: d => d.path,
    getWidth: d => d.width,
    data,
    rounded: true,
    widthScale: 1
  }, commonLayerProps(fd, setTooltip, setTooltipContent)));
}

function getPoints(data) {
  let points = [];
  data.forEach(d => {
    points = points.concat(d.path);
  });
  return points;
}

export default createDeckGLComponent(getLayer, getPoints);