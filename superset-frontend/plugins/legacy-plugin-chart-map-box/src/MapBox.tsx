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

    const fitBounds = this.computeFitBoundsViewport();

    this.state = {
      viewport: this.mergeViewportWithProps(fitBounds),
    };
    this.handleViewportChange = this.handleViewportChange.bind(this);
  }

  handleViewportChange(viewport: Viewport) {
    this.setState({ viewport });
    const { onViewportChange } = this.props;
    onViewportChange!(viewport);
  }

  mergeViewportWithProps(
    fitBounds: Viewport,
    viewport: Viewport = fitBounds,
    props: MapBoxProps = this.props,
    useFitBoundsForUnset = true,
  ): Viewport {
    const { viewportLongitude, viewportLatitude, viewportZoom } = props;

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
    const { viewport } = this.state;
    const fitBoundsInputsChanged =
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height ||
      prevProps.bounds !== this.props.bounds;
    const viewportPropsChanged =
      prevProps.viewportLongitude !== this.props.viewportLongitude ||
      prevProps.viewportLatitude !== this.props.viewportLatitude ||
      prevProps.viewportZoom !== this.props.viewportZoom;

    if (!fitBoundsInputsChanged && !viewportPropsChanged) {
      return;
    }

    const fitBounds = this.computeFitBoundsViewport();
    const nextViewport = this.mergeViewportWithProps(
      fitBounds,
      viewport,
      this.props,
      fitBoundsInputsChanged || viewportPropsChanged,
    );

    const viewportChanged =
      nextViewport.longitude !== viewport.longitude ||
      nextViewport.latitude !== viewport.latitude ||
      nextViewport.zoom !== viewport.zoom;

    if (viewportChanged) {
      this.setState({ viewport: nextViewport });
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
