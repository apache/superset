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
import { HeatmapLayer, Position, Color } from 'deck.gl/typed';
import { t, getSequentialSchemeRegistry, JsonObject } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { hexToRGB } from '../../utils/colors';
import { createDeckGLComponent, getLayerType } from '../../factory';
import TooltipRow from '../../TooltipRow';

function setTooltipContent(o: JsonObject) {
  return (
    <div className="deckgl-tooltip">
      <TooltipRow
        label={t('Centroid (Longitude and Latitude): ')}
        value={`(${o?.coordinate[0]}, ${o?.coordinate[1]})`}
      />
    </div>
  );
}
export const getLayer: getLayerType<unknown> = (
  formData,
  payload,
  onAddFilter,
  setTooltip,
) => {
  const fd = formData;
  const {
    intensity = 1,
    radius_pixels: radiusPixels = 30,
    aggregation = 'SUM',
    js_data_mutator: jsFnMutator,
    linear_color_scheme: colorScheme,
  } = fd;
  let data = payload.data.features;

  if (jsFnMutator) {
    // Applying user defined data mutator if defined
    const jsFnMutatorFunction = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutatorFunction(data);
  }

  const colorScale = getSequentialSchemeRegistry()
    ?.get(colorScheme)
    ?.createLinearScale([0, 6]);
  const colorRange = colorScale
    ?.range()
    ?.map(color => hexToRGB(color))
    ?.reverse() as Color[];

  return new HeatmapLayer({
    id: `heatmap-layer-${fd.slice_id}` as const,
    data,
    intensity,
    radiusPixels,
    colorRange,
    aggregation: aggregation.toUpperCase(),
    getPosition: (d: { position: Position; weight: number }) => d.position,
    getWeight: (d: { position: number[]; weight: number }) =>
      d.weight ? d.weight : 1,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  });
};

function getPoints(data: any[]) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
