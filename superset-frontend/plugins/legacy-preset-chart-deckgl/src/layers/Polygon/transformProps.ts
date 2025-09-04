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
import {
  getMapboxApiKey,
  addJsColumnsToExtraProps,
  DataRecord,
} from '../spatialUtils';
import { DeckPolygonFormData } from './buildQuery';

const NOOP = () => {};

interface PolygonFeature {
  polygon?: number[][];
  name?: string;
  elevation?: number;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
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

  const metricLabel = metric ? getMetricLabel(metric) : null;
  const elevationLabel = point_radius_fixed?.value
    ? getMetricLabel(point_radius_fixed.value)
    : null;

  return records
    .map(record => {
      let feature: PolygonFeature = {
        extraProps: {},
      };

      feature = addJsColumnsToExtraProps(feature, record, js_columns);
      Object.keys(record).forEach(key => {
        if (key === line_column) {
          return;
        }

        if (js_columns?.includes(key)) {
          return;
        }

        feature[key] = record[key];
      });

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

        if (elevationLabel && record[elevationLabel] != null) {
          const elevationValue = parseFloat(String(record[elevationLabel]));
          if (!Number.isNaN(elevationValue)) {
            feature.elevation = elevationValue;
          }
        }

        if (metricLabel && record[metricLabel] != null) {
          feature[metricLabel] = record[metricLabel];
        }
      } catch (error) {
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
