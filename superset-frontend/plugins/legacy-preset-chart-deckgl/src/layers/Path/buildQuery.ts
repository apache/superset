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
} from '@superset-ui/core';

export interface DeckPathFormData extends SqlaFormData {
  line_column?: string;
  line_type?: 'polyline' | 'json' | 'geohash';
  metric?: string;
  reverse_long_lat?: boolean;
  js_columns?: string[];
}

export default function buildQuery(formData: DeckPathFormData) {
  const { line_column, metric, js_columns } = formData;

  if (!line_column) {
    throw new Error('Line column is required for Path charts');
  }

  return buildQueryContext(formData, baseQueryObject => {
    const columns = ensureIsArray(baseQueryObject.columns || []);
    const metrics = ensureIsArray(baseQueryObject.metrics || []);
    const groupby = ensureIsArray(baseQueryObject.groupby || []);

    // Add js_columns to ensure they're available for JavaScript functions
    const jsColumns = ensureIsArray(js_columns || []);

    // Logic from DeckPathViz.query_obj():
    // If there are metrics, add line_column to groupby
    // Otherwise, add line_column to columns
    if (baseQueryObject.metrics?.length || metric) {
      // Add metric if specified
      if (metric && !metrics.includes(metric)) {
        metrics.push(metric);
      }
      // Add line column to groupby when we have metrics
      if (!groupby.includes(line_column)) {
        groupby.push(line_column);
      }
    } else if (!columns.includes(line_column)) {
      // Add line column to columns when no metrics
      columns.push(line_column);
    }

    // Add js_columns to columns for JavaScript functions
    jsColumns.forEach(col => {
      if (!columns.includes(col) && !groupby.includes(col)) {
        columns.push(col);
      }
    });

    // Add NOT NULL filter for line column to avoid rendering issues
    const filters = ensureIsArray(baseQueryObject.filters || []);
    const hasLineColumnFilter = filters.some(
      filter => filter.col === line_column && filter.op === 'IS NOT NULL',
    );
    if (!hasLineColumnFilter) {
      filters.push({
        col: line_column,
        op: 'IS NOT NULL' as const,
      });
    }

    // Path charts support time series
    const isTimeseries = Boolean(formData.time_grain_sqla);

    return [
      {
        ...baseQueryObject,
        columns,
        metrics,
        groupby,
        filters,
        is_timeseries: isTimeseries,
        row_limit: baseQueryObject.row_limit,
      },
    ];
  });
}
