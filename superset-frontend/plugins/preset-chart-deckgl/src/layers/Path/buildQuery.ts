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
  QueryFormColumn,
} from '@superset-ui/core';
import { addNullFilters, addTooltipColumnsToQuery } from '../buildQueryUtils';

export interface DeckPathFormData extends SqlaFormData {
  line_column?: string;
  line_type?: 'polyline' | 'json' | 'geohash';
  metric?: string;
  reverse_long_lat?: boolean;
  js_columns?: string[];
  tooltip_contents?: unknown[];
  tooltip_template?: string;
}

export default function buildQuery(formData: DeckPathFormData) {
  const { line_column, metric, js_columns, tooltip_contents } = formData;

  if (!line_column) {
    throw new Error('Line column is required for Path charts');
  }

  return buildQueryContext(formData, {
    buildQuery: baseQueryObject => {
      const columns = ensureIsArray(
        baseQueryObject.columns || [],
      ) as QueryFormColumn[];
      const metrics = ensureIsArray(baseQueryObject.metrics || []);
      const groupby = ensureIsArray(
        baseQueryObject.groupby || [],
      ) as QueryFormColumn[];
      const jsColumns = ensureIsArray(js_columns || []);

      if (baseQueryObject.metrics?.length || metric) {
        if (metric && !metrics.includes(metric)) {
          metrics.push(metric);
        }
        if (!groupby.includes(line_column)) {
          groupby.push(line_column);
        }
      } else if (!columns.includes(line_column)) {
        columns.push(line_column);
      }

      jsColumns.forEach(col => {
        if (!columns.includes(col) && !groupby.includes(col)) {
          columns.push(col);
        }
      });

      const finalColumns = addTooltipColumnsToQuery(columns, tooltip_contents);
      const finalGroupby = addTooltipColumnsToQuery(groupby, tooltip_contents);

      const filters = addNullFilters(
        ensureIsArray(baseQueryObject.filters || []),
        [line_column],
      );

      const isTimeseries = Boolean(formData.time_grain_sqla);

      return [
        {
          ...baseQueryObject,
          columns: finalColumns,
          metrics,
          groupby: finalGroupby,
          filters,
          is_timeseries: isTimeseries,
          row_limit: baseQueryObject.row_limit,
        },
      ];
    },
  });
}
