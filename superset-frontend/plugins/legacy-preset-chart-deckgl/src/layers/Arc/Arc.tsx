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
import {
  HandlerFunction,
  JsonObject,
  QueryFormData,
  t,
} from '@superset-ui/core';
import {
  COLOR_SCHEME_TYPES,
  getSelectedColorSchemeType,
} from '../../utilities/utils';
import { commonLayerProps } from '../common';
import { GetLayerType, createCategoricalDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { Point } from '../../types';

export function getPoints(data: JsonObject[]) {
  const points: Point[] = [];
  data.forEach(d => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });

  return points;
}

function setTooltipContent(formData: QueryFormData) {
  return (o: JsonObject) => (
    <div className="deckgl-tooltip">
      <TooltipRow
        label={t('Start (Longitude, Latitude): ')}
        value={`${o.object?.sourcePosition?.[0]}, ${o.object?.sourcePosition?.[1]}`}
      />
      <TooltipRow
        label={t('End (Longitude, Latitude): ')}
        value={`${o.object?.targetPosition?.[0]}, ${o.object?.targetPosition?.[1]}`}
      />
      {formData.dimension && (
        <TooltipRow
          label={`${formData?.dimension}: `}
          value={`${o.object?.cat_color}`}
        />
      )}
    </div>
  );
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

  const colorSchemeType = getSelectedColorSchemeType(fd);

  return new ArcLayer({
    data,
    getSourceColor: (d: any) => {
      if (colorSchemeType === COLOR_SCHEME_TYPES.fixed_color) {
        return [sc.r, sc.g, sc.b, 255 * sc.a];
      }

      return d.targetColor || d.color;
    },
    getTargetColor: (d: any) => {
      if (colorSchemeType === COLOR_SCHEME_TYPES.fixed_color) {
        return [tc.r, tc.g, tc.b, 255 * tc.a];
      }

      return d.targetColor || d.color;
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
  });
};

export default createCategoricalDeckGLComponent(getLayer, getPoints);
