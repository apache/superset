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
import { GetLayerType, createDeckGLComponent } from '../../factory';
import { Point } from '../../types';
import {
  createTooltipContent,
  CommonTooltipRows,
} from '../../utilities/tooltipUtils';

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
  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  let data = payload.data.features.map((feature: JsonObject) => ({
    ...feature,
    path: feature.path,
    width: fd.line_width,
    color: fixedColor,
  }));

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new PathLayer({
    id: `path-layer-${fd.slice_id}` as const,
    getColor: (d: any) => d.color,
    getPath: (d: any) => d.path,
    getWidth: (d: any) => d.width,
    data,
    rounded: true,
    widthScale: 1,
    widthUnits: fd.line_width_unit,
    ...commonLayerProps({
      formData: fd,
      setTooltip,
      setTooltipContent: setTooltipContent(fd),
      setDataMask,
      filterState,
      onContextMenu,
      emitCrossFilters,
    }),
  });
};

export function getPoints(data: JsonObject[]) {
  let points: Point[] = [];
  data.forEach(d => {
    points = points.concat(d.path);
  });

  return points;
}

export default createDeckGLComponent(getLayer, getPoints);
