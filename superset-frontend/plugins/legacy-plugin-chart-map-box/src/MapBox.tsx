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
import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import MapGL from 'react-map-gl';
import { WebMercatorViewport } from '@math.gl/web-mercator';
import ScatterPlotGlowOverlay from './ScatterPlotGlowOverlay';
import './MapBox.css';

const NOOP = () => {};
export const DEFAULT_MAX_ZOOM = 16;
export const DEFAULT_POINT_RADIUS = 60;

interface Viewport {
  longitude: number;
  latitude: number;
  zoom: number;
  isDragging?: boolean;
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

interface MapBoxProps {
  width?: number;
  height?: number;
  aggregatorName?: string;
  clusterer: Clusterer; // Required - used for getClusters()
  globalOpacity?: number;
  hasCustomMetric?: boolean;
  mapStyle?: string;
  mapboxApiKey: string;
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

function computeFitBounds(
  width: number,
  height: number,
  bounds?: [[number, number], [number, number]],
): Viewport {
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
}

function mergeViewportWithProps(
  fitBounds: Viewport,
  viewport: Viewport,
  viewportLongitude: number | undefined,
  viewportLatitude: number | undefined,
  viewportZoom: number | undefined,
  useFitBoundsForUnset: boolean,
): Viewport {
  return {
    ...viewport,
    longitude:
      viewportLongitude ??
      (useFitBoundsForUnset ? fitBounds.longitude : viewport.longitude),
    latitude:
      viewportLatitude ??
      (useFitBoundsForUnset ? fitBounds.latitude : viewport.latitude),
    zoom:
      viewportZoom ?? (useFitBoundsForUnset ? fitBounds.zoom : viewport.zoom),
  };
}

function MapBox({
  width = 400,
  height = 400,
  aggregatorName,
  clusterer,
  globalOpacity = 1,
  hasCustomMetric,
  mapStyle,
  mapboxApiKey,
  onViewportChange = NOOP,
  pointRadius = DEFAULT_POINT_RADIUS,
  pointRadiusUnit = 'Pixels',
  renderWhileDragging,
  rgb,
  bounds,
  viewportLongitude,
  viewportLatitude,
  viewportZoom,
}: MapBoxProps) {
  const initialViewport = useMemo((): Viewport => {
    const fitBounds = computeFitBounds(width, height, bounds);
    return mergeViewportWithProps(
      fitBounds,
      fitBounds,
      viewportLongitude,
      viewportLatitude,
      viewportZoom,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Compute once on mount; subsequent updates handled via useEffect below

  const [viewport, setViewport] = useState<Viewport>(initialViewport);

  const prevRef = useRef({
    width,
    height,
    bounds,
    viewportLongitude,
    viewportLatitude,
    viewportZoom,
  });

  useEffect(() => {
    const prev = prevRef.current;
    const fitBoundsInputsChanged =
      prev.width !== width ||
      prev.height !== height ||
      prev.bounds !== bounds;
    const viewportPropsChanged =
      prev.viewportLongitude !== viewportLongitude ||
      prev.viewportLatitude !== viewportLatitude ||
      prev.viewportZoom !== viewportZoom;

    if (fitBoundsInputsChanged || viewportPropsChanged) {
      const fitBounds = computeFitBounds(width, height, bounds);
      setViewport(prevViewport =>
        mergeViewportWithProps(
          fitBounds,
          prevViewport,
          viewportLongitude,
          viewportLatitude,
          viewportZoom,
          fitBoundsInputsChanged,
        ),
      );
    }

    prevRef.current = {
      width,
      height,
      bounds,
      viewportLongitude,
      viewportLatitude,
      viewportZoom,
    };
  }, [width, height, bounds, viewportLongitude, viewportLatitude, viewportZoom]);

  const handleViewportChange = useCallback(
    (newViewport: Viewport) => {
      setViewport(newViewport);
      onViewportChange(newViewport);
    },
    [onViewportChange],
  );

  const isDragging =
    viewport.isDragging === undefined ? false : viewport.isDragging;

  // Compute the clusters based on the original bounds and current zoom level. Note when zoom/pan
  // to an area outside of the original bounds, no additional queries are made to the backend to
  // retrieve additional data.
  // add this variable to widen the visible area
  const offsetHorizontal = (width * 0.5) / 100;
  const offsetVertical = (height * 0.5) / 100;

  // Guard against empty datasets where bounds may be undefined
  const bbox =
    bounds && bounds[0] && bounds[1]
      ? [
          bounds[0][0] - offsetHorizontal,
          bounds[0][1] - offsetVertical,
          bounds[1][0] + offsetHorizontal,
          bounds[1][1] + offsetVertical,
        ]
      : [-180, -90, 180, 90]; // Default to world bounds

  const clusters = clusterer.getClusters(bbox, Math.round(viewport.zoom));

  const lngLatAccessor = useCallback((location: GeoJSONLocation) => {
    const { coordinates } = location.geometry;
    return [coordinates[0], coordinates[1]] as [number, number];
  }, []);

  return (
    <MapGL
      {...viewport}
      mapStyle={mapStyle}
      width={width}
      height={height}
      mapboxApiAccessToken={mapboxApiKey}
      onViewportChange={handleViewportChange}
      preserveDrawingBuffer
    >
      <ScatterPlotGlowOverlay
        {...viewport}
        isDragging={isDragging}
        locations={clusters}
        dotRadius={pointRadius}
        pointRadiusUnit={pointRadiusUnit}
        rgb={rgb}
        globalOpacity={globalOpacity}
        compositeOperation="screen"
        renderWhileDragging={renderWhileDragging}
        aggregation={hasCustomMetric ? aggregatorName : undefined}
        lngLatAccessor={lngLatAccessor}
      />
    </MapGL>
  );
}

export default memo(MapBox);
