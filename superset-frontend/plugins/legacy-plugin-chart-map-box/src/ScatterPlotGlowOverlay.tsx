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
import { PureComponent, createRef, RefObject } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { kmToPixels, MILES_PER_KM } from './utils/geo';
import roundDecimal from './utils/roundDecimal';
import luminanceFromRGB from './utils/luminanceFromRGB';
import 'mapbox-gl/dist/mapbox-gl.css';

const LUMINANCE_THRESHOLD_DARK = 110;
const TEXT_WIDTH_RATIO = 1.8;
const DEFAULT_RGB_COLOR: [number, number, number, number] = [0, 0, 0, 0];
const DEFAULT_DOT_RADIUS = 4;
const DEFAULT_RADIUS_DIVISOR = 6;
const CLUSTER_LABEL_THRESHOLD_LARGE = 10000;
const CLUSTER_LABEL_THRESHOLD_MEDIUM = 1000;

export type AggregationType = 'sum' | 'min' | 'max' | 'mean' | 'var' | 'stdev';

export interface ClusterProperties {
  cluster: true;
  cluster_id?: number;
  point_count: number;
  sum?: number;
  squaredSum?: number;
  min?: number;
  max?: number;
}

export interface PointProperties {
  cluster?: false;
  radius?: number | null;
  metric?: number | string | null;
  cat_color?: string | null;
}

export type LocationProperties = ClusterProperties | PointProperties;

export interface Geometry {
  coordinates: [number, number];
  type: string;
}

export interface Location {
  type?: 'Feature';
  geometry: Geometry;
  properties: LocationProperties;
}

interface ScatterPlotGlowOverlayProps {
  aggregation?: AggregationType;
  compositeOperation?: GlobalCompositeOperation;
  dotRadius?: number;
  isDragging?: boolean;
  lngLatAccessor?: (location: Location) => [number, number];
  locations: Location[];
  mapRef?: { current: MapRef | null | undefined };
  pointRadiusUnit?: string;
  renderWhileDragging?: boolean;
  rgb?: [number, number, number, number];
  zoom?: number;
}

interface DrawTextOptions {
  fontHeight?: number;
  label?: string | number;
  radius?: number;
  rgb?: [number, number, number, number];
  shadow?: boolean;
}

const defaultProps: Partial<ScatterPlotGlowOverlayProps> = {
  // Same as browser default.
  compositeOperation: 'source-over',
  dotRadius: 4,
  lngLatAccessor: (location: Location) => {
    const { coordinates } = location.geometry;
    return [coordinates[0], coordinates[1]];
  },
  renderWhileDragging: true,
};

const isClusterProperties = (
  props: LocationProperties,
): props is ClusterProperties => props.cluster === true;

const computeClusterLabel = (
  properties: LocationProperties,
  aggregation?: AggregationType,
): number => {
  if (!isClusterProperties(properties)) {
    return 0;
  }

  const count = properties.point_count ?? 0;
  if (!aggregation) {
    return count;
  }
  if (aggregation === 'sum' || aggregation === 'min' || aggregation === 'max') {
    const value = properties[aggregation];
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }
  const sum = properties.sum ?? 0;
  const mean = count > 0 ? sum / count : 0;
  if (aggregation === 'mean') {
    return Math.round(100 * mean) / 100;
  }
  const squaredSum = properties.squaredSum ?? 0;
  const variance = count > 0 ? squaredSum / count - mean ** 2 : 0;
  if (aggregation === 'var') {
    return Math.round(100 * variance) / 100;
  }
  if (aggregation === 'stdev') {
    return Math.round(100 * Math.sqrt(Math.max(0, variance))) / 100;
  }

  return count;
};

class ScatterPlotGlowOverlay extends PureComponent<ScatterPlotGlowOverlayProps> {
  static defaultProps = defaultProps;

  private canvasRef: RefObject<HTMLCanvasElement>;

  private containerRef: RefObject<HTMLDivElement>;

  constructor(props: ScatterPlotGlowOverlayProps) {
    super(props);
    this.canvasRef = createRef<HTMLCanvasElement>();
    this.containerRef = createRef<HTMLDivElement>();
    this.redraw = this.redraw.bind(this);
    this.updateCanvasSize = this.updateCanvasSize.bind(this);
  }

