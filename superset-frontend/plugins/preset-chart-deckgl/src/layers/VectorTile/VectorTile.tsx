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

import { memo } from 'react';
import { MVTLayer } from '@deck.gl/geo-layers';
import { MVTLoader } from '@loaders.gl/mvt';
import { getMapProviderMapStyle, JsonValue } from '@superset-ui/core';
import { DeckGLContainerStyledWrapper } from '../../DeckGLContainer';
import { GetLayerType } from '../../factory';
import { Viewport } from '../../utils/fitViewport';
import { getMapboxApiKey } from '../../utils/mapbox';
import { getLayerSettings, VectorTileFormData } from './layerSettings';

// Pixel units keep points and lines visible at every zoom level.
const POINT_RADIUS_PX = 4;
const LINE_WIDTH_PX = 1;

/**
 * Builds the MVTLayer from form data. Exported separately because the deck.gl
 * Multiple Layers chart calls it directly. Returns null without a valid tile URL.
 */
export const getLayer: GetLayerType<MVTLayer | null> = ({ formData }) => {
  const { tileUrl, sourceLayer, minZoom, maxZoom, fillColor } =
    getLayerSettings(formData as VectorTileFormData);

  if (!tileUrl) {
    return null;
  }

  return new MVTLayer({
    id: `vector-tile-layer-${formData.slice_id}`,
    data: tileUrl,
    minZoom,
    maxZoom,
    // The default worker loader fetches its script from a CDN, which Superset's
    // CSP blocks, so decode on the main thread with the full MVTLoader.
    loaders: [MVTLoader],
    loadOptions: {
        core: { worker: false },
        mvt: sourceLayer ? { layers: [sourceLayer] } : undefined,},
    getFillColor: fillColor,
    getLineColor: fillColor,
    getPointRadius: POINT_RADIUS_PX,
    pointRadiusUnits: 'pixels',
    getLineWidth: LINE_WIDTH_PX,
    lineWidthUnits: 'pixels',
  });
};

export type VectorTileProps = {
  formData: VectorTileFormData;
  viewport: Viewport;
  setControlValue: (control: string, value: JsonValue) => void;
  height: number;
  width: number;
};

function VectorTile({
  formData,
  viewport,
  setControlValue,
  height,
  width,
}: VectorTileProps) {
  const layer = getLayer({ formData, payload: {}, setTooltip: () => {} });

  const { mapProvider, mapStyle } = getMapProviderMapStyle({
    mapProvider: formData.map_renderer,
    maplibreStyle: formData.maplibre_style,
    mapboxStyle: formData.mapbox_style,
    legacyMapStyle: formData.map_style,
  });

  return (
    <DeckGLContainerStyledWrapper
      viewport={viewport}
      layers={layer ? [layer] : []}
      mapProvider={mapProvider}
      mapStyle={mapStyle}
      mapboxApiKey={getMapboxApiKey()}
      setControlValue={setControlValue}
      height={height}
      width={width}
    />
  );
}

export default memo(VectorTile);