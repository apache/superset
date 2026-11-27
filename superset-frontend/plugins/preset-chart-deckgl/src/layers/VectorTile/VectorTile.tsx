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

import { memo, useCallback, useRef } from 'react';
import { MVTLayer } from '@deck.gl/geo-layers';
import { MVTLoader } from '@loaders.gl/mvt';
import {
  getMapProviderMapStyle,
  JsonObject,
  JsonValue,
} from '@superset-ui/core';
import { buildColorExpression, compileColorAccessor } from './styling';
import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
import { TooltipProps } from '../../components/Tooltip';
import { GetLayerType } from '../../factory';
import { Viewport } from '../../utils/fitViewport';
import { getMapboxApiKey } from '../../utils/mapbox';
import { getLayerSettings, VectorTileFormData } from './layerSettings';
import { createTooltipContent } from '../../utilities/tooltipUtils';

// Pixel units keep points and lines visible at every zoom level.
const POINT_RADIUS_PX = 4;
const LINE_WIDTH_PX = 1;

// Added by MVTLoader to every feature, not sent by the tile server.
const LOADER_LAYER_NAME_KEY = 'layerName';

function renderDefaultTooltip(o: JsonObject) {
  const properties = o.object?.properties;
  if (!properties) {
    return null;
  }
  return (
    <div className="deckgl-tooltip">
      {Object.keys(properties)
        .filter(key => key !== LOADER_LAYER_NAME_KEY)
        .map(key => (
          <TooltipRow
            key={key}
            label={`${key}: `}
            value={`${properties[key]}`}
          />
        ))}
    </div>
  );
}

/**
 * Copies tile properties to the top level of the hovered object so templates
 * can use {{ name }}, matching what Explore inserts for Tooltip contents.
 * `properties` is kept, so {{ properties.name }} also works. Properties take
 * precedence over feature fields with the same name, such as `type`.
 */
const withFlatProperties = (o: JsonObject): JsonObject =>
  o.object?.properties
    ? { ...o, object: { ...o.object, ...o.object.properties } }
    : o;

/**
 * Builds the MVTLayer from form data. Exported separately because the deck.gl
 * Multiple Layers chart calls it directly. Returns null without a valid tile URL.
 */
export const getLayer: GetLayerType<MVTLayer | null> = ({
  formData,
  setTooltip,
}) => {
  const { tileUrl, sourceLayer, minZoom, maxZoom, fillColor } =
    getLayerSettings(formData as VectorTileFormData);

  if (!tileUrl) {
    return null;
  }

  const colorExpression = buildColorExpression(fillColor);
  const getColor = compileColorAccessor(colorExpression, fillColor);

  const { tooltip_properties: tooltipProperties = [] } =
    formData as VectorTileFormData;
  // Tooltip fields have their own key so the backend never adds them to the
  // SQL query. The shared tooltip code reads `tooltip_contents`, so they are
  // handed over only here, in the browser.
  const tooltipContent = createTooltipContent(
    { ...formData, tooltip_contents: tooltipProperties },
    renderDefaultTooltip,
  );

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
      mvt: sourceLayer ? { layers: [sourceLayer] } : undefined,
    },
    getFillColor: getColor,
    getLineColor: getColor,
    updateTriggers: {
      getFillColor: JSON.stringify(colorExpression),
      getLineColor: JSON.stringify(colorExpression),
    },
    getPointRadius: POINT_RADIUS_PX,
    pointRadiusUnits: 'pixels',
    getLineWidth: LINE_WIDTH_PX,
    lineWidthUnits: 'pixels',
    ...commonLayerProps({
      formData,
      setTooltip,
      setTooltipContent: (o: JsonObject) =>
        tooltipContent(withFlatProperties(o)),
    }),
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
  const containerRef = useRef<DeckGLContainerHandle>();
  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    containerRef.current?.setTooltip(tooltip);
  }, []);
  const layer = getLayer({ formData, payload: {}, setTooltip });

  const { mapProvider, mapStyle } = getMapProviderMapStyle({
    mapProvider: formData.map_renderer,
    maplibreStyle: formData.maplibre_style,
    mapboxStyle: formData.mapbox_style,
    legacyMapStyle: formData.map_style,
  });

  return (
    <DeckGLContainerStyledWrapper
      ref={containerRef}
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
