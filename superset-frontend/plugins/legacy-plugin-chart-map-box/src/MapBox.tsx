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
/* eslint-disable react/jsx-sort-default-props, react/sort-prop-types */
/* eslint-disable react/forbid-prop-types, react/require-default-props */
import { Component } from 'react';
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

interface MapBoxState {
  viewport: Viewport;
}

const defaultProps: Partial<MapBoxProps> = {
  width: 400,
  height: 400,
  globalOpacity: 1,
  onViewportChange: NOOP,
  pointRadius: DEFAULT_POINT_RADIUS,
  pointRadiusUnit: 'Pixels',
};

class MapBox extends Component<MapBoxProps, MapBoxState> {
  static defaultProps = defaultProps;

  constructor(props: MapBoxProps) {
    super(props);

    // Start from fitBounds, then override with explicit viewport props if provided
    const fitBounds = this.computeFitBoundsViewport();
    const { viewportLongitude, viewportLatitude, viewportZoom } = this.props;

    this.state = {
      viewport: {
        longitude: viewportLongitude ?? fitBounds.longitude,
        latitude: viewportLatitude ?? fitBounds.latitude,
        zoom: viewportZoom ?? fitBounds.zoom,
      },
    };
    this.handleViewportChange = this.handleViewportChange.bind(this);
  }

  handleViewportChange(viewport: Viewport) {
    this.setState({ viewport });
    const { onViewportChange } = this.props;
    onViewportChange!(viewport);
  }

  computeFitBoundsViewport(): Viewport {
    const { width = 400, height = 400, bounds } = this.props;
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

  componentDidUpdate(prevProps: MapBoxProps) {
    const { viewportLongitude, viewportLatitude, viewportZoom } = this.props;
    const { viewport } = this.state;

    // Detect when viewport props are cleared (changed from defined to undefined)
    // to restore fitBounds behavior
    const longitudeCleared =
      prevProps.viewportLongitude !== undefined &&
      viewportLongitude === undefined;
    const latitudeCleared =
      prevProps.viewportLatitude !== undefined &&
      viewportLatitude === undefined;
    const zoomCleared =
      prevProps.viewportZoom !== undefined && viewportZoom === undefined;

    if (longitudeCleared || latitudeCleared || zoomCleared) {
      const fitBounds = this.computeFitBoundsViewport();
      this.setState({
        viewport: {
          ...viewport,
          longitude: longitudeCleared
            ? fitBounds.longitude
            : (viewportLongitude ?? viewport.longitude),
          latitude: latitudeCleared
            ? fitBounds.latitude
            : (viewportLatitude ?? viewport.latitude),
          zoom: zoomCleared ? fitBounds.zoom : (viewportZoom ?? viewport.zoom),
        },
      });
      return;
    }

    const longitudeChanged =
      prevProps.viewportLongitude !== viewportLongitude &&
      viewportLongitude !== undefined &&
      viewportLongitude !== viewport.longitude;
    const latitudeChanged =
      prevProps.viewportLatitude !== viewportLatitude &&
      viewportLatitude !== undefined &&
      viewportLatitude !== viewport.latitude;
    const zoomChanged =
      prevProps.viewportZoom !== viewportZoom &&
      viewportZoom !== undefined &&
      viewportZoom !== viewport.zoom;

    if (longitudeChanged || latitudeChanged || zoomChanged) {
      this.setState({
        viewport: {
          ...viewport,
          longitude: longitudeChanged ? viewportLongitude! : viewport.longitude,
          latitude: latitudeChanged ? viewportLatitude! : viewport.latitude,
          zoom: zoomChanged ? viewportZoom! : viewport.zoom,
        },
      });
    }
  }

  render() {
    const {
      width,
      height,
      aggregatorName,
      clusterer,
      globalOpacity,
      mapStyle,
      mapboxApiKey,
      pointRadius,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
      hasCustomMetric,
      bounds,
    } = this.props;
    const { viewport } = this.state;
    const isDragging =
      viewport.isDragging === undefined ? false : viewport.isDragging;

    // Compute the clusters based on the original bounds and current zoom level. Note when zoom/pan
    // to an area outside of the original bounds, no additional queries are made to the backend to
    // retrieve additional data.
    // add this variable to widen the visible area
    const offsetHorizontal = ((width ?? 400) * 0.5) / 100;
    const offsetVertical = ((height ?? 400) * 0.5) / 100;

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

    return (
      <MapGL
        {...viewport}
        mapStyle={mapStyle}
        width={width}
        height={height}
        mapboxApiAccessToken={mapboxApiKey}
        onViewportChange={this.handleViewportChange}
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
          lngLatAccessor={(location: GeoJSONLocation) => {
            const { coordinates } = location.geometry;

            return [coordinates[0], coordinates[1]];
          }}
        />
      </MapGL>
    );
  }
}

export default MapBox;
