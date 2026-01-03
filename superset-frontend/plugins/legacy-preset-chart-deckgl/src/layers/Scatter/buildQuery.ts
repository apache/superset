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
  processMetricsArray,
  addTooltipColumnsToQuery,
} from '../buildQueryUtils';
import { isMetricValue, extractMetricKey } from '../utils/metricUtils';

export interface DeckScatterFormData
  extends Omit<SpatialFormData, 'color_picker'>, SqlaFormData {
  point_radius_fixed?: {
    type?: 'fix' | 'metric';
    value?: string | number;
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
      const metricValue = isMetric ? extractMetricKey(point_radius_fixed?.value) : null;

      // Preserve existing metrics and only add radius metric if it's metric-based
      const existingMetrics = baseQueryObject.metrics || [];
      const radiusMetrics = processMetricsArray(
        metricValue ? [metricValue] : [],
      );
      // Deduplicate metrics to avoid adding the same metric twice
      const metricsSet = new Set([...existingMetrics, ...radiusMetrics]);
      const metrics = Array.from(metricsSet);
      const filters = addSpatialNullFilters(
        spatial,
        ensureIsArray(baseQueryObject.filters || []),
      );

      const orderby =
        isMetric && metricValue
          ? ([[metricValue, false]] as QueryFormOrderBy[])
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
