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
import { memo, useCallback } from 'react';
import { CanvasOverlay } from 'react-map-gl';
import { kmToPixels, MILES_PER_KM } from './utils/geo';
import roundDecimal from './utils/roundDecimal';
import luminanceFromRGB from './utils/luminanceFromRGB';
import 'mapbox-gl/dist/mapbox-gl.css';

interface GeoJSONLocation {
  geometry: {
    coordinates: [number, number];
  };
  properties: Record<string, number | string | boolean | null | undefined>;
}

interface RedrawParams {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  isDragging: boolean;
  project: (lngLat: [number, number]) => [number, number];
}

interface DrawTextOptions {
  fontHeight?: number;
  label?: string | number;
  radius?: number;
  rgb?: (string | number)[];
  shadow?: boolean;
}

interface ScatterPlotGlowOverlayProps {
  aggregation?: string;
  compositeOperation?: string;
  dotRadius?: number;
  globalOpacity?: number;
  lngLatAccessor?: (location: GeoJSONLocation) => [number, number];
  locations: GeoJSONLocation[];
  pointRadiusUnit?: string;
  renderWhileDragging?: boolean;
  rgb?: (string | number)[];
  zoom?: number;
  isDragging?: boolean;
}

const defaultLngLatAccessor = (location: GeoJSONLocation): [number, number] => [
  location.geometry.coordinates[0],
  location.geometry.coordinates[1],
];

const computeClusterLabel = (
  properties: Record<string, number | string | boolean | null | undefined>,
  aggregation: string | undefined,
): number | string => {
  const count = properties.point_count as number;
  if (!aggregation) {
    return count;
  }
  if (aggregation === 'sum' || aggregation === 'min' || aggregation === 'max') {
    return properties[aggregation] as number;
  }
  const { sum } = properties as { sum: number };
  const mean = sum / count;
  if (aggregation === 'mean') {
    return Math.round(100 * mean) / 100;
  }
  const { squaredSum } = properties as { squaredSum: number };
  const variance = squaredSum / count - (sum / count) ** 2;
  if (aggregation === 'var') {
    return Math.round(100 * variance) / 100;
  }
  if (aggregation === 'stdev') {
    return Math.round(100 * Math.sqrt(variance)) / 100;
  }

  // fallback to point_count, this really shouldn't happen
  return count;
};

