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
import { getMapboxApiKey } from '../spatialUtils';
import { DeckPolygonFormData } from './buildQuery';

const NOOP = () => {};

interface PolygonFeature {
  polygon?: number[][];
  name?: string;
  elevation?: number;
  extraProps?: { [key: string]: any };
  [key: string]: any;
}

function processPolygonData(
  records: any[],
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

  const metricLabel = metric ? getMetricLabel(metric) : null;
  const elevationLabel = point_radius_fixed?.value
    ? getMetricLabel(point_radius_fixed.value)
    : null;

  return records
    .map(record => {
      const feature: PolygonFeature = {
        extraProps: {},
      };

      // Add js_columns to extraProps (matching legacy get_js_columns behavior)
      if (js_columns?.length) {
        js_columns.forEach(col => {
          if (record[col] !== undefined) {
            feature.extraProps![col] = record[col];
          }
        });
      }

      // Copy other properties to top level for direct access (excluding processed fields)
      Object.keys(record).forEach(key => {
        // Skip the polygon column
        if (key === line_column) {
          return;
        }

        // Skip js_columns (already in extraProps)
        if (js_columns?.includes(key)) {
          return;
        }

        // Add to top level for direct access
        feature[key] = record[key];
      });

      // Process polygon data based on encoding type
      const rawPolygonData = record[line_column];
      if (!rawPolygonData) {
        return null;
      }

      try {
        let polygonCoords: number[][];

        switch (line_type) {
          case 'json': {
            // Parse JSON polygon data
            const parsed =
              typeof rawPolygonData === 'string'
                ? JSON.parse(rawPolygonData)
                : rawPolygonData;

            // Handle different GeoJSON-like structures
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
            // For now, assume it's already in the correct format
            // This would need specific handling based on the encoding type
            polygonCoords = Array.isArray(rawPolygonData) ? rawPolygonData : [];
            break;
          }
        }

        // Reverse coordinates if needed (swap lat/lng)
        if (reverse_long_lat && polygonCoords.length > 0) {
          polygonCoords = polygonCoords.map(coord => [coord[1], coord[0]]);
        }

        feature.polygon = polygonCoords;

        // Add elevation from metric
        if (elevationLabel && record[elevationLabel] != null) {
          const elevationValue = parseFloat(record[elevationLabel]);
          if (!Number.isNaN(elevationValue)) {
            feature.elevation = elevationValue;
          }
        }

        // Ensure metric value is accessible
        if (metricLabel && record[metricLabel] != null) {
          feature[metricLabel] = record[metricLabel];
        }
      } catch (error) {
        // Skip invalid polygon data
        return null;
      }

      return feature;
    })
    .filter((feature): feature is PolygonFeature => feature !== null);
}

export default function transformProps(chartProps: ChartProps) {
  const {
    datasource,
    height,
    hooks,
    queriesData,
    rawFormData: formData,
    width,
    filterState,
    emitCrossFilters,
  } = chartProps;

  const {
    onAddFilter = NOOP,
    onContextMenu = NOOP,
    setControlValue = NOOP,
    setDataMask = NOOP,
  } = hooks;

  // Process the query data to extract polygon features
  const queryData = queriesData[0];
  const records = queryData?.data || [];
  const features = processPolygonData(records, formData as DeckPolygonFormData);

  return {
    datasource,
    emitCrossFilters,
    formData,
    height,
    onAddFilter,
    onContextMenu,
    payload: {
      ...queryData,
      data: {
        features,
        mapboxApiKey: getMapboxApiKey(),
      },
    },
    setControlValue,
    filterState,
    viewport: {
      ...formData.viewport,
      height,
      width,
    },
    width,
    setDataMask,
    setTooltip: () => {},
  };
}
