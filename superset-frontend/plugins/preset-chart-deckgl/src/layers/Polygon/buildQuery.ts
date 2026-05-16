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
  QueryObject,
  QueryFormColumn,
  QueryFormMetric,
} from '@superset-ui/core';
import { addTooltipColumnsToQuery } from '../buildQueryUtils';

export interface DeckPolygonFormData extends SqlaFormData {
  line_column?: string;
  line_type?: string;
  metric?: string;
  point_radius_fixed?:
    | {
        value?: string;
      }
    | {
        type: 'fix';
        value: string;
      }
    | {
        type: 'metric';
        value: QueryFormMetric;
      };
  reverse_long_lat?: boolean;
  filter_nulls?: boolean;
  js_columns?: string[];
  tooltip_contents?: unknown[];
  tooltip_template?: string;
}

export default function buildQuery(formData: DeckPolygonFormData) {
  const {
    line_column,
    metric,
    point_radius_fixed,
    filter_nulls = true,
    js_columns,
    tooltip_contents,
  } = formData;

  if (!line_column) {
    throw new Error('Polygon column is required for Polygon charts');
  }

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => {
    let columns: QueryFormColumn[] = [
      ...ensureIsArray(baseQueryObject.columns || []),
      line_column,
    ];

    const jsColumns = ensureIsArray(js_columns || []);
    jsColumns.forEach((col: string) => {
      if (!columns.includes(col)) {
        columns.push(col);
      }
    });

    columns = addTooltipColumnsToQuery(columns, tooltip_contents);

    const metrics = [];
    if (metric) {
      metrics.push(metric);
    }

    if (point_radius_fixed) {
      if ('type' in point_radius_fixed) {
        if (
          point_radius_fixed.type === 'metric' &&
          point_radius_fixed.value != null
        ) {
          metrics.push(point_radius_fixed.value);
        }
      }
    }

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
