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
import { processSpatialData, getMapboxApiKey } from '../spatialUtils';
import { DeckContourFormData } from './buildQuery';

const NOOP = () => {};

interface ContourPoint {
  position: [number, number];
  weight: number;
  extraProps?: { [key: string]: any };
  [key: string]: any;
}

function processContourData(
  records: any[],
  spatial: DeckContourFormData['spatial'],
  metricLabel?: string,
  jsColumns?: string[],
): ContourPoint[] {
  if (!spatial || !records.length) {
    return [];
  }

  const spatialFeatures = processSpatialData(
    records,
    spatial,
    metricLabel,
    jsColumns,
  );

  return spatialFeatures.map((feature, index) => {
    const record = records[index];
    const contourPoint: ContourPoint = {
      position: feature.position,
      weight: feature.weight,
      extraProps: {},
    };

    // Add js_columns to extraProps (matching legacy get_js_columns behavior)
    if (jsColumns?.length) {
      jsColumns.forEach(col => {
        if (record[col] !== undefined) {
          contourPoint.extraProps![col] = record[col];
        }
      });
    }

    // Copy other properties to top level for direct access (excluding processed fields)
    Object.keys(record).forEach(key => {
      // Skip spatial columns
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

      // Skip already processed fields
      if (key === metricLabel) {
        return;
      }

      // Skip js_columns (already in extraProps)
      if (jsColumns?.includes(key)) {
        return;
      }

      // Add to top level for direct access
      contourPoint[key] = record[key];
    });

    return contourPoint;
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

  const { spatial, size: metric, js_columns } = formData as DeckContourFormData;

  const metricLabel = metric ? getMetricLabel(metric) : undefined;

  // Process the query data to extract contour features
  const queryData = queriesData[0];
  const records = queryData?.data || [];
  const features = processContourData(
    records,
    spatial,
    metricLabel,
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
        metricLabels: metricLabel ? [metricLabel] : [],
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
