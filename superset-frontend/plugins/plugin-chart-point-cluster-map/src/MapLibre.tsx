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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  type MapRef as MapLibreRef,
} from 'react-map-gl/maplibre';
import {
  Map as MapboxMap,
  type MapRef as MapboxRef,
} from 'react-map-gl/mapbox';
import * as maplibregl from 'maplibre-gl';
import { WebMercatorViewport } from '@math.gl/web-mercator';
import {
  resolveMapStyle,
  type ResolvedMapStyle,
} from '@superset-ui/core/utils/mapStyles';
import {
  advanceMapResourceGeneration,
  hasFatalMapResourceError,
  hasUnrecoveredMapResourceError,
  type MapResourceEvent,
  type MapResourceGeneration,
  type MapResourceState,
  MapRenderGenerationTracker,
  MapTileLifecycleTracker,
  recordMapResourceAbort,
  recordMapResourceData,
  recordMapResourceError,
  recordMapResourceIdle,
  recordMapResourceLoading,
} from '@superset-ui/core/utils/mapRenderStatus';
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

type MapMoveEvent = { viewState: Viewport };

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
      mapboxApiKey,
      mapProvider,
      resolvedMapStyle,
    }),
    [mapProvider, mapboxApiKey, resolvedMapStyle],
  );
  const currentMapRenderScope = useMemo(
    () => ({ height, source: currentMapSource, width }),
    [currentMapSource, height, width],
  );
  const mapRenderGenerationTrackerRef = useRef(
    new MapRenderGenerationTracker(),
  );
  const currentMapRenderGeneration =
    mapRenderGenerationTrackerRef.current.current(
      viewport,
      currentMapRenderScope,
    );
  const currentMapGeneration = useMemo<MapResourceGeneration>(
    () => ({ render: currentMapRenderGeneration, source: currentMapSource }),
    [currentMapRenderGeneration, currentMapSource],
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
  const [mapResourceState, setMapResourceState] =
    useState<MapResourceState | null>(null);
  const currentMapGenerationRef = useRef(currentMapGeneration);
  currentMapGenerationRef.current = currentMapGeneration;
  const mapTileLifecycleRef = useRef(new MapTileLifecycleTracker());
  const boundMapLibreRef = useRef<MapLibreRef | null>(null);
  const boundMapboxRef = useRef<MapboxRef | null>(null);
  const handleMove = useCallback(
    ({ viewState }: MapMoveEvent) => {
      const { longitude, latitude, zoom } = viewState;
      const newViewport = { longitude, latitude, zoom };
      mapRenderGenerationTrackerRef.current.retainForInput(newViewport);
      setCompletedMapRender(null);
      setViewport(newViewport);
      onViewportChange?.(newViewport);
    },
    [onViewportChange],
  );
  const handleMoveEnd = useCallback(
    ({ viewState }: MapMoveEvent) => {
      const { longitude, latitude, zoom } = viewState;
      const newViewport = { longitude, latitude, zoom };
      const render = mapRenderGenerationTrackerRef.current.advance(newViewport);
      currentMapGenerationRef.current = {
        render,
        source: currentMapGenerationRef.current.source,
      };
      mapTileLifecycleRef.current.rebase(render);
      setCompletedMapRender(null);
      setMapResourceState(current =>
        advanceMapResourceGeneration(current, currentMapGenerationRef.current),
      );
      setViewport(newViewport);
      onViewportChange?.(newViewport);
    },
    [onViewportChange],
  );
  const handleMapIdle = useCallback(() => {
    const generation = currentMapGenerationRef.current;
    mapTileLifecycleRef.current.reset(generation.render);
    setMapResourceState(current => recordMapResourceIdle(current, generation));
    setCompletedMapRender(generation.render);
  }, []);
  const handleMapLoading = useCallback((event: MapResourceEvent) => {
    const generation = currentMapGenerationRef.current;
    mapTileLifecycleRef.current.start(generation.render, event);
    setCompletedMapRender(null);
    setMapResourceState(current =>
      recordMapResourceLoading(current, generation, event),
    );
  }, []);
  const handleMapAbort = useCallback((event: MapResourceEvent) => {
    const generation = currentMapGenerationRef.current;
    if (!mapTileLifecycleRef.current.finish(generation.render, event)) {
      return;
    }
    setMapResourceState(current =>
      recordMapResourceAbort(current, generation, event),
    );
  }, []);
  const handleMapLibreRef = useCallback(
    (mapRef: MapLibreRef | null) => {
      const previousMap = boundMapLibreRef.current?.getMap();
      previousMap?.off('sourcedataloading', handleMapLoading);
      previousMap?.off('sourcedataabort', handleMapAbort);
      mapTileLifecycleRef.current.reset();
      boundMapLibreRef.current = mapRef;
      const nextMap = mapRef?.getMap();
      nextMap?.on('sourcedataloading', handleMapLoading);
      nextMap?.on('sourcedataabort', handleMapAbort);
    },
    [handleMapAbort, handleMapLoading],
  );
  const handleMapboxRef = useCallback(
    (mapRef: MapboxRef | null) => {
      const previousMap = boundMapboxRef.current?.getMap();
      previousMap?.off('sourcedataloading', handleMapLoading);
      mapTileLifecycleRef.current.reset();
      boundMapboxRef.current = mapRef;
      mapRef?.getMap().on('sourcedataloading', handleMapLoading);
    },
    [handleMapLoading],
  );
  const handleMapData = useCallback((event: MapResourceEvent) => {
    const generation = currentMapGenerationRef.current;
    const completion = mapTileLifecycleRef.current.complete(
      generation.render,
      event,
    );
    if (completion === null && event.sourceDataType !== 'error') {
      return;
    }
    // Mapbox emits failed tile loads as source data events, and any new
    // resource outcome invalidates an earlier idle until the map repaints.
    setCompletedMapRender(null);
    setMapResourceState(current => {
      if (completion === 'rebased' && event.sourceDataType !== 'error') {
        return recordMapResourceAbort(current, generation, event);
      }
      return recordMapResourceData(current, generation, event);
    });
  }, []);
  const handleMapError = useCallback((event: MapResourceEvent) => {
    const generation = currentMapGenerationRef.current;
    if (event.tile !== undefined) {
      mapTileLifecycleRef.current.finish(generation.render, event);
    }
    setCompletedMapRender(null);
    setMapResourceState(current =>
      recordMapResourceError(current, generation, event),
    );
  }, []);
  const handleOverlayRedraw = useCallback(
    () => setCompletedOverlayRender(currentOverlayRender),
    [currentOverlayRender],
  );
  const mapResourceFailed =
    hasFatalMapResourceError(mapResourceState, currentMapGeneration) ||
    (completedMapRender === currentMapGeneration.render &&
      hasUnrecoveredMapResourceError(mapResourceState, currentMapGeneration));
  const mapRenderComplete =
    completedMapRender === currentMapGeneration.render &&
    completedOverlayRender === currentOverlayRender &&
    !mapResourceFailed;

  if (mapProvider === 'mapbox' && !mapboxApiKey) {
    return (
      <div
        data-superset-map-status="error"
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

  const sharedMapProps = {
    ...viewport,
    mapStyle: resolvedMapStyle,
    onData: handleMapData,
    onError: handleMapError,
    onIdle: handleMapIdle,
    onMove: handleMove,
    onMoveEnd: handleMoveEnd,
    style: { width, height },
  };
  const overlay = (
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
  );

  return (
    <div
      data-superset-map-status={
        mapResourceFailed ? 'error' : mapRenderComplete ? 'rendered' : 'loading'
      }
      style={{ position: 'relative', width, height }}
    >
      {mapProvider === 'mapbox' ? (
        <MapboxMap
          ref={handleMapboxRef}
          {...sharedMapProps}
          mapboxAccessToken={mapboxApiKey}
        >
          {overlay}
        </MapboxMap>
      ) : (
        <MapLibreMap ref={handleMapLibreRef} {...sharedMapProps}>
          {overlay}
        </MapLibreMap>
      )}
    </div>
  );
}

export default memo(MapLibre);
