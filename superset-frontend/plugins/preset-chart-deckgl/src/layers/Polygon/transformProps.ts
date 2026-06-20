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

interface PolygonFeature extends Record<string, unknown> {
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

  return records.flatMap(record => {
    let feature: PolygonFeature = {
      extraProps: {},
      metrics: {},
    };

    feature = addJsColumnsToExtraProps(feature, record, js_columns);
    feature = addPropertiesToFeature(feature, record, excludeKeys);

    const rawPolygonData = record[line_column];
    if (!rawPolygonData) {
      return [];
    }

    try {
      // One ring per polygon; a MultiPolygon yields several rings, all other
      // shapes yield exactly one.
      let rings: number[][][];

      switch (line_type) {
        case 'json': {
          const parsed =
            typeof rawPolygonData === 'string'
              ? JSON.parse(rawPolygonData)
              : rawPolygonData;
          // Unwrap GeoJSON Feature ({ geometry: { type, coordinates } })
          const geom = parsed.geometry ?? parsed;

          if (geom.type === 'MultiPolygon') {
            // Only the outer ring of each polygon is used; inner rings (holes) are
            // intentionally ignored because the downstream layer does not support them.
            rings = geom.coordinates.map((poly: number[][][]) => poly[0]);
          } else if (geom.coordinates) {
            // coordinates[0] is the outer ring for Polygon; holes are not rendered.
            rings = [geom.coordinates[0] || geom.coordinates];
          } else if (Array.isArray(geom)) {
            rings = [geom];
          } else {
            return [];
          }
          break;
        }
        case 'geohash': {
          const decoded = decode_bbox(String(rawPolygonData));
          if (!decoded) {
            return [];
          }
          rings = [
            [
              [decoded[1], decoded[0]], // SW
              [decoded[1], decoded[2]], // NW
              [decoded[3], decoded[2]], // NE
              [decoded[3], decoded[0]], // SE
              [decoded[1], decoded[0]], // close
            ],
          ];
          break;
        }
        case 'zipcode':
        default:
          rings = [Array.isArray(rawPolygonData) ? rawPolygonData : []];
      }

      let elevation: number | undefined;
      if (fixedElevationValue !== undefined) {
        elevation = fixedElevationValue;
      } else if (elevationLabel && record[elevationLabel] != null) {
        elevation = parseMetricValue(record[elevationLabel]);
      }

      const metrics = { ...feature.metrics };
      const metricValue = metricLabel ? record[metricLabel] : undefined;
      if (typeof metricValue === 'string' || typeof metricValue === 'number') {
        metrics[metricLabel!] = metricValue;
      }

      return rings.map(ring => ({
        ...feature,
        polygon: reverse_long_lat ? ring.map(c => [c[1], c[0]]) : ring,
        elevation,
        metrics,
      }));
    } catch {
      return [];
    }
  });
}

export default function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processPolygonData(records, formData as DeckPolygonFormData);

  return createBaseTransformResult(chartProps, features);
}
