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

import { buildQueryContext, SupersetClient } from '@superset-ui/core';
import type { QueryFormData } from '@superset-ui/core';
import type { DataRow } from './resolveBindings';

export interface DataBinding {
  datasetId: number;
  metrics: unknown[];
  dimensions?: string[];
  filters?: Record<string, unknown>[];
  rowLimit?: number;
  orderBy?: { field: string; descending?: boolean }[];
}

const metricLabel = (metric: unknown): string | undefined =>
  typeof metric === 'string'
    ? metric
    : typeof metric === 'object' && metric !== null
      ? ((metric as { label?: string }).label ?? undefined)
      : undefined;

// A sort key names a metric by its label or a dimension by its column; the
// query wants the metric itself.
function orderby(binding: DataBinding): [unknown, boolean][] {
  return (binding.orderBy ?? []).map(({ field, descending }) => [
    binding.metrics.find(metric => metricLabel(metric) === field) ?? field,
    !descending,
  ]);
}

/** The value a `filter.select` widget publishes to the widgets in its scope. */
export interface SelectFilterValue {
  datasetId: number;
  column: string;
  values: string[];
}

const isSelectFilterValue = (value: unknown): value is SelectFilterValue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SelectFilterValue).column === 'string' &&
  Array.isArray((value as SelectFilterValue).values);

/**
 * A binding narrowed by the filter values that reach its widget: each
 * `filter.select` on the same dataset adds an IN clause.
 */
export function withFilters(
  binding: DataBinding,
  filters: { value: unknown }[],
): DataBinding {
  const clauses = filters
    .map(filter => filter.value)
    .filter(isSelectFilterValue)
    .filter(
      value => value.datasetId === binding.datasetId && value.values.length,
    )
    .map(value => ({
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: value.column,
      operator: 'IN',
      comparator: value.values,
    }));
  if (!clauses.length) return binding;
  return { ...binding, filters: [...(binding.filters ?? []), ...clauses] };
}

/**
 * Rows for a widget's `dataBinding`, through the existing chart data API.
 * Stands in for SIP-231's widget data route until it exists.
 */
export async function fetchRows(binding: DataBinding): Promise<DataRow[]> {
  const formData = {
    datasource: `${binding.datasetId}__table`,
    viz_type: 'table',
    metrics: binding.metrics.filter(metric => metric != null && metric !== ''),
    groupby: (binding.dimensions ?? []).filter(Boolean),
    adhoc_filters: binding.filters ?? [],
    row_limit: binding.rowLimit ?? 1000,
    result_format: 'json',
    result_type: 'full',
  } as unknown as QueryFormData;
  const { json } = await SupersetClient.post({
    endpoint: '/api/v1/chart/data',
    jsonPayload: buildQueryContext(formData, baseQueryObject => [
      { ...baseQueryObject, orderby: orderby(binding) as never },
    ]),
  });
  const result = json?.result?.[0];
  if (!result || result.error) {
    throw new Error(result?.error ?? 'The data request returned no result');
  }
  return result.data ?? [];
}
