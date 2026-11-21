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
  QueryFormMetric,
} from '@superset-ui/core';
import { addTooltipColumnsToQuery } from '../buildQueryUtils';

export interface H3FormData extends QueryFormData {
  h3_index: QueryFormColumn | QueryFormColumn[];
  metric?: QueryFormMetric;
  tooltip_contents?: unknown[];
}

/**
 * Returns the single H3 index column selected in the control, which may be
 * stored either as a bare column or as a one-element array.
 */
export function getH3IndexColumn(
  h3Index: H3FormData['h3_index'] | undefined,
): QueryFormColumn | undefined {
  return Array.isArray(h3Index) ? h3Index[0] : h3Index;
}

export default function buildQuery(formData: H3FormData) {
  const {
    h3_index: h3IndexRaw,
    metric,
    tooltip_contents: tooltipContents,
  } = formData;

  const h3Index = getH3IndexColumn(h3IndexRaw);

  if (!h3Index) {
    throw new Error('H3 index is required');
  }

  return buildQueryContext(formData, {
    buildQuery: baseQueryObject => {
      const columns = addTooltipColumnsToQuery([h3Index], tooltipContents);
      const metrics = metric ? [metric] : [];

      // Pass the column itself (not its label) so the filter also works for
      // ad-hoc SQL expressions, which are not physical dataset columns.
      const filters = [
        ...ensureIsArray(baseQueryObject.filters || []),
        { col: h3Index, op: 'IS NOT NULL' as const },
      ];

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
