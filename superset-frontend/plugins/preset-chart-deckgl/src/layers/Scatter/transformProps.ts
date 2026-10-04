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
import { logging } from '@apache-superset/core/utils';
import { processSpatialData, DataRecord } from '../spatialUtils';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  getMetricLabelFromFormData,
  parseMetricValue,
  addPropertiesToFeature,
} from '../transformUtils';
import { DeckScatterFormData } from './buildQuery';
import { isFixedValue, getFixedValue } from '../utils/metricUtils';

interface ScatterPoint {
  position: [number, number];
  radius?: number;
  color?: [number, number, number, number];
  cat_color?: string;
  metric?: number;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Keep only typed geographic points that can be drawn: numeric, in-range
 * latitude/longitude and, for a metric radius, a finite nonnegative radius.
 * Other spatial formats use the native decoder after Explore format changes.
 *
 * The MCP data and export contract rejects such rows outright; the render
 * layer skips them so one sparse row does not blank the whole map, and logs
 * how many points were skipped so the loss is diagnosable.
 */
export function filterDrawableGeographicPoints(
  records: DataRecord[],
  spatial: DeckScatterFormData['spatial'],
  radiusMetricLabel?: string,
): DataRecord[] {
  const coordinateColumns = [
    [spatial?.latCol, 90],
    [spatial?.lonCol, 180],
  ] as const;
  const reservedMetricLabel =
    radiusMetricLabel !== undefined &&
    ['position', 'weight', 'extraProps'].includes(radiusMetricLabel);
  const drawable = records.filter(record => {
    // Explore can change a metric label after MCP schema validation.
    if (reservedMetricLabel) {
      return false;
    }
    const validCoordinates =
      spatial?.type !== 'latlong' ||
      coordinateColumns.every(([column, bound]) => {
        const value = column ? record[column] : undefined;
        return isFiniteNumber(value) && Math.abs(value) <= bound;
      });
    if (!validCoordinates || !radiusMetricLabel) {
      return validCoordinates;
    }
    const radius = record[radiusMetricLabel];
    return isFiniteNumber(radius) && radius >= 0;
  });
  const skipped = records.length - drawable.length;
  if (skipped > 0) {
    logging.warn(
      `Skipped ${skipped} of ${records.length} geographic points with ` +
        'missing or out-of-range coordinates or radius',
    );
  }
  return drawable;
}

function processScatterData(
  records: DataRecord[],
  spatial: DeckScatterFormData['spatial'],
  radiusMetricLabel?: string,
  categoryColumn?: string,
  fixedRadiusValue?: number | string | null,
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
  ]);

  const parsedFixedRadius = parseMetricValue(fixedRadiusValue);

  return spatialFeatures.map(feature => {
    let scatterPoint: ScatterPoint = {
      position: feature.position,
      extraProps: feature.extraProps || {},
    };

    // Reserved source columns live in extraProps to protect computed geometry.
    const getSourceValue = (column?: string): unknown =>
      column
        ? feature.extraProps && column in feature.extraProps
          ? feature.extraProps[column]
          : feature[column]
        : undefined;

    // Handle radius: either from metric or fixed value
    if (fixedRadiusValue != null) {
      // Use fixed radius value for all points
      if (parsedFixedRadius !== undefined) {
        scatterPoint.radius = parsedFixedRadius;
      }
    } else if (radiusMetricLabel) {
      // Use metric value for radius
      const radiusValue = parseMetricValue(getSourceValue(radiusMetricLabel));
      if (radiusValue !== undefined) {
        scatterPoint.radius = radiusValue;
        scatterPoint.metric = radiusValue;
      }
    }

    const categoryValue = getSourceValue(categoryColumn);
    if (categoryValue != null) {
      scatterPoint.cat_color = String(categoryValue);
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
  const { spatial, point_radius_fixed, dimension } =
    formData as DeckScatterFormData;

  // Check if this is a fixed value or metric
  const fixedRadiusValue = isFixedValue(point_radius_fixed)
    ? getFixedValue(point_radius_fixed)
    : null;

  const radiusMetricLabel = getMetricLabelFromFormData(point_radius_fixed);
  const records = getRecordsFromQuery(chartProps.queriesData);

  const displayRecords = formData.mcp_geographic
    ? filterDrawableGeographicPoints(records, spatial, radiusMetricLabel)
    : records;
  const features = processScatterData(
    displayRecords,
    spatial,
    radiusMetricLabel,
    dimension,
    fixedRadiusValue,
  );

  return createBaseTransformResult(
    chartProps,
    features,
    radiusMetricLabel ? [radiusMetricLabel] : [],
  );
}
