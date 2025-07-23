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
import { ContourLayer } from '@deck.gl/aggregation-layers';
import { Position } from '@deck.gl/core';
import { t } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { createDeckGLComponent, getLayerType } from '../../factory';
import { ColorType } from '../../types';
import TooltipRow from '../../TooltipRow';
import {
  createTooltipContent,
  CommonTooltipRows,
} from '../../utilities/tooltipUtils';

function defaultTooltipGenerator(o: any) {
  return (
    <div className="deckgl-tooltip">
      {CommonTooltipRows.centroid(o)}
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
  
  // Store original data for tooltip access
  const originalDataMap = new Map();
  data.forEach((d: any) => {
    if (d.position) {
      const key = `${Math.floor(d.position[0] * 1000)},${Math.floor(d.position[1] * 1000)}`;
      if (!originalDataMap.has(key)) {
        originalDataMap.set(key, []);
      }
      originalDataMap.get(key).push(d._originalData || d);
    }
  });

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

  // Create wrapper for tooltip content that adds nearby points
  const tooltipContentGenerator = (o: any) => {
    // Find nearby points based on hover coordinate
    const nearbyPoints: any[] = [];
    if (o.coordinate) {
      const searchKey = `${Math.floor(o.coordinate[0] * 1000)},${Math.floor(o.coordinate[1] * 1000)}`;
      const points = originalDataMap.get(searchKey) || [];
      nearbyPoints.push(...points);
      
      // Also check neighboring cells for better coverage
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx !== 0 || dy !== 0) {
            const neighborKey = `${Math.floor(o.coordinate[0] * 1000) + dx},${Math.floor(o.coordinate[1] * 1000) + dy}`;
            const neighborPoints = originalDataMap.get(neighborKey) || [];
            nearbyPoints.push(...neighborPoints);
          }
        }
      }
      
      // Enhance the object with nearby points data
      if (nearbyPoints.length > 0) {
        o.object = {
          ...o.object,
          nearbyPoints: nearbyPoints.slice(0, 5), // Limit to first 5 points
          totalPoints: nearbyPoints.length,
          // Add first point's data at top level for easy access
          ...nearbyPoints[0],
        };
      }
    }
    
    // Use createTooltipContent with the enhanced object
    const baseTooltipContent = createTooltipContent(
      fd,
      defaultTooltipGenerator,
    );
    return baseTooltipContent(o);
  };

  return new ContourLayer({
    id: `contourLayer-${fd.slice_id}`,
    data,
    contours,
    cellSize: Number(cellSize || '200'),
    aggregation: aggregation.toUpperCase(),
    getPosition: (d: { position: number[]; weight: number }) =>
      d.position as Position,
    getWeight: (d: { weight: number }) => d.weight || 0,
    ...commonLayerProps(fd, setTooltip, tooltipContentGenerator),
  });
};

export function getPoints(data: any[]) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
