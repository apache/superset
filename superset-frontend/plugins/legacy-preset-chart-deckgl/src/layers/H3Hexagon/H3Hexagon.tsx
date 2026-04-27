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
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { cellToBoundary } from 'h3-js';
import { JsonObject, QueryFormData, t } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import { createDeckGLComponent, GetLayerType } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { createTooltipContent } from '../../utilities/tooltipUtils';
import sandboxedEval from '../../utils/sandbox';
import { H3Feature } from './transformProps';

function defaultTooltipContent(_formData: QueryFormData) {
  const TooltipContent = (o: JsonObject) => {
    const obj = o.object as H3Feature | undefined;
    return (
      <div className="deckgl-tooltip">
        <TooltipRow label={`${t('H3 Index')}: `} value={obj?.hexagon ?? ''} />
        {obj?.elevation !== undefined && (
          <TooltipRow label={`${t('Value')}: `} value={`${obj.elevation}`} />
        )}
      </div>
    );
  };
  TooltipContent.displayName = 'H3HexagonTooltipContent';
  return TooltipContent;
}

export function getPoints(data: H3Feature[]) {
  const points: [number, number][] = [];

  data.forEach(d => {
    const { hexagon } = d;
    if (!hexagon) {
      return;
    }

    try {
      const boundary = cellToBoundary(hexagon);
      if (boundary && boundary.length > 0) {
        const point: [number, number] = [boundary[0][1], boundary[0][0]];
        points.push(point);
      }
    } catch {
      // Skip entries with invalid H3 indices that cause cellToBoundary to throw
    }
  });

  return points;
}

export const getLayer: GetLayerType<H3HexagonLayer> = function ({
  formData,
  payload,
  setTooltip,
  setDataMask,
  filterState,
  onContextMenu,
  emitCrossFilters,
}) {
  const fd = formData;
  const {
    extruded = true,
    coverage = 1,
    elevation_scale: elevationScale = 1,
  } = fd;

  let data = [...payload.data.features];

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const tooltipContentGenerator = createTooltipContent(
    fd,
    defaultTooltipContent(fd),
  );

  return new H3HexagonLayer({
    id: `h3-hexagon-layer-${fd.slice_id}`,
    data,
    extruded: Boolean(extruded),
    coverage,
    elevationScale: elevationScale,

    getHexagon: (d: JsonObject) => d.hexagon,
    getFillColor: (d: JsonObject) => [
      255,
      (1 - (d.elevation || 0) / 500) * 255,
      0,
    ],
    getElevation: (d: JsonObject) => d.elevation || 0,

    ...commonLayerProps({
      formData: fd,
      setDataMask,
      setTooltip,
      setTooltipContent: tooltipContentGenerator,
      filterState,
      onContextMenu,
      emitCrossFilters,
    }),
  });
};

export default createDeckGLComponent(getLayer, getPoints);
