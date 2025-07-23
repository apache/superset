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
import { GridLayer } from '@deck.gl/aggregation-layers';
import {
  t,
  CategoricalColorNamespace,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';

import { commonLayerProps, getAggFunc } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { hexToRGB } from '../../utils/colors';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { TooltipProps } from '../../components/Tooltip';
import {
  createTooltipContent,
  CommonTooltipRows,
} from '../../utilities/tooltipUtils';

function defaultTooltipGenerator(o: JsonObject, formData: QueryFormData) {
  const metricLabel = formData.size?.label || formData.size?.value || 'Height';

  // Debug: Log the tooltip object to see its structure
  console.log('Grid tooltip object:', o);
  console.log('Grid tooltip object.object:', o.object);
  console.log(
    'Grid tooltip object.object properties:',
    Object.keys(o.object || {}),
  );

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

  const aggFunc = getAggFunc(fd.js_agg_function, p => p.weight);

  const tooltipContent = createTooltipContent(fd, (o: JsonObject) => {
    console.log('Grid createTooltipContent called with:', o);
    console.log('Grid formData tooltip_contents:', fd.tooltip_contents);
    console.log('Grid formData tooltip_template:', fd.tooltip_template);
    return defaultTooltipGenerator(o, fd);
  });

  return new GridLayer({
    id: `grid-layer-${fd.slice_id}` as const,
    data,
    cellSize: fd.grid_size,
    extruded: fd.extruded,
    colorRange,
    outline: false,
    // @ts-ignore
    getElevationValue: aggFunc,
    // @ts-ignore
    getColorValue: aggFunc,
    ...commonLayerProps(fd, setTooltip, tooltipContent),
  });
}

export function getPoints(data: JsonObject[]) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