  componentDidMount() {
    this.updateCanvasSize();
    this.redraw();
    if (this.props.mapRef?.current) {
      this.props.mapRef.current.on('move', this.redraw);
      this.props.mapRef.current.on('moveend', this.redraw);
    }
  }

  componentDidUpdate(prevProps: ScatterPlotGlowOverlayProps) {
    const shouldUpdateSize = prevProps.isDragging !== this.props.isDragging;
    if (shouldUpdateSize) {
      this.updateCanvasSize();
    }

    const shouldRedraw =
      prevProps.locations !== this.props.locations ||
      prevProps.dotRadius !== this.props.dotRadius ||
      prevProps.rgb !== this.props.rgb ||
      prevProps.aggregation !== this.props.aggregation ||
      prevProps.compositeOperation !== this.props.compositeOperation ||
      prevProps.pointRadiusUnit !== this.props.pointRadiusUnit ||
      prevProps.zoom !== this.props.zoom;

    if (shouldRedraw) {
      this.redraw();
    }
  }

  componentWillUnmount() {
    if (this.props.mapRef?.current) {
      this.props.mapRef.current.off('move', this.redraw);
      this.props.mapRef.current.off('moveend', this.redraw);
    }
  }

  updateCanvasSize() {
    const canvas = this.canvasRef.current;
    const container = this.containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const w = Math.round(width);
    const h = Math.round(height);
    // Keep canvas internal pixel size in whole pixels and keep the CSS size in sync.
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
  }

