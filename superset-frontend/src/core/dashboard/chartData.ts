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
import type { dashboard as dashboardApi } from '@apache-superset/core';

type DataBindingSpec = dashboardApi.DataBindingSpec;
type DataRow = dashboardApi.DataRow;
type QueryDataResult = dashboardApi.QueryDataResult;

interface ChartDataResponseResult {
  data?: DataRow[];
  colnames?: string[];
  error?: string | null;
}

// SupersetClient rejects a non-2xx response with the raw, unparsed Response
// object rather than an Error (see parseResponse.ts) — left as-is, a caller
// doing `String(e)` on that gets the useless "[object Response]". This pulls
// the actual `{message}`/`{errors: [...]}` body Superset's API sends back.
async function describeFetchError(e: unknown): Promise<string> {
  if (typeof Response !== 'undefined' && e instanceof Response) {
    try {
      const body = await e.clone().json();
      const detail =
        body?.message ??
        (Array.isArray(body?.errors)
          ? body.errors
              .map((err: { message?: string }) => err.message)
              .join('; ')
          : undefined);
      return detail
        ? `${e.status} ${e.statusText}: ${detail}`
        : `${e.status} ${e.statusText}`;
    } catch {
      return `${e.status} ${e.statusText}`;
    }
  }
  return e instanceof Error ? e.message : String(e);
}

export async function fetchQueryData(
  binding: DataBindingSpec,
): Promise<QueryDataResult> {
  const formData = {
    datasource: `${binding.datasetId}__table`,
    // Drop empty/blank inputs the schema-driven control panel can seed (an
    // empty array item — a blank dimension string, or an empty `{}` filter
    // object) before they reach `buildQueryContext`, which throws on a
    // malformed adhoc filter (e.g. `{}`) rather than ignoring it.
    metrics: (binding.metrics ?? []).filter(
      metric => metric != null && metric !== '',
    ),
    groupby: (binding.dimensions ?? []).filter(
      dimension => typeof dimension === 'string' && dimension !== '',
    ),
    adhoc_filters: (binding.filters ?? []).filter(
      filter =>
        filter != null &&
        typeof filter === 'object' &&
        Object.keys(filter).length > 0,
    ),
    row_limit: binding.rowLimit ?? 1000,
    result_format: 'json',
    result_type: 'full',
  } as unknown as QueryFormData;

  const queryContext = buildQueryContext(formData);

  let json: { result?: ChartDataResponseResult[] } | undefined;
  try {
    ({ json } = await SupersetClient.post({
      endpoint: '/api/v1/chart/data',
      jsonPayload: queryContext,
    }));
  } catch (e) {
    throw new Error(await describeFetchError(e));
  }

  const result = json?.result?.[0];
  if (!result || result.error) {
    throw new Error(result?.error ?? 'Chart data request returned no result');
  }

  return { columns: result.colnames ?? [], rows: result.data ?? [] };
}
