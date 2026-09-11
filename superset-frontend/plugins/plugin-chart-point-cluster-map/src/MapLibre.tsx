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
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import { Map as MapboxMap } from 'react-map-gl/mapbox';
import * as maplibregl from 'maplibre-gl';
import { WebMercatorViewport } from '@math.gl/web-mercator';
import {
  resolveMapStyle,
  type ResolvedMapStyle,
} from '@superset-ui/core/utils/mapStyles';
import { useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import ScatterPlotOverlay from './components/ScatterPlotOverlay';
import { getMapboxApiKey } from './utils/mapbox';
import { DEFAULT_POINT_RADIUS } from './mapLibreDefaults';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapLibre.css';

// maplibre-gl 6's ESM-only build derives its worker URL from
// `import.meta.url`, which our (non-ESM-output) webpack bundle rewrites to
// a build-time path that doesn't match maplibre's `^https?:` check, so
// `WORKER_URL` silently resolves to `''` and no worker gets created. Point
// it at the copy CopyPlugin emits alongside the rest of our static assets
// (see webpack.config.js) instead, using the runtime-configurable public
// path so this also works behind a reverse-proxy / APPLICATION_ROOT
// prefix. This must run before the first MapLibre map mounts.
maplibregl.setWorkerUrl(`${__webpack_public_path__}maplibre-gl-worker.mjs`);

const DEFAULT_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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
  viewportLongitude?: number;
  viewportLatitude?: number;
  viewportZoom?: number;
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
  viewportLongitude,
  viewportLatitude,
  viewportZoom,
}: MapLibreProps) {
  const computeFitBounds = useCallback((): Viewport => {
    if (bounds && bounds[0] && bounds[1]) {
      const mercator = new WebMercatorViewport({ width, height }).fitBounds(
        bounds,
      );
      return {
        latitude: mercator.latitude,
        longitude: mercator.longitude,
        zoom: mercator.zoom,
      };
    }
    return { latitude: 0, longitude: 0, zoom: 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergeViewportWithProps = useCallback(
    (fitBounds: Viewport, base: Viewport = fitBounds): Viewport => ({
      ...base,
      longitude: viewportLongitude ?? fitBounds.longitude,
      latitude: viewportLatitude ?? fitBounds.latitude,
      zoom: viewportZoom ?? fitBounds.zoom,
    }),
    [viewportLongitude, viewportLatitude, viewportZoom],
  );

  const [viewport, setViewport] = useState<Viewport>(() =>
    mergeViewportWithProps(computeFitBounds()),
  );

  useEffect(() => {
    const fitBounds = computeFitBounds();
    const next = mergeViewportWithProps(fitBounds, viewport);
    if (
      next.longitude !== viewport.longitude ||
      next.latitude !== viewport.latitude ||
      next.zoom !== viewport.zoom
    ) {
      setViewport(next);
    }
    // Only re-run when the viewport-override props change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportLongitude, viewportLatitude, viewportZoom]);

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

  const bbox = useMemo(
    () =>
      bounds && bounds[0] && bounds[1]
        ? [
            bounds[0][0] - offsetHorizontal,
            bounds[0][1] - offsetVertical,
            bounds[1][0] + offsetHorizontal,
            bounds[1][1] + offsetVertical,
          ]
        : [-180, -90, 180, 90],
    [bounds, offsetHorizontal, offsetVertical],
  );

  const clusters = useMemo(
    () => clusterer.getClusters(bbox, Math.round(viewport.zoom)),
    [bbox, clusterer, viewport.zoom],
  );

  const theme = useTheme();
  const resolvedMapStyle: ResolvedMapStyle = useMemo(
    () =>
      mapProvider === 'mapbox'
        ? mapStyle || DEFAULT_MAP_STYLE
        : resolveMapStyle(mapStyle, DEFAULT_MAP_STYLE),
    [mapProvider, mapStyle],
  );
  const mapboxApiKey = mapProvider === 'mapbox' ? getMapboxApiKey() : '';

  // The top-level renderer callback only proves that this React module
  // mounted. Track both the base-map idle event and the imperative canvas
  // redraw for the same inputs before declaring its pixels capture-ready.
  const currentMapSource = useMemo(
    () => ({
      hasMapboxApiKey: Boolean(mapboxApiKey),
      mapProvider,
      resolvedMapStyle,
    }),
    [mapProvider, mapboxApiKey, resolvedMapStyle],
  );
  const currentMapRender = useMemo(
    () => ({
      height,
      source: currentMapSource,
      viewport,
      width,
    }),
    [currentMapSource, height, viewport, width],
  );
  const currentOverlayRender = useMemo(
    () => ({
      aggregatorName,
      clusters,
      globalOpacity,
      hasCustomMetric,
      height,
      mapProvider,
      pointRadius,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
      viewport,
      width,
    }),
    [
      aggregatorName,
      clusters,
      globalOpacity,
      hasCustomMetric,
      height,
      mapProvider,
      pointRadius,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
      viewport,
      width,
    ],
  );
  const [completedMapRender, setCompletedMapRender] = useState<object | null>(
    null,
  );
  const [completedOverlayRender, setCompletedOverlayRender] = useState<
    object | null
  >(null);
  const [failedMapRender, setFailedMapRender] = useState<object | null>(null);
  const handleMapIdle = useCallback(
    () => setCompletedMapRender(currentMapRender),
    [currentMapRender],
  );
  const handleMapError = useCallback(() => {
    setFailedMapRender(currentMapSource);
  }, [currentMapSource]);
  const handleOverlayRedraw = useCallback(
    () => setCompletedOverlayRender(currentOverlayRender),
    [currentOverlayRender],
  );
  const mapRenderComplete =
    completedMapRender === currentMapRender &&
    completedOverlayRender === currentOverlayRender &&
    failedMapRender !== currentMapSource;

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
    <div
      data-superset-map-status={mapRenderComplete ? 'rendered' : 'loading'}
      style={{ position: 'relative', width, height }}
    >
      <MapComponent
        {...viewport}
        {...mapboxProps}
        style={{ width, height }}
        mapStyle={resolvedMapStyle}
        onMove={handleMove}
        onIdle={handleMapIdle}
        onError={handleMapError}
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
          onRedraw={handleOverlayRedraw}
        />
      </MapComponent>
    </div>
  );
}

export default memo(MapLibre);
