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
  buildQueryContext,
  ensureIsArray,
  getMetricLabel,
  QueryFormMetric,
  QueryFormOrderBy,
  SqlaFormData,
  QueryFormColumn,
  QueryObject,
} from '@superset-ui/core';
import {
  getSpatialColumns,
  addSpatialNullFilters,
  SpatialFormData,
} from '../spatialUtils';
import {
  addJsColumnsToColumns,
  addTooltipColumnsToQuery,
} from '../buildQueryUtils';
import { isMetricValue } from '../utils/metricUtils';

export interface DeckScatterFormData
  extends Omit<SpatialFormData, 'color_picker'>, SqlaFormData {
  // Can be a string (legacy format) or an object with type and value
  point_radius_fixed?:
    | string // Legacy format: metric name directly
    | {
        type?: 'fix' | 'metric';
        value?: QueryFormMetric | number;
      };
  multiplier?: number;
  point_unit?: string;
  min_radius?: number;
  max_radius?: number;
  color_picker?: { r: number; g: number; b: number; a: number };
  dimension?: string;
}

export default function buildQuery(formData: DeckScatterFormData) {
  const {
    spatial,
    point_radius_fixed,
    dimension,
    js_columns,
    tooltip_contents,
  } = formData;

  if (!spatial) {
    throw new Error('Spatial configuration is required for Scatter charts');
  }

  return buildQueryContext(formData, {
    buildQuery: (baseQueryObject: QueryObject) => {
      const spatialColumns = getSpatialColumns(spatial);
      let columns = [...(baseQueryObject.columns || []), ...spatialColumns];

      if (dimension) {
        columns.push(dimension);
      }

      const columnStrings = columns.map(col =>
        typeof col === 'string' ? col : col.label || col.sqlExpression || '',
      );
      const withJsColumns = addJsColumnsToColumns(columnStrings, js_columns);

      columns = withJsColumns as QueryFormColumn[];
      columns = addTooltipColumnsToQuery(columns, tooltip_contents);

      // Only add metric if point_radius_fixed is a metric type
      const isMetric = isMetricValue(point_radius_fixed);
      // Extract metric value, handling both legacy string format and object format
      let metricValue: QueryFormMetric | null = null;
      if (isMetric) {
        if (typeof point_radius_fixed === 'string') {
          // Legacy string format: treat the string itself as the metric
          metricValue = point_radius_fixed;
        } else if (
          point_radius_fixed?.value !== undefined &&
          typeof point_radius_fixed.value !== 'number'
        ) {
          // Metric object format: use the metric value (string or adhoc metric object)
          metricValue = point_radius_fixed.value as QueryFormMetric;
        }
      }

      // Preserve existing metrics and only add radius metric if it's metric-based
      const existingMetrics = baseQueryObject.metrics || [];
      // Deduplicate metrics using getMetricLabel for comparison
      const existingLabels = new Set(
        existingMetrics.map(m => getMetricLabel(m)),
      );
      const metrics: QueryFormMetric[] =
        metricValue && !existingLabels.has(getMetricLabel(metricValue))
          ? [...existingMetrics, metricValue]
          : [...existingMetrics];

      const filters = addSpatialNullFilters(
        spatial,
        ensureIsArray(baseQueryObject.filters || []),
      );

      // orderby needs string label, not the full metric object
      const orderby =
        isMetric && metricValue
          ? ([[getMetricLabel(metricValue), false]] as QueryFormOrderBy[])
          : (baseQueryObject.orderby as QueryFormOrderBy[]) || [];

      return [
        {
          ...baseQueryObject,
          columns,
          metrics,
          filters,
          orderby,
          is_timeseries: false,
          row_limit: baseQueryObject.row_limit,
        },
      ];
    },
  });
}
