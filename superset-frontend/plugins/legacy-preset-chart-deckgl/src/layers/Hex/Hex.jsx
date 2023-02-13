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
import { HexagonLayer } from 'deck.gl';
import React from 'react';
import { t, CategoricalColorNamespace } from '@superset-ui/core';

import { commonLayerProps, getAggFunc } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { hexToRGB } from '../../utils/colors';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';

function setTooltipContent(o) {
  return (
    <div className="deckgl-tooltip">
      <TooltipRow
        label={t('Centroid (Longitude and Latitude): ')}
        value={`(${o.coordinate[0]}, ${o.coordinate[1]})`}
      />
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Height') + ': '}
        value={`${o.object.elevationValue}`}
      />
    </div>
  );
}

export function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const colorScale = CategoricalColorNamespace.getScale(fd.color_scheme);
  const colorRange = colorScale.range().map(color => hexToRGB(color));
  let data = payload.data.features;

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }
  const aggFunc = getAggFunc(fd.js_agg_function, p => p.weight);

  return new HexagonLayer({
    id: `hex-layer-${fd.slice_id}`,
    data,
    pickable: true,
    radius: fd.grid_size,
    extruded: fd.extruded,
    colorRange,
    outline: false,
    getElevationValue: aggFunc,
    getColorValue: aggFunc,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  });
}

function getPoints(data) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
