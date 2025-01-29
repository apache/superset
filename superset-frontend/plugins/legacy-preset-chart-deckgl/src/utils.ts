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
import { hexToRGB } from './utils/colors';

const DEFAULT_NUM_BUCKETS = 10;

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
    const delta = (maxValue - minValue) / numBuckets;
    const precision =
      delta === 0 ? 0 : Math.max(0, Math.ceil(Math.log10(1 / delta)));
    const extraBucket =
      maxValue > parseFloat(maxValue.toFixed(precision)) ? 1 : 0;
    const startValue =
      minValue < parseFloat(minValue.toFixed(precision))
        ? minValue - 1
        : minValue;

    return new Array(numBuckets + 1 + extraBucket)
      .fill(0)
      .map((_, i) => (startValue + i * delta).toFixed(precision));
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
) {
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
    return null;
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
    maskPoint = value => !!value && (value > points[n] || value < points[0]);
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

  return (d: JsonObject): [number, number, number, number] => {
    const v = accessor(d);
    if (!v) {
      return [0, 0, 0, 0];
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
    { color: [number, number, number, number] | undefined; enabled: boolean }
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
