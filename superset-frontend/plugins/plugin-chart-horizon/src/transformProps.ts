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
import {
  ChartProps,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  QueryFormMetric,
} from '@superset-ui/core';
import transformData from './transformData';

export default function transformProps(chartProps: ChartProps) {
  const { height, width, formData, queriesData } = chartProps;
  const {
    horizon_color_scale: horizonColorScale,
    series_height: seriesHeight,
    groupby,
    metrics,
    contribution,
  } = formData;

  // v1 responses arrive as flat records; the legacy explore_json endpoint
  // delivered pre-pivoted series.
  const rawData = queriesData[0].data;
  const data = Array.isArray(rawData)
    ? transformData(
        rawData,
        ensureIsArray(groupby).map(getColumnLabel),
        ensureIsArray(metrics as QueryFormMetric[]).map(getMetricLabel),
        Boolean(contribution),
      )
    : // legacy pre-shaped payloads pass through; nullish becomes an
      // empty series list so the renderer's data.map is safe
      (rawData ?? []);

  // Only include colorScale if defined, otherwise let defaultProps apply
  return {
    ...(horizonColorScale !== undefined && {
      colorScale: horizonColorScale as string,
    }),
    data,
    height,
    seriesHeight: parseInt(String(seriesHeight ?? 20), 10),
    width,
  };
}
