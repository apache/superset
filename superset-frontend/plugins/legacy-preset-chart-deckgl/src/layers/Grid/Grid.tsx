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
import { GridLayer } from '@deck.gl/aggregation-layers';
import {
  CategoricalColorNamespace,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';

import {
  commonLayerProps,
  getAggFunc,
  getColorForBreakpoints,
  getColorRange,
} from '../common';
import sandboxedEval from '../../utils/sandbox';
import { createDeckGLComponent, GetLayerType } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import {
  createTooltipContent,
  CommonTooltipRows,
} from '../../utilities/tooltipUtils';
import { HIGHLIGHT_COLOR_ARRAY, TRANSPARENT_COLOR_ARRAY } from '../../utils';

function defaultTooltipGenerator(o: JsonObject, formData: QueryFormData) {
  const metricLabel = formData.size?.label || formData.size?.value || 'Height';

  return (
    <div className="deckgl-tooltip">
      {CommonTooltipRows.centroid(o)}
      <TooltipRow
        label={`${metricLabel}: `}
        value={`${o.object?.elevationValue || o.object?.value || 'N/A'}`}
      />
    </div>
  );
}

export const getLayer: GetLayerType<GridLayer> = function ({
  formData,
  payload,
  setTooltip,
  setDataMask,
  onContextMenu,
  filterState,
  emitCrossFilters,
}) {
  const fd = formData;
  const appliedScheme = fd.color_scheme;
  const colorScale = CategoricalColorNamespace.getScale(appliedScheme);
  let data = payload.data.features;

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const colorBreakpoints = fd.color_breakpoints;

  const colorSchemeType = fd.color_scheme_type;
  const colorRange = getColorRange({
    defaultBreakpointsColor: fd.deafult_breakpoint_color,
    colorSchemeType,
    colorScale,
    colorBreakpoints,
    fixedColor: fd.color_picker,
  });

  const aggFunc = getAggFunc(fd.js_agg_function, p => p.weight);

  const tooltipContent = createTooltipContent(fd, (o: JsonObject) =>
    defaultTooltipGenerator(o, fd),
  );

  const colorAggFunc =
    colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints
      ? (p: number[]) => getColorForBreakpoints(aggFunc, p, colorBreakpoints)
      : aggFunc;

  return new GridLayer({
    id: `grid-layer-${fd.slice_id}-${JSON.stringify(colorBreakpoints)}`,
    data,
    cellSize: fd.grid_size,
    extruded: fd.extruded,
    colorDomain:
      colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints && colorRange
        ? [0, colorRange.length]
        : undefined,
    colorRange,
    outline: false,
    // @ts-ignore
    getElevationValue: aggFunc,
    // @ts-ignore
    getColorValue: colorAggFunc,
    ...commonLayerProps({
      formData: fd,
      setDataMask,
      setTooltip,
      setTooltipContent: tooltipContent,
      filterState,
      onContextMenu,
      emitCrossFilters,
    }),
    opacity: filterState?.value ? 0.1 : 1,
  });
};

export function getPoints(data: JsonObject[]) {
  return data.map(d => d.position);
}

export const getHighlightLayer: GetLayerType<GridLayer> = function ({
  formData,
  payload,
  filterState,
}) {
  const fd = formData;
  let data = payload.data.features;

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const aggFunc = getAggFunc(fd.js_agg_function, p => p.weight);

  const selectedPointsSet = new Set(
    filterState?.value?.map((sp: [number, number]) => `${sp[0]},${sp[1]}`),
  );

  const colorAggFunc = (p: JsonObject) =>
    selectedPointsSet.has(`${p.position[0]},${p.position[1]}`) ? 1 : 0;

  return new GridLayer({
    id: `grid-highlight-layer-${fd.slice_id}-${JSON.stringify(filterState?.value)}`,
    data,
    cellSize: fd.grid_size,
    extruded: fd.extruded,
    colorDomain: [0, 1],
    colorRange: [TRANSPARENT_COLOR_ARRAY, HIGHLIGHT_COLOR_ARRAY],
    colorAggregation: 'MAX',
    outline: false,
    // @ts-ignore
    getElevationValue: aggFunc,
    getColorWeight: colorAggFunc,
    opacity: 1,
  });
};

export default createDeckGLComponent(getLayer, getPoints, getHighlightLayer);
