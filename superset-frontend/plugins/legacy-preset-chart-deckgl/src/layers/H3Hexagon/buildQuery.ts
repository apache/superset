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
  normalizeOrderBy,
  QueryFormColumn,
  QueryFormData,
} from '@superset-ui/core';
import { addTooltipColumnsToQuery } from '../buildQueryUtils';

export interface H3FormData extends QueryFormData {
  h3_index: string | string[];
  metric?: string;
  js_columns?: string[];
  tooltip_contents?: unknown[];
}

export default function buildQuery(formData: H3FormData) {
  let { h3_index: h3Index } = formData;
  const {
    metric,
    js_columns: jsColumns,
    tooltip_contents: tooltipContents,
  } = formData;

  if (Array.isArray(h3Index)) {
    h3Index = h3Index[0];
  }

  if (!h3Index) {
    throw new Error('H3 index is required');
  }

  return buildQueryContext(formData, {
    buildQuery: baseQueryObject => {
      let columns: QueryFormColumn[] = [h3Index];
      const metrics = metric ? [metric] : [];

      if (jsColumns?.length) {
        jsColumns.forEach((col: string) => {
          if (!columns.includes(col)) {
            columns.push(col);
          }
        });
      }

      columns = addTooltipColumnsToQuery(columns, tooltipContents);

      const filters = ensureIsArray(baseQueryObject.filters || []);
      filters.push({
        col: h3Index,
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
