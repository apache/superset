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
import { ChartProps, getMetricLabel } from '@superset-ui/core';
import { addJsColumnsToExtraProps, DataRecord } from '../spatialUtils';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  getMetricLabelFromFormData,
  parseMetricValue,
  addPropertiesToFeature,
} from '../transformUtils';
import { DeckPolygonFormData } from './buildQuery';
import { decode_bbox } from 'ngeohash';

function parseElevationValue(value: string): number | undefined {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

interface PolygonFeature {
  polygon?: number[][];
  name?: string;
  elevation?: number;
  extraProps?: Record<string, unknown>;
  metrics?: Record<string, number | string>;
}

type PolygonCoordinates = number[][];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getOwnRecordValue(
  record: DataRecord,
  key: string | undefined,
): string | number | null | undefined {
  if (!key || !Object.prototype.hasOwnProperty.call(record, key)) {
    return undefined;
  }

  return record[key];
}

function getGeoJsonGeometry(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  if (value.coordinates) {
    return value;
  }

  return isPlainRecord(value.geometry) ? value.geometry : null;
}

function getPolygonCoordinateParts(
  value: unknown,
): PolygonCoordinates[] | null {
  if (Array.isArray(value)) {
    return [value as PolygonCoordinates];
  }

  const geometry = getGeoJsonGeometry(value);
  if (!geometry?.coordinates || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap(polygon =>
      Array.isArray(polygon)
        ? [(polygon[0] || polygon) as PolygonCoordinates]
        : [],
    );
  }

  return [
    (geometry.coordinates[0] || geometry.coordinates) as PolygonCoordinates,
  ];
}

function processPolygonData(
  records: DataRecord[],
  formData: DeckPolygonFormData,
): PolygonFeature[] {
  const {
    line_column,
    line_type,
    metric,
    point_radius_fixed,
    reverse_long_lat,
    js_columns,
  } = formData;

  if (!line_column || !records.length) {
    return [];
  }

  const metricLabel = getMetricLabelFromFormData(metric);

  let elevationLabel: string | undefined;
  let fixedElevationValue: number | undefined;

  if (point_radius_fixed) {
    if ('type' in point_radius_fixed) {
      if (
        point_radius_fixed.type === 'metric' &&
        point_radius_fixed.value != null
      ) {
        elevationLabel = getMetricLabel(point_radius_fixed.value);
      } else if (
        point_radius_fixed.type === 'fix' &&
        point_radius_fixed.value
      ) {
        fixedElevationValue = parseElevationValue(point_radius_fixed.value);
      }
    } else if (point_radius_fixed.value) {
      fixedElevationValue = parseElevationValue(point_radius_fixed.value);
    }
  }

  const excludeKeys = new Set([line_column, ...(js_columns || [])]);

  return records.flatMap(record => {
    let feature: PolygonFeature = {
      extraProps: {},
      metrics: {},
    };

    feature = addJsColumnsToExtraProps(feature, record, js_columns);
    const updatedFeature = addPropertiesToFeature(
      feature as unknown as Record<string, unknown>,
      record,
      excludeKeys,
    );
    feature = updatedFeature as unknown as PolygonFeature;

    const rawPolygonData = getOwnRecordValue(record, line_column);
    if (!rawPolygonData) {
      return [];
    }

    try {
      let polygonCoordParts: PolygonCoordinates[];

      switch (line_type) {
        case 'json': {
          const parsed =
            typeof rawPolygonData === 'string'
              ? JSON.parse(rawPolygonData)
              : rawPolygonData;
          const parsedPolygonCoordParts = getPolygonCoordinateParts(parsed);

          if (!parsedPolygonCoordParts) {
            return [];
          }

          polygonCoordParts = parsedPolygonCoordParts;
          break;
        }
        case 'geohash': {
          const polygonCoords: PolygonCoordinates = [];
          const decoded = decode_bbox(String(rawPolygonData));
          if (decoded) {
            polygonCoords.push([decoded[1], decoded[0]]); // SW (minLon, minLat)
            polygonCoords.push([decoded[1], decoded[2]]); // NW (minLon, maxLat)
            polygonCoords.push([decoded[3], decoded[2]]); // NE (maxLon, maxLat)
            polygonCoords.push([decoded[3], decoded[0]]); // SE (maxLon, minLat)
            polygonCoords.push([decoded[1], decoded[0]]); // SW (close polygon)
          }
          polygonCoordParts = [polygonCoords];
          break;
        }
        case 'zipcode':
        default: {
          polygonCoordParts = [
            Array.isArray(rawPolygonData)
              ? (rawPolygonData as PolygonCoordinates)
              : [],
          ];
          break;
        }
      }

      if (reverse_long_lat) {
        polygonCoordParts = polygonCoordParts.map(polygonCoords =>
          polygonCoords.map(coord => [coord[1], coord[0]]),
        );
      }

      if (fixedElevationValue !== undefined) {
        feature.elevation = fixedElevationValue;
      } else {
        const rawElevationValue = getOwnRecordValue(record, elevationLabel);
        const elevationValue = parseMetricValue(rawElevationValue);
        if (elevationValue !== undefined) {
          feature.elevation = elevationValue;
        }
      }

      if (metricLabel) {
        const metricValue = getOwnRecordValue(record, metricLabel);
        if (
          typeof metricValue === 'string' ||
          typeof metricValue === 'number'
        ) {
          feature.metrics![metricLabel] = metricValue;
        }
      }

      return polygonCoordParts.map(polygonCoords => ({
        ...feature,
        extraProps: { ...feature.extraProps },
        metrics: { ...feature.metrics },
        polygon: polygonCoords,
      }));
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError) {
        return [];
      }

      throw error;
    }
  });
}

export default function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processPolygonData(records, formData as DeckPolygonFormData);

  return createBaseTransformResult(chartProps, features);
}
