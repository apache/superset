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
import { t, CategoricalColorNamespace, JsonObject } from '@superset-ui/core';

import {
  commonLayerProps,
  getAggFunc,
  getColorForBreakpoints,
  getColorRange,
} from '../common';
import sandboxedEval from '../../utils/sandbox';
import { createDeckGLComponent, GetLayerType } from '../../factory';
import TooltipRow from '../../TooltipRow';
import {
  COLOR_SCHEME_TYPES,
  getSelectedColorSchemeType,
} from '../../utilities/utils';

function setTooltipContent(o: JsonObject) {
  return (
    <div className="deckgl-tooltip">
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Longitude and Latitude') + ': '}
        value={`${o.coordinate[0]}, ${o.coordinate[1]}`}
      />
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Height') + ': '}
        value={`${o.object.elevationValue}`}
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
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const colorSchemeType = getSelectedColorSchemeType(fd);
  const colorRange = getColorRange(fd, colorSchemeType, colorScale);

  const colorBreakpoints = fd.color_breakpoints;

  const aggFunc = getAggFunc(fd.js_agg_function, p => p.weight);

  const colorAggFunc =
    colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints
      ? (p: number[]) => getColorForBreakpoints(aggFunc, p, colorBreakpoints)
      : aggFunc;

  return new GridLayer({
    id: `grid-layer-${fd.slice_id}-${JSON.stringify(colorBreakpoints)}` as const,
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
      setTooltipContent,
      filterState,
      onContextMenu,
      emitCrossFilters,
    }),
  });
};

export function getPoints(data: JsonObject[]) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
