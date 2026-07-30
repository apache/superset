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

import { SupersetClient } from '@superset-ui/core';
import { CdlQueryContext, Primitive } from './types';
import { QueryResult } from './resolve';
import { QueryRunner } from './runtime';

type AdhocMetric = {
  expressionType: 'SQL';
  sqlExpression: string;
  label: string;
  hasCustomLabel: boolean;
};

/**
 * A metric string is either a saved-metric name or a SQL aggregate expression
 * (e.g. `SUM(sales)`). The latter becomes an adhoc SQL metric so the demo works
 * whether the agent used a saved metric or an inline expression.
 */
function toMetric(metric: string): string | AdhocMetric {
  if (/[()]/.test(metric)) {
    return {
      expressionType: 'SQL',
      sqlExpression: metric,
      label: metric,
      hasCustomLabel: false,
    };
  }
  return metric;
}

function toQueryContext(qc: CdlQueryContext): Record<string, unknown> {
  return {
    datasource: { id: qc.datasetId, type: 'table' },
    force: false,
    queries: [
      {
        columns: qc.groupby ?? [],
        metrics: qc.metrics.map(toMetric),
        filters: (qc.filters ?? []).map(f => ({
          col: f.col,
          op: f.op,
          val: f.val,
        })),
        row_limit: qc.rowLimit ?? 1000,
        // query_context orderby is [[metric-or-column, isAscending], ...];
        // a metric must be the same shape as it appears in `metrics`.
        orderby: (qc.orderby ?? []).map(({ by, desc }) => [
          qc.metrics.includes(by) ? toMetric(by) : by,
          !desc,
        ]),
      },
    ],
    result_format: 'json',
    result_type: 'full',
  };
}

interface ChartDataPayload {
  result?: Array<{
    data?: Array<Record<string, Primitive>>;
    colnames?: string[];
    error?: string;
    status?: string;
  }>;
  message?: string;
}

/**
 * The real QueryRunner: bound queries go through the governed /api/v1/chart/data
 * endpoint, inheriting RLS, row limits, and caching. Used by the Canvas viewer.
 */
export function createSupersetQueryRunner(): QueryRunner {
  return {
    run: async (queryContext: CdlQueryContext): Promise<QueryResult> => {
      const { json } = await SupersetClient.post({
        endpoint: '/api/v1/chart/data',
        jsonPayload: toQueryContext(queryContext),
      });
      const payload = json as ChartDataPayload;
      const first = payload.result?.[0];
      // The endpoint returns HTTP 200 even when a query fails — the real
      // message is per-query, so surface it instead of showing "No data".
      // When the shape is unexpected (async job, error envelope, …) echo the
      // raw body so we can see exactly what came back.
      if (!first) {
        throw new Error(
          payload.message ??
            `unexpected response: ${JSON.stringify(json).slice(0, 400)}`,
        );
      }
      if (first.error || first.status === 'failed') {
        throw new Error(first.error ?? 'query failed');
      }
      const records = first.data ?? [];
      const columns =
        first.colnames ?? (records[0] ? Object.keys(records[0]) : []);
      return { columns, records };
    },
  };
}
