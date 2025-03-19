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
import { ArcLayer } from 'deck.gl/typed';
import {
  HandlerFunction,
  JsonObject,
  QueryFormData,
  t,
} from '@superset-ui/core';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { TooltipProps } from '../../components/Tooltip';
import { Point } from '../../types';

function getPoints(data: JsonObject[]) {
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

export function getLayer(
  fd: QueryFormData,
  payload: JsonObject,
  onAddFilter: HandlerFunction,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
) {
  const data = payload.data.features;
  const sc = fd.color_picker;
  const tc = fd.target_color_picker;

  return new ArcLayer({
    data,
    getSourceColor: d =>
      d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a],
    getTargetColor: d =>
      d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a],
    id: `path-layer-${fd.slice_id}` as const,
    strokeWidth: fd.stroke_width ? fd.stroke_width : 3,
    ...commonLayerProps(fd, setTooltip, setTooltipContent(fd)),
  });
}

export default createCategoricalDeckGLComponent(getLayer, getPoints);
