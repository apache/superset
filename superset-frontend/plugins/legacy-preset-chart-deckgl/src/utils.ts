/* eslint-disable no-negated-condition */
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
import { extent } from 'd3-array';
import { ScaleLinear, ScaleThreshold, scaleThreshold } from 'd3-scale';
import {
  getSequentialSchemeRegistry,
  JsonObject,
  QueryFormData,
  SequentialScheme,
} from '@superset-ui/core';
import { Color } from '@deck.gl/core';
import { GeoBoundingBox, TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, PathLayer } from '@deck.gl/layers';
import { hexToRGB } from './utils/colors';
import { ColorBreakpointType } from './types';

export const TRANSPARENT_COLOR_ARRAY = [0, 0, 0, 0] as Color;
export const HIGHLIGHT_COLOR_ARRAY = [255, 0, 0, 255] as Color;

const DEFAULT_NUM_BUCKETS = 10;

export const MAPBOX_LAYER_PREFIX = 'mapbox://';
export const TILE_LAYER_PREFIX = 'tile://';
export const OSM_LAYER_KEYWORDS = ['openstreetmap', 'osm'];

export type Buckets = {
  break_points: string[];
  num_buckets: string;
};

export type BucketsWithColorScale = Buckets & {
  linear_color_scheme: string | string[];
  opacity: number;
};

export function getBreakPoints(
  {
    break_points: formDataBreakPoints,
    num_buckets: formDataNumBuckets,
  }: Buckets,
  features: JsonObject[],
  accessor: (value: JsonObject) => number | undefined,
) {
  if (!features) {
    return [];
  }
  if (formDataBreakPoints === undefined || formDataBreakPoints.length === 0) {
    // compute evenly distributed break points based on number of buckets
    const numBuckets = formDataNumBuckets
      ? parseInt(formDataNumBuckets, 10)
      : DEFAULT_NUM_BUCKETS;
    const [minValue, maxValue] = extent<JsonObject, number>(
      features,
      accessor,
    ).map((value: number | string | undefined) =>
      typeof value === 'string' ? parseFloat(value) : value,
    );
    if (minValue === undefined || maxValue === undefined) {
      return [];
    }
    // Handle Infinity values
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return [];
    }
    const delta = (maxValue - minValue) / numBuckets;
    const precision =
      delta === 0 ? 0 : Math.max(0, Math.ceil(Math.log10(1 / delta)));

    // Generate breakpoints
    const breakPoints = new Array(numBuckets + 1).fill(0).map((_, i) => {
      const value = minValue + i * delta;

      // For the first breakpoint, floor to ensure minimum is included
      if (i === 0) {
        const scale = Math.pow(10, precision);
        return (Math.floor(minValue * scale) / scale).toFixed(precision);
      }

      // For the last breakpoint, ceil to ensure maximum is included
      if (i === numBuckets) {
        const scale = Math.pow(10, precision);
        return (Math.ceil(maxValue * scale) / scale).toFixed(precision);
      }

      // For middle breakpoints, use standard rounding
      return value.toFixed(precision);
    });

    return breakPoints;
  }

  return formDataBreakPoints.sort(
    (a: string, b: string) => parseFloat(a) - parseFloat(b),
  );
}

