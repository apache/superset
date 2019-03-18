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
import { commonLayerProps } from '../common';
import sandboxedEval from '../../../../modules/sandbox';
import { createDeckGLComponent } from '../../factory';

export function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const c = fd.colorPicker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  let data = payload.data.features.map(feature => ({
    ...feature,
    path: feature.path,
    width: fd.lineWidth,
    color: fixedColor,
  }));

  if (fd.jsDataMutator) {
    const jsFnMutator = sandboxedEval(fd.jsDataMutator);
    data = jsFnMutator(data);
  }

  return new PathLayer({
    id: `path-layer-${fd.sliceId}`,
    data,
    rounded: true,
    widthScale: 1,
    ...commonLayerProps(fd, setTooltip),
  });
}

function getPoints(data) {
  let points = [];
  data.forEach((d) => {
    points = points.concat(d.path);
  });
  return points;
}

export default createDeckGLComponent(getLayer, getPoints);
