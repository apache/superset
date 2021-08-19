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
import { ScatterplotLayer } from 'deck.gl';
import React from 'react';
import { getMetricLabel, t } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { unitToRadius } from '../../utils/geo';

function getPoints(data) {
  return data.map(d => d.position);
}

function setTooltipContent(formData, verboseMap) {
  return o => {
    const label =
      verboseMap?.[formData.point_radius_fixed.value] ||
      getMetricLabel(formData.point_radius_fixed?.value);
    return (
      <div className="deckgl-tooltip">
        <TooltipRow
          label={`${t('Longitude and Latitude')}: `}
          value={`${o.object.position[0]}, ${o.object.position[1]}`}
        />
        {o.object.cat_color && (
          <TooltipRow label={`${t('Category')}: `} value={`${o.object.cat_color}`} />
        )}
        {o.object.metric && <TooltipRow label={`${label}: `} value={`${o.object.metric}`} />}
      </div>
    );
  };
}

export function getLayer(formData, payload, onAddFilter, setTooltip, datasource) {
  const fd = formData;
  const dataWithRadius = payload.data.features.map(d => {
    let radius = unitToRadius(fd.point_unit, d.radius) || 10;
    if (fd.multiplier) {
      radius *= fd.multiplier;
    }
    if (d.color) {
      return { ...d, radius };
    }
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const color = [c.r, c.g, c.b, c.a * 255];

    return { ...d, radius, color };
  });

  return new ScatterplotLayer({
    id: `scatter-layer-${fd.slice_id}`,
    data: dataWithRadius,
    fp64: true,
    getFillColor: d => d.color,
    getRadius: d => d.radius,
    radiusMinPixels: fd.min_radius || null,
    radiusMaxPixels: fd.max_radius || null,
    stroked: false,
    ...commonLayerProps(fd, setTooltip, setTooltipContent(fd, datasource?.verboseMap)),
  });
}

export default createCategoricalDeckGLComponent(getLayer, getPoints);
