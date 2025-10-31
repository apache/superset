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
import { Component } from 'react';
import Map, { ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { WebMercatorViewport } from '@math.gl/web-mercator';
import ScatterPlotGlowOverlay, {
  AggregationType,
} from './ScatterPlotGlowOverlay';
import './MapBox.css';

const NOOP = () => {};
export const DEFAULT_MAX_ZOOM = 16;
export const DEFAULT_POINT_RADIUS = 60;

interface Clusterer {
  getClusters(bbox: number[], zoom: number): Location[];
}

interface Geometry {
  coordinates: [number, number];
  type: string;
}

interface Location {
  geometry: Geometry;
  properties: {
    cluster?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface Viewport {
  longitude: number;
  latitude: number;
  zoom: number;
  isDragging?: boolean;
}

interface MapBoxProps {
  aggregatorName?: AggregationType;
  bounds: [[number, number], [number, number]];
  clusterer: Clusterer;
  globalOpacity?: number;
  hasCustomMetric?: boolean;
  height?: number;
  mapStyle?: string;
  mapboxApiKey: string;
  onViewportChange?: (viewport: Viewport) => void;
  pointRadius?: number;
  pointRadiusUnit?: string;
  renderWhileDragging?: boolean;
  rgb?: [number, number, number, number];
  width?: number;
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

    const { width, height, bounds } = this.props;
    // Get a viewport that fits the given bounds, which all marks to be clustered.
    // Derive lat, lon and zoom from this viewport. This is only done on initial
    // render as the bounds don't update as we pan/zoom in the current design.
    const mercator = new WebMercatorViewport({
      width: width || 400,
      height: height || 400,
    }).fitBounds(bounds);
    const { latitude, longitude, zoom } = mercator;

    this.state = {
      viewport: {
        longitude,
        latitude,
        zoom,
      },
    };
    this.handleViewportChange = this.handleViewportChange.bind(this);
  }

  handleViewportChange(evt: ViewStateChangeEvent) {
    const { latitude, longitude, zoom } = evt.viewState;
    const viewport: Viewport = { latitude, longitude, zoom };
    this.setState({ viewport });
    const { onViewportChange } = this.props;
    if (onViewportChange) {
      onViewportChange(viewport);
    }
  }

  render() {
    const {
      width,
      height,
      aggregatorName,
      clusterer,
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
    const offsetHorizontal = ((width || 400) * 0.5) / 100;
    const offsetVertical = ((height || 400) * 0.5) / 100;
    const bbox = [
      bounds[0][0] - offsetHorizontal,
      bounds[0][1] - offsetVertical,
      bounds[1][0] + offsetHorizontal,
      bounds[1][1] + offsetVertical,
    ];
    const clusters = clusterer.getClusters(bbox, Math.round(viewport.zoom));

    return (
      <div style={{ width, height }}>
        <Map
          {...viewport}
          mapStyle={mapStyle}
          mapboxAccessToken={mapboxApiKey}
          onMove={this.handleViewportChange}
          preserveDrawingBuffer
          style={{ width: '100%', height: '100%' }}
        >
          <ScatterPlotGlowOverlay
            {...viewport}
            isDragging={isDragging}
            locations={clusters}
            dotRadius={pointRadius}
            pointRadiusUnit={pointRadiusUnit}
            rgb={rgb}
            compositeOperation="screen"
            renderWhileDragging={renderWhileDragging}
            aggregation={hasCustomMetric ? aggregatorName : undefined}
            lngLatAccessor={location => {
              const { coordinates } = location.geometry;

              return [coordinates[0], coordinates[1]];
            }}
          />
        </Map>
      </div>
    );
  }
}

export default MapBox;
