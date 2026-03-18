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
import { memo, useCallback, useMemo, useState } from 'react';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import { Map as MapboxMap } from 'react-map-gl/mapbox';
import { WebMercatorViewport } from '@math.gl/web-mercator';
import { useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import ScatterPlotOverlay from './components/ScatterPlotOverlay';
import { getMapboxApiKey } from './utils/mapbox';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapLibre.css';

const DEFAULT_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export const DEFAULT_MAX_ZOOM = 16;
export const DEFAULT_POINT_RADIUS = 60;

interface Viewport {
  longitude: number;
  latitude: number;
  zoom: number;
}

interface Clusterer {
  getClusters(bbox: number[], zoom: number): GeoJSONLocation[];
}

interface GeoJSONLocation {
  geometry: {
    coordinates: [number, number];
  };
  properties: Record<string, number | string | boolean | null | undefined>;
}

interface MapLibreProps {
  width?: number;
  height?: number;
  aggregatorName?: string;
  clusterer: Clusterer; // Required - used for getClusters()
  globalOpacity?: number;
  hasCustomMetric?: boolean;
  mapProvider?: string;
  mapStyle?: string;
  onViewportChange?: (viewport: Viewport) => void;
  pointRadius?: number;
  pointRadiusUnit?: string;
  renderWhileDragging?: boolean;
  rgb?: (string | number)[];
  bounds?: [[number, number], [number, number]]; // May be undefined for empty datasets
}

function MapLibre({
  width = 400,
  height = 400,
  aggregatorName,
  clusterer,
  globalOpacity = 1,
  hasCustomMetric,
  mapProvider,
  mapStyle,
  onViewportChange,
  pointRadius = DEFAULT_POINT_RADIUS,
  pointRadiusUnit = 'Pixels',
  renderWhileDragging = true,
  rgb,
  bounds,
}: MapLibreProps) {
  const initialViewport = useMemo(() => {
    let latitude = 0;
    let longitude = 0;
    let zoom = 1;

    if (bounds && bounds[0] && bounds[1]) {
      const mercator = new WebMercatorViewport({
        width,
        height,
      }).fitBounds(bounds);
      ({ latitude, longitude, zoom } = mercator);
    }

    return { longitude, latitude, zoom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [viewport, setViewport] = useState<Viewport>(initialViewport);

  const handleMove = useCallback(
    (evt: {
      viewState: { longitude: number; latitude: number; zoom: number };
    }) => {
      const { longitude, latitude, zoom } = evt.viewState;
      const newViewport = { longitude, latitude, zoom };
      setViewport(newViewport);
      onViewportChange?.(newViewport);
    },
    [onViewportChange],
  );

  // add this variable to widen the visible area
  const offsetHorizontal = (width * 0.5) / 100;
  const offsetVertical = (height * 0.5) / 100;

  const bbox =
    bounds && bounds[0] && bounds[1]
      ? [
          bounds[0][0] - offsetHorizontal,
          bounds[0][1] - offsetVertical,
          bounds[1][0] + offsetHorizontal,
          bounds[1][1] + offsetVertical,
        ]
      : [-180, -90, 180, 90];

  const clusters = clusterer.getClusters(bbox, Math.round(viewport.zoom));

  const theme = useTheme();
  const resolvedMapStyle = mapStyle || DEFAULT_MAP_STYLE;
  const mapboxApiKey = mapProvider === 'mapbox' ? getMapboxApiKey() : '';

  if (mapProvider === 'mapbox' && !mapboxApiKey) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          textAlign: 'center',
          color: theme.colorTextSecondary,
        }}
      >
        {t('Mapbox requires a MAPBOX_API_KEY to be configured on the server.')}
      </div>
    );
  }

  const MapComponent = mapProvider === 'mapbox' ? MapboxMap : MapLibreMap;
  const mapboxProps =
    mapProvider === 'mapbox' ? { mapboxAccessToken: mapboxApiKey } : {};

  return (
    <MapComponent
      {...viewport}
      {...mapboxProps}
      style={{ width, height }}
      mapStyle={resolvedMapStyle}
      onMove={handleMove}
    >
      <ScatterPlotOverlay
        locations={clusters}
        dotRadius={pointRadius}
        pointRadiusUnit={pointRadiusUnit}
        rgb={rgb}
        globalOpacity={globalOpacity}
        compositeOperation="screen"
        renderWhileDragging={renderWhileDragging}
        aggregation={hasCustomMetric ? aggregatorName : undefined}
        zoom={viewport.zoom}
        lngLatAccessor={(location: GeoJSONLocation) => {
          const { coordinates } = location.geometry;
          return [coordinates[0], coordinates[1]];
        }}
      />
    </MapComponent>
  );
}

export default memo(MapLibre);
