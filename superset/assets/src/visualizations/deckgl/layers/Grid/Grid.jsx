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
import { GridLayer } from 'deck.gl';

import { commonLayerProps, getAggFunc  } from '../common';
import sandboxedEval from '../../../../modules/sandbox';
import { createDeckGLComponent } from '../../factory';

export function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const c = fd.colorPicker;
  let data = payload.data.features.map(d => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

  if (fd.jsDataMutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.jsDataMutator);
    data = jsFnMutator(data);
  }

  const aggFunc = getAggFunc(fd.jsAggFunction, p => p.weight);
  return new GridLayer({
    id: `grid-layer-${fd.sliceId}`,
    data,
    pickable: true,
    cellSize: fd.gridSize,
    minColor: [0, 0, 0, 0],
    extruded: fd.extruded,
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getElevationValue: aggFunc,
    getColorValue: aggFunc,
    ...commonLayerProps(fd, setTooltip),
  });
}

function getPoints(data) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