function ScatterPlotGlowOverlay({
  aggregation,
  compositeOperation = 'source-over',
  dotRadius = 4,
  globalOpacity,
  lngLatAccessor = defaultLngLatAccessor,
  locations,
  pointRadiusUnit,
  renderWhileDragging = true,
  rgb,
  zoom,
}: ScatterPlotGlowOverlayProps) {
  const drawText = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      pixel: [number, number],
      options: DrawTextOptions = {},
    ) => {
      const IS_DARK_THRESHOLD = 110;
      const {
        fontHeight = 0,
        label = '',
        radius = 0,
        rgb: rgbOption = [0, 0, 0],
        shadow = false,
      } = options;
      const maxWidth = radius * 1.8;
      const luminance = luminanceFromRGB(
        rgbOption[1] as number,
        rgbOption[2] as number,
        rgbOption[3] as number,
      );

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = luminance <= IS_DARK_THRESHOLD ? 'white' : 'black';
      ctx.font = `${fontHeight}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (shadow) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = luminance <= IS_DARK_THRESHOLD ? 'black' : '';
      }

      const textWidth = ctx.measureText(String(label)).width;
      if (textWidth > maxWidth) {
        const scale = fontHeight / textWidth;
        ctx.font = `${scale * maxWidth}px sans-serif`;
      }

      ctx.fillText(String(label), pixel[0], pixel[1]);
      ctx.globalCompositeOperation = (compositeOperation ??
        'source-over') as GlobalCompositeOperation;
      ctx.shadowBlur = 0;
      ctx.shadowColor = '';
    },
    [compositeOperation],
  );

  const redraw = useCallback(
    ({ width, height, ctx, isDragging, project }: RedrawParams) => {
      const radius = dotRadius ?? 4;
      const clusterLabelMap: (number | string)[] = [];

      locations.forEach((location, i) => {
        if (location.properties.cluster) {
          clusterLabelMap[i] = computeClusterLabel(
            location.properties,
            aggregation,
          );
        }
      });

      const filteredLabels = clusterLabelMap.filter(
        v => !Number.isNaN(v),
      ) as number[];
      // Guard against empty array or zero max to prevent NaN from division
      const maxLabel =
        filteredLabels.length > 0 ? Math.max(...filteredLabels) : 1;
      const safeMaxLabel = maxLabel > 0 ? maxLabel : 1;

      // Calculate min/max radius values for Pixels mode scaling
      let minRadiusValue = Infinity;
      let maxRadiusValue = -Infinity;
      if (pointRadiusUnit === 'Pixels') {
        locations.forEach(location => {
          // Accept both null and undefined as "no value" and coerce potential numeric strings
          if (
            !location.properties.cluster &&
            location.properties.radius != null
          ) {
            const radiusValueRaw = location.properties.radius;
            const radiusValue = Number(radiusValueRaw);
            if (Number.isFinite(radiusValue)) {
              minRadiusValue = Math.min(minRadiusValue, radiusValue);
              maxRadiusValue = Math.max(maxRadiusValue, radiusValue);
            }
          }
        });
      }

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = (compositeOperation ??
        'source-over') as GlobalCompositeOperation;

      if ((renderWhileDragging || !isDragging) && locations) {
        locations.forEach((location: GeoJSONLocation, i: number) => {
          const pixel = project(lngLatAccessor(location)) as [number, number];
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
              const clusterLabel = clusterLabelMap[i];
              // Validate clusterLabel is a finite number before using it for radius calculation
              const numericLabel = Number(clusterLabel);
              const safeNumericLabel = Number.isFinite(numericLabel)
                ? numericLabel
                : 0;
              const scaledRadius = roundDecimal(
                (safeNumericLabel / safeMaxLabel) ** 0.5 * radius,
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

              gradient.addColorStop(
                1,
                `rgba(${rgb![1]}, ${rgb![2]}, ${rgb![3]}, ${0.8 * (globalOpacity ?? 1)})`,
              );
              gradient.addColorStop(
                0,
                `rgba(${rgb![1]}, ${rgb![2]}, ${rgb![3]}, 0)`,
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

              if (Number.isFinite(safeNumericLabel)) {
                let label: string | number = clusterLabel;
                if (safeNumericLabel >= 10000) {
                  label = `${Math.round(safeNumericLabel / 1000)}k`;
                } else if (safeNumericLabel >= 1000) {
                  label = `${Math.round(safeNumericLabel / 100) / 10}k`;
                }
                drawText(ctx, pixelRounded, {
                  fontHeight,
                  label,
                  radius: scaledRadius,
                  rgb,
                  shadow: true,
                });
              }
            } else {
              const defaultRadius = radius / 6;
              const rawRadius = location.properties.radius;
              const radiusProperty =
                typeof rawRadius === 'number' ? rawRadius : null;
              const pointMetric = location.properties.metric ?? null;
              let pointRadius: number = radiusProperty ?? defaultRadius;
              let pointLabel: string | number | undefined;

              if (radiusProperty != null) {
                const pointLatitude = lngLatAccessor(location)[1];
                if (pointRadiusUnit === 'Kilometers') {
                  pointLabel = `${roundDecimal(pointRadius, 2)}km`;
                  pointRadius = kmToPixels(
                    pointRadius,
                    pointLatitude,
                    zoom ?? 0,
                  );
                } else if (pointRadiusUnit === 'Miles') {
                  pointLabel = `${roundDecimal(pointRadius, 2)}mi`;
                  pointRadius = kmToPixels(
                    pointRadius * MILES_PER_KM,
                    pointLatitude,
                    zoom ?? 0,
                  );
                } else if (pointRadiusUnit === 'Pixels') {
                  // Scale pixel values to a reasonable range (radius/6 to radius/3)
                  // This ensures points are visible and proportional to their values
                  const MIN_POINT_RADIUS = radius / 6;
                  const MAX_POINT_RADIUS = radius / 3;

                  if (
                    Number.isFinite(minRadiusValue) &&
                    Number.isFinite(maxRadiusValue) &&
                    maxRadiusValue > minRadiusValue
                  ) {
                    // Normalize the value to 0-1 range, then scale to pixel range
                    const numericPointRadius = Number(pointRadius);
                    if (!Number.isFinite(numericPointRadius)) {
                      // fallback to minimum visible size when the value is not a finite number
                      pointRadius = MIN_POINT_RADIUS;
                    } else {
                      const normalizedValueRaw =
                        (numericPointRadius - minRadiusValue) /
                        (maxRadiusValue - minRadiusValue);
                      const normalizedValue = Math.max(
                        0,
                        Math.min(1, normalizedValueRaw),
                      );
                      pointRadius =
                        MIN_POINT_RADIUS +
                        normalizedValue * (MAX_POINT_RADIUS - MIN_POINT_RADIUS);
                    }
                    pointLabel = `${roundDecimal(radiusProperty, 2)}`;
                  } else if (
                    Number.isFinite(minRadiusValue) &&
                    minRadiusValue === maxRadiusValue
                  ) {
                    // All values are the same, use a fixed medium size
                    pointRadius = (MIN_POINT_RADIUS + MAX_POINT_RADIUS) / 2;
                    pointLabel = `${roundDecimal(radiusProperty, 2)}`;
                  } else {
                    // Use raw pixel values if they're already in a reasonable range
                    pointRadius = Math.max(
                      MIN_POINT_RADIUS,
                      Math.min(pointRadius, MAX_POINT_RADIUS),
                    );
                    pointLabel = `${roundDecimal(radiusProperty, 2)}`;
                  }
                }
              }

              if (pointMetric !== null) {
                const numericMetric = parseFloat(String(pointMetric));
                pointLabel = Number.isFinite(numericMetric)
                  ? roundDecimal(numericMetric, 2)
                  : String(pointMetric);
              }

              // Fall back to default points if pointRadius wasn't a numerical column
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
              ctx.fillStyle = `rgba(${rgb![1]}, ${rgb![2]}, ${rgb![3]}, ${globalOpacity})`;
              ctx.fill();

              if (pointLabel !== undefined) {
                drawText(ctx, pixelRounded, {
                  fontHeight: roundDecimal(pointRadius, 1),
                  label: pointLabel,
                  radius: pointRadius,
                  rgb,
                  shadow: false,
                });
              }
            }
          }
        });
      }
    },
    [
      aggregation,
      compositeOperation,
      dotRadius,
      drawText,
      globalOpacity,
      lngLatAccessor,
      locations,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
      zoom,
    ],
  );

  return <CanvasOverlay redraw={redraw} />;
}

export default memo(ScatterPlotGlowOverlay);
