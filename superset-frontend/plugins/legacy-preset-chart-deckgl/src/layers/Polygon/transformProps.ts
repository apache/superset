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

  return records
    .map(record => {
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

      const rawPolygonData = record[line_column];
      if (!rawPolygonData) {
        return null;
      }

      try {
        let polygonCoords: number[][];

        switch (line_type) {
          case 'json': {
            const parsed =
              typeof rawPolygonData === 'string'
                ? JSON.parse(rawPolygonData)
                : rawPolygonData;

            if (parsed.coordinates) {
              polygonCoords = parsed.coordinates[0] || parsed.coordinates;
            } else if (Array.isArray(parsed)) {
              polygonCoords = parsed;
            } else {
              return null;
            }
            break;
          }
          case 'geohash':
          case 'zipcode':
          default: {
            polygonCoords = Array.isArray(rawPolygonData) ? rawPolygonData : [];
            break;
          }
        }

        if (reverse_long_lat && polygonCoords.length > 0) {
          polygonCoords = polygonCoords.map(coord => [coord[1], coord[0]]);
        }

        feature.polygon = polygonCoords;

        if (fixedElevationValue !== undefined) {
          feature.elevation = fixedElevationValue;
        } else if (elevationLabel && record[elevationLabel] != null) {
          const elevationValue = parseMetricValue(record[elevationLabel]);
          if (elevationValue !== undefined) {
            feature.elevation = elevationValue;
          }
        }

        if (metricLabel && record[metricLabel] != null) {
          const metricValue = record[metricLabel];
          if (
            typeof metricValue === 'string' ||
            typeof metricValue === 'number'
          ) {
            feature.metrics![metricLabel] = metricValue;
          }
        }
      } catch {
        return null;
      }

      return feature;
    })
    .filter((feature): feature is PolygonFeature => feature !== null);
}

export default function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processPolygonData(records, formData as DeckPolygonFormData);

  return createBaseTransformResult(chartProps, features);
}
