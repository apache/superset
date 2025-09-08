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
import { ChartProps } from '@superset-ui/core';
import { processSpatialData, DataRecord } from '../spatialUtils';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  getMetricLabelFromFormData,
  parseMetricValue,
  addPropertiesToFeature,
} from '../transformUtils';
import { DeckScatterFormData } from './buildQuery';

interface ScatterPoint {
  position: [number, number];
  radius?: number;
  color?: [number, number, number, number];
  cat_color?: string;
  metric?: number;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

function processScatterData(
  records: DataRecord[],
  spatial: DeckScatterFormData['spatial'],
  radiusMetricLabel?: string,
  categoryColumn?: string,
  jsColumns?: string[],
): ScatterPoint[] {
  if (!spatial || !records.length) {
    return [];
  }

  const spatialFeatures = processSpatialData(records, spatial);
  const excludeKeys = new Set([
    'position',
    'weight',
    'extraProps',
    ...(spatial
      ? [
          spatial.lonCol,
          spatial.latCol,
          spatial.lonlatCol,
          spatial.geohashCol,
        ].filter(Boolean)
      : []),
    radiusMetricLabel,
    categoryColumn,
    ...(jsColumns || []),
  ]);

  return spatialFeatures.map(feature => {
    let scatterPoint: ScatterPoint = {
      position: feature.position,
      extraProps: feature.extraProps || {},
    };

    if (radiusMetricLabel && feature[radiusMetricLabel] != null) {
      const radiusValue = parseMetricValue(feature[radiusMetricLabel]);
      if (radiusValue !== undefined) {
        scatterPoint.radius = radiusValue;
        scatterPoint.metric = radiusValue;
      }
    }

    if (categoryColumn && feature[categoryColumn] != null) {
      scatterPoint.cat_color = String(feature[categoryColumn]);
    }

    scatterPoint = addPropertiesToFeature(
      scatterPoint,
      feature as DataRecord,
      excludeKeys,
    );
    return scatterPoint;
  });
}

export default function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const { spatial, point_radius_fixed, category_name, js_columns } =
    formData as DeckScatterFormData;

  const radiusMetricLabel = getMetricLabelFromFormData(point_radius_fixed);
  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processScatterData(
    records,
    spatial,
    radiusMetricLabel,
    category_name,
    js_columns,
  );

  return createBaseTransformResult(
    chartProps,
    features,
    radiusMetricLabel ? [radiusMetricLabel] : [],
  );
}
