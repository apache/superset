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
  getColumnLabel,
  normalizeOrderBy,
  QueryFormColumn,
  QueryFormData,
} from '@superset-ui/core';
import { addTooltipColumnsToQuery } from '../buildQueryUtils';

export interface H3FormData extends QueryFormData {
  h3_index: QueryFormColumn | QueryFormColumn[];
  metric?: string;
  js_columns?: string[];
  tooltip_contents?: unknown[];
}

export default function buildQuery(formData: H3FormData) {
  const {
    h3_index: h3IndexRaw,
    metric,
    js_columns: jsColumns,
    tooltip_contents: tooltipContents,
  } = formData;

  const h3Index: QueryFormColumn | undefined = Array.isArray(h3IndexRaw)
    ? h3IndexRaw[0]
    : h3IndexRaw;

  if (!h3Index) {
    throw new Error('H3 index is required');
  }

  const h3IndexLabel = getColumnLabel(h3Index);

  return buildQueryContext(formData, {
    buildQuery: baseQueryObject => {
      let columns: QueryFormColumn[] = [h3Index];
      const metrics = metric ? [metric] : [];

      if (jsColumns?.length) {
        const existingLabels = new Set(columns.map(getColumnLabel));
        jsColumns.forEach((col: string) => {
          if (!existingLabels.has(col)) {
            columns.push(col);
            existingLabels.add(col);
          }
        });
      }

      columns = addTooltipColumnsToQuery(columns, tooltipContents);

      const filters = ensureIsArray(baseQueryObject.filters || []);
      filters.push({
        col: h3IndexLabel,
        op: 'IS NOT NULL',
      });

      const orderby = metric
        ? normalizeOrderBy({ orderby: [[metric, false]] }).orderby
        : baseQueryObject.orderby;

      return [
        {
          ...baseQueryObject,
          columns,
          metrics,
          filters,
          orderby,
          is_timeseries: false,
        },
      ];
    },
  });
}
