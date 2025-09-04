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
  processSpatialData,
  getMapboxApiKey,
  addJsColumnsToExtraProps,
  DataRecord,
} from '../spatialUtils';
import { DeckScatterFormData } from './buildQuery';

const NOOP = () => {};

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

  return spatialFeatures.map((feature, index) => {
    const record = records[index];
    let scatterPoint: ScatterPoint = {
      position: feature.position,
      extraProps: {},
    };

    scatterPoint = addJsColumnsToExtraProps(scatterPoint, record, jsColumns);
    if (radiusMetricLabel && record[radiusMetricLabel] != null) {
      const radiusValue = parseFloat(String(record[radiusMetricLabel]));
      if (!Number.isNaN(radiusValue)) {
        scatterPoint.radius = radiusValue;
        scatterPoint.metric = radiusValue;
      }
    }

    if (categoryColumn && record[categoryColumn] != null) {
      scatterPoint.cat_color = String(record[categoryColumn]);
    }

    Object.keys(record).forEach(key => {
      if (spatial) {
        const spatialColumnValues = [
          spatial.lonCol,
          spatial.latCol,
          spatial.lonlatCol,
          spatial.geohashCol,
        ].filter(Boolean);
        if (spatialColumnValues.includes(key)) {
          return;
        }
      }

      if (key === radiusMetricLabel || key === categoryColumn) {
        return;
      }

      if (jsColumns?.includes(key)) {
        return;
      }

      scatterPoint[key] = record[key];
    });

    return scatterPoint;
  });
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

  const { spatial, point_radius_fixed, category_name, js_columns } =
    formData as DeckScatterFormData;

  const radiusMetricLabel = point_radius_fixed?.value
    ? getMetricLabel(point_radius_fixed.value)
    : undefined;

  const queryData = queriesData[0];
  const records = queryData?.data || [];
  const features = processScatterData(
    records,
    spatial,
    radiusMetricLabel,
    category_name,
    js_columns,
  );

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
        metricLabels: radiusMetricLabel ? [radiusMetricLabel] : [],
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
