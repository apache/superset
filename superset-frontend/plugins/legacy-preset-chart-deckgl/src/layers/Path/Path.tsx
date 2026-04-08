/* eslint-disable react/no-array-index-key */
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
import { PathLayer } from '@deck.gl/layers';
import { JsonObject, QueryFormData } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { GetLayerType, createCategoricalDeckGLComponent } from '../../factory';
import { Point } from '../../types';
import {
  createTooltipContent,
  CommonTooltipRows,
} from '../../utilities/tooltipUtils';
import { HIGHLIGHT_COLOR_ARRAY } from '../../utils';
import { isMetricValue } from '../utils/metricUtils';

function setTooltipContent(formData: QueryFormData) {
  const defaultTooltipGenerator = (o: JsonObject) => (
    <div className="deckgl-tooltip">
      {CommonTooltipRows.position(o)}
      {CommonTooltipRows.category(o)}
    </div>
  );

  return createTooltipContent(formData, defaultTooltipGenerator);
}

export const getLayer: GetLayerType<PathLayer> = function ({
  formData,
  payload,
  onContextMenu,
  filterState,
  setDataMask,
  setTooltip,
  emitCrossFilters,
}) {
  const fd = formData;
  let data = payload.data.features.map((feature: JsonObject) => {
    if (feature.color) {
      return { ...feature };
    }

    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const color = [c.r, c.g, c.b, 255 * c.a];

    return {
      ...feature,
      path: feature.path,
      color,
    };
  });

  // Variables for width scaling and normalization
  const minWidth = Number(fd.min_width) || 1; // defaulted to 1
  const maxWidth = Number(fd.max_width) || 20; // defaulted to 20
  const multiplier = Number(fd.line_width_multiplier) || 1; // defaulted to 1

  const widths = data
    .map((d: JsonObject) => d.width)
    .filter((w: any): w is number => w != null);

  // Metric or fixed value
  const isMetricWidth = isMetricValue(fd.line_width);

  if (isMetricWidth) {
    // Get minimum and maximum widths in data set
    const minVal = Math.min(...widths);
    const maxVal = Math.max(...widths);

    data = data.map((d: JsonObject) => {
      if (d.width == null) return { ...d, width: minWidth };

      const normalized =
        maxVal === minVal ? 0.5 : (d.width - minVal) / (maxVal - minVal);

      // Map within range of min + max
      let width = minWidth + normalized * (maxWidth - minWidth);

      // Apply scaling multiplier
      width *= multiplier;

      // Enforce minimum and maximum width bounds
      width = Math.max(minWidth, Math.min(maxWidth, width));

      return { ...d, width };
    });
  } else {
    // Fixed width mode
    // Allows for use with legacy charts
    const fixedWidth =
      typeof fd.line_width === 'number'
        ? fd.line_width
        : typeof fd.line_width === 'object' && fd.line_width?.type === 'fix'
          ? Number(fd.line_width.value)
          : undefined;

    data = data.map((d: JsonObject) => {
      let width = (d.width ?? fixedWidth ?? 1) * multiplier;
      width = Math.max(minWidth, Math.min(maxWidth, width));
      return { ...d, width };
    });
  }

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new PathLayer({
    id: `path-layer-${fd.slice_id}` as const,
    getColor: (d: any) => d.color || [0, 0, 0, 255],
    getPath: (d: any) => d.path,
    getWidth: (d: any) => d.width,
    data,
    rounded: true,
    widthScale: 1,
    widthUnits: fd.line_width_unit,
    widthMinPixels: Number(fd.min_width) || undefined,
    widthMaxPixels: Number(fd.max_width) || undefined,
    ...commonLayerProps({
      formData: fd,
      setTooltip,
      setTooltipContent: setTooltipContent(fd),
      setDataMask,
      filterState,
      onContextMenu,
      emitCrossFilters,
    }),
    opacity: filterState?.value ? 0.3 : 1,
  });
};

export function getPoints(data: JsonObject[]) {
  let points: Point[] = [];
  data.forEach(d => {
    points = points.concat(d.path);
  });

  return points;
}

export const getHighlightLayer: GetLayerType<PathLayer> = function ({
  formData,
  payload,
  filterState,
}) {
  const fd = formData;
  const fixedColor = HIGHLIGHT_COLOR_ARRAY;
  let data = payload.data.features.map((feature: JsonObject) => {
    let width = feature.width;
    if (fd.line_width_multiplier) {
      width *= fd.line_width_multiplier;
    }
    return {
      ...feature,
      path: feature.path,
      width,
      color: fixedColor,
    };
  });

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const filteredData = data.filter(
    (d: JsonObject) =>
      JSON.stringify(d.path).replaceAll(' ', '') === filterState?.value[0],
  );

  return new PathLayer({
    id: `path-highlight-layer-${fd.slice_id}` as const,
    getColor: () => HIGHLIGHT_COLOR_ARRAY,
    getPath: (d: any) => d.path,
    getWidth: (d: any) => d.width,
    data: filteredData,
    rounded: true,
    widthScale: 1,
    widthUnits: fd.line_width_unit,
    widthMinPixels: Number(fd.min_width) || undefined,
    widthMaxPixels: Number(fd.max_width) || undefined,
  });
};

export default createCategoricalDeckGLComponent(
  getLayer,
  getPoints,
  getHighlightLayer,
);
