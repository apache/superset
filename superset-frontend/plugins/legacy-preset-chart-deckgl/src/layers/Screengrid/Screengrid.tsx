/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
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

import { ScreenGridLayer } from '@deck.gl/aggregation-layers';
import {
  CategoricalColorNamespace,
  JsonObject,
} from '@superset-ui/core';
import { Color } from '@deck.gl/core';
import {
  COLOR_SCHEME_TYPES,
  ColorSchemeType,
  getSelectedColorSchemeType,
} from '../../utilities/utils';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps, getColorRange } from '../common';
import TooltipRow from '../../TooltipRow';
import { GetLayerType, createDeckGLComponent } from '../../factory';

export function getPoints(data: JsonObject[]) {
  return data.map(d => d.position);
}

function setTooltipContent(o: JsonObject) {
  return (
    <div className="deckgl-tooltip">
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Longitude and Latitude') + ': '}
        value={`${o?.coordinate?.[0]}, ${o?.coordinate?.[1]}`}
      />
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Weight') + ': '}
        value={`${o.object?.value}`}
      />
    </div>
  );
}

export const getLayer: GetLayerType<ScreenGridLayer> = function ({
  formData,
  setDataMask,
  filterState,
  onContextMenu,
  payload,
  setTooltip,
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

  const colorSchemeType = getSelectedColorSchemeType(fd) as ColorSchemeType &
    'default';
  const colorRange = getColorRange(fd, colorSchemeType, colorScale);

  const aggFunc = (d: any) => d.weight || 0;

  const defaultScreenGridColorRange = [
    [255, 255, 178],
    [254, 217, 118],
    [254, 178, 76],
    [253, 141, 60],
    [240, 59, 32],
    [189, 0, 38],
  ] as Color[];

  // Passing a layer creator function instead of a layer since the
  // layer needs to be regenerated at each render
  return new ScreenGridLayer({
    id: `screengrid-layer-${fd.slice_id}` as const,
    data,
    cellSizePixels: fd.grid_size,
    colorDomain:
      colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints && colorRange
        ? [0, colorRange.length]
        : undefined,
    colorRange:
      colorSchemeType === 'default' ? defaultScreenGridColorRange : colorRange,
    outline: false,
<<<<<<< HEAD
    getWeight: (d: any) => d.weight || 0,
    ...commonLayerProps({
      formData: fd,
      setDataMask,
      setTooltip,
      setTooltipContent,
      filterState,
      onContextMenu,
      emitCrossFilters,
    }),
=======
    getWeight: aggFunc,
    colorScaleType: colorSchemeType === 'default' ? 'linear' : 'quantize',
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
>>>>>>> 5bc552651 (Add new color options to Grid, Hex, Scatter and Screengrid Charts)
  });
};

export default createDeckGLComponent(getLayer, getPoints);
