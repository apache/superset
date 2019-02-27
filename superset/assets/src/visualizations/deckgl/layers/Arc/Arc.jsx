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
import { ArcLayer } from 'deck.gl';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';

function getPoints(data) {
  const points = [];
  data.forEach((d) => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });
  return points;
}

export function getLayer(fd, payload, onAddFilter, setTooltip) {
  const data = payload.data.features;
  const sc = fd.colorPicker;
  const tc = fd.targetColorPicker;
  return new ArcLayer({
    id: `path-layer-${fd.sliceId}`,
    data,
    getSourceColor: d => d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a],
    getTargetColor: d => d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a],
    strokeWidth: (fd.strokeWidth) ? fd.strokeWidth : 3,
    ...commonLayerProps(fd, setTooltip),
  });
}

export default createCategoricalDeckGLComponent(getLayer, getPoints);
