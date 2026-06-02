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
import { ArcLayer } from '@deck.gl/layers';
import { JsonObject, QueryFormData } from '@superset-ui/core';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import { commonLayerProps } from '../common';
import { GetLayerType, createCategoricalDeckGLComponent } from '../../factory';
import { Point } from '../../types';
import {
  createTooltipContent,
  CommonTooltipRows,
} from '../../utilities/tooltipUtils';
import { HIGHLIGHT_COLOR_ARRAY, TRANSPARENT_COLOR_ARRAY } from '../../utils';

interface ArcDataItem {
  sourceColor?: number[];
  targetColor?: number[];
  color?: number[];
  sourcePosition: number[];
  targetPosition: number[];
  [key: string]: unknown;
}

export function getPoints(data: JsonObject[]) {
  const points: Point[] = [];
  data.forEach(d => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });

  return points;
}

function setTooltipContent(formData: QueryFormData) {
  const defaultTooltipGenerator = (o: JsonObject) => (
    <div className="deckgl-tooltip">
      {CommonTooltipRows.arcPositions(o)}
      {CommonTooltipRows.category(o)}
    </div>
  );

  return createTooltipContent(formData, defaultTooltipGenerator);
}

export const getLayer: GetLayerType<ArcLayer> = function ({
  formData,
  payload,
  setTooltip,
  filterState,
  setDataMask,
  onContextMenu,
  emitCrossFilters,
}) {
  const fd = formData;
  const data = payload.data.features;
  const sc = fd.color_picker;
  const tc = fd.target_color_picker;

  const colorSchemeType = fd.color_scheme_type;

  return new ArcLayer({
    data,
    getSourceColor: (d: ArcDataItem): [number, number, number, number] => {
      if (colorSchemeType === COLOR_SCHEME_TYPES.fixed_color) {
        return [sc.r, sc.g, sc.b, 255 * sc.a];
      }
      return (d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a]) as [
        number,
        number,
        number,
        number,
      ];
    },
    getTargetColor: (d: ArcDataItem): [number, number, number, number] => {
      if (colorSchemeType === COLOR_SCHEME_TYPES.fixed_color) {
        return [tc.r, tc.g, tc.b, 255 * tc.a];
      }
      return (d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a]) as [
        number,
        number,
        number,
        number,
      ];
    },
    id: `path-layer-${fd.slice_id}` as const,
    getWidth: fd.stroke_width ? fd.stroke_width : 3,
    ...commonLayerProps({
      formData: fd,
      setTooltip,
      setTooltipContent: setTooltipContent(fd),
      onContextMenu,
      setDataMask,
      filterState,
      emitCrossFilters,
    }),
    opacity: filterState?.value ? 0.1 : 1,
  });
};

export const getHighlightLayer: GetLayerType<ArcLayer> = function ({
  formData,
  payload,
  filterState,
}) {
  const fd = formData;
  const data = payload.data.features;

  const getColor = (d: {
    sourcePosition: [number, number];
    targetPosition: [number, number];
  }) => {
    const sourcePosition = filterState?.value[0];
    const targetPosition = filterState?.value[1];

    if (
      sourcePosition &&
      targetPosition &&
      d.sourcePosition[0] === sourcePosition[0] &&
      d.sourcePosition[1] === sourcePosition[1] &&
      d.targetPosition[0] === targetPosition[0] &&
      d.targetPosition[1] === targetPosition[1]
    ) {
      return HIGHLIGHT_COLOR_ARRAY;
    }

    return TRANSPARENT_COLOR_ARRAY;
  };

  return new ArcLayer({
    data,
    getSourceColor: getColor,
    getTargetColor: getColor,
    id: `path-hihglight-layer-${fd.slice_id}` as const,
    getWidth: fd.stroke_width ? fd.stroke_width : 3,
  });
};

export default createCategoricalDeckGLComponent(
  getLayer,
  getPoints,
  getHighlightLayer,
);
