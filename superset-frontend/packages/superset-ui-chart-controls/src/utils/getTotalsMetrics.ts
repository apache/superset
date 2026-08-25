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
import { isAdhocMetricSimple, QueryFormMetric } from '@superset-ui/core';

export type TotalsAggregate = 'SUM' | 'AVG';

/**
 * Build the metrics for a chart's "Show summary" totals query, overriding
 * each Simple (adhoc) metric's aggregate function with the user-chosen
 * totals aggregate. The totals query has no GROUP BY, so the database
 * evaluates each metric fresh over all rows -- swapping the aggregate here
 * is a correct, independent computation, not a re-aggregation of
 * already-aggregated per-row values.
 *
 * Custom-SQL metrics and saved (string) metrics pass through unchanged:
 * there is no safe way to rewrite an arbitrary SQL expression's aggregate
 * function without parsing it, so the totals row keeps their own native
 * aggregate for those.
 */
export function getTotalsMetrics(
  metrics: QueryFormMetric[],
  aggregate: TotalsAggregate,
): QueryFormMetric[] {
  return metrics.map(metric =>
    isAdhocMetricSimple(metric) ? { ...metric, aggregate } : metric,
  );
}
