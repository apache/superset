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
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { Position } from '@deck.gl/core';
import { t, getSequentialSchemeRegistry, JsonObject } from '@superset-ui/core';
import { isPointInBonds } from '../../utilities/utils';
import { commonLayerProps, getColorRange } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { GetLayerType, createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { HIGHLIGHT_COLOR_ARRAY } from '../../utils';

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
export const getLayer: GetLayerType<HeatmapLayer> = ({
  formData,
  onContextMenu,
  filterState,
  setDataMask,
  setTooltip,
  payload,
  emitCrossFilters,
}) => {
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

  const colorSchemeType = fd.color_scheme_type;
  const colorRange = getColorRange({
    defaultBreakpointsColor: fd.deafult_breakpoint_color,
    colorBreakpoints: fd.color_breakpoints,
    fixedColor: fd.color_picker,
    colorSchemeType,
    colorScale,
  })?.reverse();

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
    ...commonLayerProps({
      formData: fd,
      setTooltip,
      setTooltipContent,
      setDataMask,
      filterState,
      onContextMenu,
      emitCrossFilters,
    }),
  });
};

export function getPoints(data: any[]) {
  return data.map(d => d.position);
}

export const getHighlightLayer: GetLayerType<HeatmapLayer> = ({
  formData,
  filterState,
  payload,
}) => {
  const fd = formData;
  const {
    intensity = 1,
    radius_pixels: radiusPixels = 30,
    aggregation = 'SUM',
    js_data_mutator: jsFnMutator,
  } = fd;
  let data = payload.data.features;

  if (jsFnMutator) {
    // Applying user defined data mutator if defined
    const jsFnMutatorFunction = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutatorFunction(data);
  }

  const dataInside = data.filter((d: JsonObject) =>
    isPointInBonds(d.position, filterState?.value),
  );

  return new HeatmapLayer({
    id: `heatmap-layer-${fd.slice_id}` as const,
    data: dataInside,
    intensity,
    radiusPixels,
    colorRange: [
      [
        HIGHLIGHT_COLOR_ARRAY[0],
        HIGHLIGHT_COLOR_ARRAY[1],
        HIGHLIGHT_COLOR_ARRAY[2],
        55,
      ],
      HIGHLIGHT_COLOR_ARRAY,
    ],
    aggregation: aggregation.toUpperCase(),
    getPosition: (d: { position: Position; weight: number }) => d.position,
    getWeight: (d: { position: number[]; weight: number }) =>
      d.weight ? d.weight : 1,
  });
};

export default createDeckGLComponent(getLayer, getPoints, getHighlightLayer);
