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
  type AggregationType,
  type Location,
} from './ScatterPlotGlowOverlay';
import './MapBox.css';

export interface Clusterer {
  getClusters(bbox: [number, number, number, number], zoom: number): Location[];
}

const NOOP = () => {};
export const DEFAULT_MAX_ZOOM = 16;
export const DEFAULT_POINT_RADIUS = 60;
const DEFAULT_DIMENSION = 400;
const VIEWPORT_BUFFER_MULTIPLIER = 0.5;
const VIEWPORT_BUFFER_DIVISOR = 100;

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
  clusters: Location[];
  isMapLoaded: boolean;
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

  private lastZoom: number;

  constructor(props: MapBoxProps) {
    super(props);

    const { width, height, bounds, clusterer } = this.props;
    const mercator = new WebMercatorViewport({
      width: width || DEFAULT_DIMENSION,
      height: height || DEFAULT_DIMENSION,
    }).fitBounds(bounds);
    const { latitude, longitude, zoom } = mercator;

    const viewport = { longitude, latitude, zoom };
    this.lastZoom = Math.round(zoom);

    this.state = {
      viewport,
      clusters: this.computeClusters(clusterer, bounds, width, height, zoom),
      isMapLoaded: false,
    };
    this.handleViewportChange = this.handleViewportChange.bind(this);
    this.handleMapLoad = this.handleMapLoad.bind(this);
  }

  componentDidUpdate(prevProps: MapBoxProps, prevState: MapBoxState) {
    const { viewport } = this.state;
    const { clusterer, bounds, width, height } = this.props;
    const roundedZoom = Math.round(viewport.zoom);

    const shouldRecompute =
      prevProps.clusterer !== clusterer || this.lastZoom !== roundedZoom;

    if (shouldRecompute) {
      this.lastZoom = roundedZoom;
      this.setState({
        clusters: this.computeClusters(
          clusterer,
          bounds,
          width,
          height,
          viewport.zoom,
        ),
      });
    }
  }

  computeClusters(
    clusterer: Clusterer,
    bounds: [[number, number], [number, number]],
    width: number | undefined,
    height: number | undefined,
    zoom: number,
  ): Location[] {
    const offsetHorizontal =
      ((width || DEFAULT_DIMENSION) * VIEWPORT_BUFFER_MULTIPLIER) /
      VIEWPORT_BUFFER_DIVISOR;
    const offsetVertical =
      ((height || DEFAULT_DIMENSION) * VIEWPORT_BUFFER_MULTIPLIER) /
      VIEWPORT_BUFFER_DIVISOR;
    const bbox: [number, number, number, number] = [
      bounds[0][0] - offsetHorizontal,
      bounds[0][1] - offsetVertical,
      bounds[1][0] + offsetHorizontal,
      bounds[1][1] + offsetVertical,
    ];
    return clusterer.getClusters(bbox, Math.round(zoom));
  }

  handleViewportChange(evt: ViewStateChangeEvent) {
    const { latitude, longitude, zoom } = evt.viewState;

    if (
      latitude === undefined ||
      longitude === undefined ||
      zoom === undefined
    ) {
      console.warn('MapBox: Invalid viewport change event', evt);
      return;
    }

    const viewport: Viewport = { latitude, longitude, zoom };
    this.setState({ viewport });
    this.props.onViewportChange?.(viewport);
  }

  handleMapLoad() {
    this.setState({ isMapLoaded: true });
  }

  render() {
    const {
      width,
      height,
      aggregatorName,
      mapStyle,
      mapboxApiKey,
      pointRadius,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
      hasCustomMetric,
    } = this.props;
    const { viewport, clusters, isMapLoaded } = this.state;
    const isDragging =
      viewport.isDragging === undefined ? false : viewport.isDragging;

    return (
      <div
        style={{
          width,
          height,
          pointerEvents: isMapLoaded ? 'auto' : 'none',
        }}
      >
        <Map
          {...viewport}
          mapStyle={mapStyle}
          mapboxAccessToken={mapboxApiKey}
          onMove={this.handleViewportChange}
          onIdle={this.handleMapLoad}
          preserveDrawingBuffer
          style={{ width: '100%', height: '100%' }}
        >
          {isMapLoaded && (
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
          )}
        </Map>
      </div>
    );
  }
}

export default MapBox;
