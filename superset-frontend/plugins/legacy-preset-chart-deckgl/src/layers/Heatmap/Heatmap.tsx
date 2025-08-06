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
import {
  t,
  getSequentialSchemeRegistry,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { commonLayerProps, getColorRange } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { GetLayerType, createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { createTooltipContent } from '../../utilities/tooltipUtils';

function setTooltipContent(formData: QueryFormData) {
  const defaultTooltipGenerator = (o: JsonObject) => {
    const metricLabel =
      formData.size?.label || formData.size?.value || 'Weight';
    const lon = o.coordinate?.[0];
    const lat = o.coordinate?.[1];

    const hasCustomTooltip =
      formData.tooltip_template ||
      (formData.tooltip_contents && formData.tooltip_contents.length > 0);
    const hasObjectData = o.object && Object.keys(o.object).length > 0;

    return (
      <div className="deckgl-tooltip">
        <TooltipRow
          label={`${t('Longitude and Latitude')}: `}
          value={`${lon?.toFixed(6)}, ${lat?.toFixed(6)}`}
        />
        <TooltipRow label="LON: " value={lon?.toFixed(6)} />
        <TooltipRow label="LAT: " value={lat?.toFixed(6)} />
        <TooltipRow
          label={`${metricLabel}: `}
          value={`${o.object?.weight || o.object?.value || 'Aggregated Cell'}`}
        />
        {hasCustomTooltip && !hasObjectData && (
          <TooltipRow
            label={`${t('Note')}: `}
            value={t('Custom fields not available in aggregated heatmap cells')}
          />
        )}
      </div>
    );
  };

  return (o: JsonObject) => {
    // Try to find the closest data point to the hovered coordinate
    let closestPoint = null;
    if (o.coordinate && o.layer?.props?.data) {
      const [hoveredLon, hoveredLat] = o.coordinate;
      let minDistance = Infinity;

      for (const point of o.layer.props.data) {
        if (point.position) {
          const [pointLon, pointLat] = point.position;
          const distance = Math.sqrt(
            Math.pow(hoveredLon - pointLon, 2) +
              Math.pow(hoveredLat - pointLat, 2),
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
          }
        }
      }
    }
    const modifiedO = {
      ...o,
      object: closestPoint || o.object,
    };

    return createTooltipContent(formData, defaultTooltipGenerator)(modifiedO);
  };
}

export const getLayer: GetLayerType<HeatmapLayer> = ({
  formData,
  payload,
  setTooltip,
  setDataMask,
  onContextMenu,
  filterState,
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

  const tooltipContent = setTooltipContent(fd);

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
    opacity: 0.8,
    threshold: 0.03,
    ...commonLayerProps({
      formData: fd,
      setTooltip,
      setTooltipContent: tooltipContent,
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

export default createDeckGLComponent(getLayer, getPoints);