export function getBreakPointColorScaler(
  {
    break_points: formDataBreakPoints,
    num_buckets: formDataNumBuckets,
    linear_color_scheme: linearColorScheme,
    opacity,
  }: BucketsWithColorScale,
  features: JsonObject[],
  accessor: (value: JsonObject) => number | undefined,
): (data?: JsonObject) => Color {
  const breakPoints =
    formDataBreakPoints || formDataNumBuckets
      ? getBreakPoints(
          {
            break_points: formDataBreakPoints,
            num_buckets: formDataNumBuckets,
          },
          features,
          accessor,
        )
      : null;
  const colorScheme = Array.isArray(linearColorScheme)
    ? new SequentialScheme({
        colors: linearColorScheme,
        id: 'custom',
      })
    : getSequentialSchemeRegistry().get(linearColorScheme);

  if (!colorScheme) {
    return () => TRANSPARENT_COLOR_ARRAY;
  }
  let scaler: ScaleLinear<string, string> | ScaleThreshold<number, string>;
  let maskPoint: (v: number | undefined) => boolean;
  if (breakPoints !== null) {
    // bucket colors into discrete colors
    const n = breakPoints.length - 1;
    const bucketedColors =
      n > 1
        ? colorScheme.getColors(n)
        : [colorScheme.colors[colorScheme.colors.length - 1]];

    // repeat ends
    const first = bucketedColors[0];
    const last = bucketedColors[bucketedColors.length - 1];
    bucketedColors.unshift(first);
    bucketedColors.push(last);

    const points = breakPoints.map(parseFloat);
    scaler = scaleThreshold<number, string>()
      .domain(points)
      .range(bucketedColors);
    // Only mask values that are strictly outside the min/max bounds
    // Include values equal to the max breakpoint
    maskPoint = value =>
      !!value && (value > points[points.length - 1] || value < points[0]);
  } else {
    // interpolate colors linearly
    const linearScaleDomain = extent(features, accessor);
    if (!linearScaleDomain.some(i => typeof i === 'number')) {
      scaler = colorScheme.createLinearScale();
    } else {
      scaler = colorScheme.createLinearScale(
        extent(features, accessor) as number[],
      );
    }
    maskPoint = () => false;
  }

  return (d: JsonObject): Color => {
    const v = accessor(d);
    if (!v) {
      return TRANSPARENT_COLOR_ARRAY;
    }
    const c = hexToRGB(scaler(v));
    if (maskPoint(v)) {
      c[3] = 0;
    } else {
      c[3] = (opacity / 100) * 255;
    }

    return c;
  };
}

export function getBuckets(
  fd: QueryFormData & BucketsWithColorScale,
  features: JsonObject[],
  accessor: (value: JsonObject) => number | undefined,
) {
  const breakPoints = getBreakPoints(fd, features, accessor);
  const colorScaler = getBreakPointColorScaler(fd, features, accessor);
  const buckets: Record<
    string,
    { color: Color | undefined; enabled: boolean }
  > = {};
  breakPoints.slice(1).forEach((_, i) => {
    const range = `${breakPoints[i]} - ${breakPoints[i + 1]}`;
    const mid =
      0.5 * (parseFloat(breakPoints[i]) + parseFloat(breakPoints[i + 1]));
    // fix polygon doesn't show
    const metricLabel = fd.metric ? fd.metric.label || fd.metric : null;
    buckets[range] = {
      color: colorScaler?.({ [metricLabel || fd.metric]: mid }),
      enabled: true,
    };
  });

  return buckets;
}

export function getColorBreakpointsBuckets(
  colorBreakpoints: ColorBreakpointType[],
) {
  const breakpoints = colorBreakpoints || [];

  const buckets: Record<string, { color: Color; enabled: boolean }> = {};

  if (!breakpoints || !breakpoints.length) {
    return buckets;
  }

  breakpoints.forEach((breakpoint: ColorBreakpointType) => {
    const range = `${breakpoint.minValue} - ${breakpoint.maxValue}`;

    buckets[range] = {
      color: [breakpoint.color.r, breakpoint.color.g, breakpoint.color.b],
      enabled: true,
    };
  });

  return buckets;
}

export function buildTileLayer(url: string, id: string) {
  interface TileLayerProps {
    id: string;
    data: string;
    minZoom: number;
    maxZoom: number;
    tileSize: number;
    renderSubLayers: (props: any) => (BitmapLayer | PathLayer)[];
  }

  interface RenderSubLayerProps {
    tile: {
      bbox: GeoBoundingBox;
    };
    data: any;
  }

  return new TileLayer({
    data: url,
    id,
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,

    renderSubLayers: (props: RenderSubLayerProps): BitmapLayer[] => {
      const { west, north, east, south } = props.tile.bbox as GeoBoundingBox;

      // Ajouter une BitmapLayer
      const bitmapLayer = new BitmapLayer(props, {
        data: undefined,
        image: props.data,
        bounds: [west, south, east, north],
      });

      return [bitmapLayer];
    },
  } as TileLayerProps);
}
