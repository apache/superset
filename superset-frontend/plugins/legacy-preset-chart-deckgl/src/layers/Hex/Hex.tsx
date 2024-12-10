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
import { Color } from '@deck.gl/core';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import {
  t,
  CategoricalColorNamespace,
  QueryFormData,
  JsonObject,
} from '@superset-ui/core';

import { commonLayerProps, getAggFunc } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { hexToRGB } from '../../utils/colors';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { TooltipProps } from '../../components/Tooltip';

function setTooltipContent(o: JsonObject) {
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

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: () => void,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
) {
  const fd = formData;
  const appliedScheme = fd.color_scheme;
  const colorScale = CategoricalColorNamespace.getScale(appliedScheme);
  const colorRange = colorScale
    .range()
    .map(color => hexToRGB(color)) as Color[];
  let data = payload.data.features;

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }
  const aggFunc = getAggFunc(fd.js_agg_function, p => p?.weight);

  return new HexagonLayer({
    id: `hex-layer-${fd.slice_id}` as const,
    data,
    radius: fd.grid_size,
    extruded: fd.extruded,
    colorRange,
    outline: false,
    // @ts-ignore
    getElevationValue: aggFunc,
    // @ts-ignore
    getColorValue: aggFunc,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  });
}

function getPoints(data: JsonObject[]) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
