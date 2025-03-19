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
import { ContourLayer } from 'deck.gl';
import { t } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { createDeckGLComponent, getLayerType } from '../../factory';
import { ColorType } from '../../types';
import TooltipRow from '../../TooltipRow';

function setTooltipContent(o: any) {
  return (
    <div className="deckgl-tooltip">
      <TooltipRow
        label={t('Centroid (Longitude and Latitude): ')}
        value={`(${o?.coordinate[0]}, ${o?.coordinate[1]})`}
      />
      <TooltipRow
        label={t('Threshold: ')}
        value={`${o?.object?.contour?.threshold}`}
      />
    </div>
  );
}
export const getLayer: getLayerType<unknown> = function (
  formData,
  payload,
  onAddFilter,
  setTooltip,
) {
  const fd = formData;
  const {
    aggregation = 'SUM',
    js_data_mutator: jsFnMutator,
    contours: rawContours,
    cellSize = '200',
  } = fd;
  let data = payload.data.features;

  const contours = rawContours?.map(
    (contour: {
      color: ColorType;
      lowerThreshold: number;
      upperThreshold?: number;
      strokeWidth?: number;
    }) => {
      const { lowerThreshold, upperThreshold, color, strokeWidth } = contour;
      if (upperThreshold) {
        // Isoband format
        return {
          threshold: [lowerThreshold, upperThreshold],
          color: [color.r, color.g, color.b],
        };
      }
      // Isoline format
      return {
        threshold: lowerThreshold,
        color: [color.r, color.g, color.b],
        strokeWidth,
      };
    },
  );

  if (jsFnMutator) {
    // Applying user defined data mutator if defined
    const jsFnMutatorFunction = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutatorFunction(data);
  }

  return new ContourLayer({
    id: `contourLayer-${fd.slice_id}`,
    data,
    contours,
    cellSize: Number(cellSize || '200'),
    aggregation: aggregation.toUpperCase(),
    getPosition: (d: { position: number[]; weight: number }) => d.position,
    getWeight: (d: { weight: number }) => d.weight || 0,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  });
};

function getPoints(data: any[]) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
