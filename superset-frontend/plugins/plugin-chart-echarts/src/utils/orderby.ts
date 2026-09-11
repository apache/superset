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
import { QueryFormColumn, QueryFormOrderBy } from '@superset-ui/core';

/**
 * Builds orderby clauses from a list of columns, filtering out any non-string
 * or nullish values. This ensures deterministic row ordering so that chart
 * elements maintain stable positions across auto-refreshes.
 */
export function buildColumnsOrderBy(
  columns: (QueryFormColumn | string | undefined | null)[],
  ascending: boolean = true,
): QueryFormOrderBy[] {
  return columns
    .filter((col): col is string => typeof col === 'string' && col !== '')
    .map(col => [col, ascending]);
}

/**
 * Conditionally applies orderby to a query object spread. Returns the
 * orderby field only when row_limit is set (non-zero, non-null) and
 * there are orderby entries to apply.
 */
export function applyOrderBy(
  orderby: QueryFormOrderBy[],
  rowLimit: string | number | undefined | null,
): { orderby: QueryFormOrderBy[] } | Record<string, never> {
  const parsedRowLimit =
    typeof rowLimit === 'string' ? Number(rowLimit) : rowLimit;
  const shouldApply =
    rowLimit !== undefined &&
    rowLimit !== null &&
    (Number.isNaN(parsedRowLimit) || parsedRowLimit !== 0);
  return shouldApply && orderby.length > 0 ? { orderby } : {};
}
