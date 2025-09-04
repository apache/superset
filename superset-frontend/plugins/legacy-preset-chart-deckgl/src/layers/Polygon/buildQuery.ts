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
  SqlaFormData,
  getMetricLabel,
  QueryObjectFilterClause,
} from '@superset-ui/core';

export interface DeckPolygonFormData extends SqlaFormData {
  line_column?: string;
  line_type?: string;
  metric?: string;
  point_radius_fixed?: {
    value?: string;
  };
  reverse_long_lat?: boolean;
  filter_nulls?: boolean;
  js_columns?: string[];
}

export default function buildQuery(formData: DeckPolygonFormData) {
  const {
    line_column,
    metric,
    point_radius_fixed,
    filter_nulls = true,
    js_columns,
  } = formData;

  if (!line_column) {
    throw new Error('Polygon column is required for Polygon charts');
  }

  return buildQueryContext(formData, baseQueryObject => {
    const columns = [...(baseQueryObject.columns || []), line_column];

    // Add js_columns to ensure they're available for JavaScript functions
    const jsColumns = ensureIsArray(js_columns || []);
    jsColumns.forEach(col => {
      if (!columns.includes(col)) {
        columns.push(col);
      }
    });

    const metrics = [];
    if (metric) {
      metrics.push(metric);
    }
    if (point_radius_fixed?.value) {
      metrics.push(point_radius_fixed.value);
    }

    // Add null filters for required columns
    const filters = ensureIsArray(baseQueryObject.filters || []);
    if (filter_nulls) {
      const nullFilters: QueryObjectFilterClause[] = [
        {
          col: line_column,
          op: 'IS NOT NULL',
        },
      ];

      if (metric) {
        nullFilters.push({
          col: getMetricLabel(metric),
          op: 'IS NOT NULL',
        });
      }

      filters.push(...nullFilters);
    }

    return [
      {
        ...baseQueryObject,
        columns,
        metrics,
        filters,
        is_timeseries: false,
        row_limit: baseQueryObject.row_limit,
      },
    ];
  });
}