  drawText(
    ctx: CanvasRenderingContext2D,
    pixel: [number, number],
    options: DrawTextOptions = {},
  ) {
    const {
      fontHeight = 0,
      label = '',
      radius = 0,
      rgb = DEFAULT_RGB_COLOR,
      shadow = false,
    } = options;
    const maxWidth = radius * TEXT_WIDTH_RATIO;
    const luminance = luminanceFromRGB(rgb[0], rgb[1], rgb[2]);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = luminance <= LUMINANCE_THRESHOLD_DARK ? 'white' : 'black';
    ctx.font = `${fontHeight}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = luminance <= LUMINANCE_THRESHOLD_DARK ? 'black' : 'transparent';
    }

    const textWidth = ctx.measureText(String(label)).width;
    if (textWidth > maxWidth) {
      const scale = fontHeight / textWidth;
      ctx.font = `${scale * maxWidth}px sans-serif`;
    }

    const { compositeOperation } = this.props;

    ctx.fillText(String(label), pixel[0], pixel[1]);
    ctx.globalCompositeOperation = compositeOperation || 'source-over';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  redraw() {
    const canvas = this.canvasRef.current;
    if (!canvas) {
      console.warn('ScatterPlotGlowOverlay: Canvas ref not available');
      return;
    }

    const { current: map } = this.props.mapRef || {};
    if (!map) {
      console.warn('ScatterPlotGlowOverlay: Map ref not available');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('ScatterPlotGlowOverlay: Unable to get canvas 2D context');
      return;
    }

    const { width, height } = canvas;
    const project = (coords: [number, number]): [number, number] => {
      const point = map.project(coords);
      return [point.x, point.y];
    };
    const { isDragging } = this.props;
    const {
      aggregation,
      compositeOperation,
      dotRadius,
      lngLatAccessor,
      locations,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
      zoom,
    } = this.props;

    const radius = dotRadius ?? DEFAULT_DOT_RADIUS;
    const clusterLabelMap: number[] = [];

    locations.forEach((location, i) => {
      if (location.properties.cluster) {
        clusterLabelMap[i] = computeClusterLabel(
          location.properties,
          aggregation,
        );
      }
    });

    const validLabels = clusterLabelMap.filter(v => Number.isFinite(v) && v > 0);
    const maxLabel = validLabels.length > 0 ? Math.max(...validLabels) : 1;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = compositeOperation || 'source-over';

    if ((renderWhileDragging || !isDragging) && locations) {
      locations.forEach((location, i) => {
        const pixel = project(
          lngLatAccessor
            ? lngLatAccessor(location)
            : [
                location.geometry.coordinates[0],
                location.geometry.coordinates[1],
              ],
        );
        const pixelRounded: [number, number] = [
          roundDecimal(pixel[0], 1),
          roundDecimal(pixel[1], 1),
        ];

        if (
          pixelRounded[0] + radius >= 0 &&
          pixelRounded[0] - radius < width &&
          pixelRounded[1] + radius >= 0 &&
          pixelRounded[1] - radius < height
        ) {
          ctx.beginPath();
          if (location.properties.cluster) {
            let clusterLabel: number | string = clusterLabelMap[i];
            const scaledRadius = roundDecimal(
              maxLabel > 0 && Number.isFinite(clusterLabel)
                ? ((clusterLabel as number) / maxLabel) ** 0.5 * radius
                : radius * 0.5,
              1,
            );
            const fontHeight = roundDecimal(scaledRadius * 0.5, 1);
            const [x, y] = pixelRounded;
            const gradient = ctx.createRadialGradient(
              x,
              y,
              scaledRadius,
              x,
              y,
              0,
            );

            const rgbColor = rgb ?? DEFAULT_RGB_COLOR;
            gradient.addColorStop(
              1,
              `rgba(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]}, 0.8)`,
            );
            gradient.addColorStop(
              0,
              `rgba(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]}, 0)`,
            );
            ctx.arc(
              pixelRounded[0],
              pixelRounded[1],
              scaledRadius,
              0,
              Math.PI * 2,
            );
            ctx.fillStyle = gradient;
            ctx.fill();

            if (Number.isFinite(parseFloat(String(clusterLabel)))) {
              if (clusterLabel >= CLUSTER_LABEL_THRESHOLD_LARGE) {
                clusterLabel = `${Math.round(clusterLabel / 1000)}k`;
              } else if (clusterLabel >= CLUSTER_LABEL_THRESHOLD_MEDIUM) {
                clusterLabel = `${Math.round(clusterLabel / 100) / 10}k`;
              }
              this.drawText(ctx, pixelRounded, {
                fontHeight,
                label: clusterLabel,
                radius: scaledRadius,
                rgb: rgbColor,
                shadow: true,
              });
            }
          } else {
            const defaultRadius = radius / DEFAULT_RADIUS_DIVISOR;
            const pointProps = location.properties as PointProperties;
            const radiusProperty = pointProps.radius;
            const pointMetric = pointProps.metric;
            let pointRadius = radiusProperty ?? defaultRadius;
            let pointLabel: string | number | undefined;

            if (radiusProperty != null && lngLatAccessor) {
              const pointLatitude = lngLatAccessor(location)[1];
              if (pointRadiusUnit === 'Kilometers' && pointRadius) {
                pointLabel = `${roundDecimal(pointRadius, 2)}km`;
                pointRadius = kmToPixels(pointRadius, pointLatitude, zoom ?? 0);
              } else if (pointRadiusUnit === 'Miles' && pointRadius) {
                pointLabel = `${roundDecimal(pointRadius, 2)}mi`;
                pointRadius = kmToPixels(
                  pointRadius * MILES_PER_KM,
                  pointLatitude,
                  zoom ?? 0,
                );
              }
            }

            if (pointMetric != null) {
              pointLabel = Number.isFinite(parseFloat(String(pointMetric)))
                ? roundDecimal(Number(pointMetric), 2)
                : String(pointMetric);
            }

            if (!pointRadius) {
              pointRadius = defaultRadius;
            }

            ctx.arc(
              pixelRounded[0],
              pixelRounded[1],
              roundDecimal(pointRadius, 1),
              0,
              Math.PI * 2,
            );
            const rgbColor = rgb ?? DEFAULT_RGB_COLOR;
            ctx.fillStyle = `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
            ctx.fill();

            if (pointLabel !== undefined) {
              this.drawText(ctx, pixelRounded, {
                fontHeight: roundDecimal(pointRadius, 1),
                label: pointLabel,
                radius: pointRadius,
                rgb: rgbColor,
                shadow: false,
              });
            }
          }
        }
      });
    }
  }

  render() {
    return (
      <div
        ref={this.containerRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <canvas
          ref={this.canvasRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }
}

function ScatterPlotGlowOverlayWithMap(props: ScatterPlotGlowOverlayProps) {
  const { current: map } = useMap();
  const mapRef = { current: map };
  return <ScatterPlotGlowOverlay {...props} mapRef={mapRef} />;
}

export default ScatterPlotGlowOverlayWithMap;
