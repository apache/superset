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

/**
 * How the "Show summary" totals row aggregates each metric.
 *
 * ``ORIGINAL`` keeps every metric's own aggregation. It is the default because
 * overriding is not universally valid: ``SUM`` over a ``COUNT_DISTINCT`` of a
 * non-numeric column (a uuid, say) is rejected outright by the database, and
 * over a numeric id column it silently produces a meaningless number.
 */
export type TotalsAggregate = 'ORIGINAL' | 'SUM' | 'AVG';

/**
 * Build the metrics for a chart's "Show summary" totals query.
 *
 * With SUM or AVG, each Simple (adhoc) metric is cloned with its aggregate
 * replaced. The totals query has no GROUP BY, so the database evaluates each
 * metric fresh over all rows -- that swap is an independent computation, not a
 * re-aggregation of already-aggregated per-row values.
 *
 * Custom-SQL and saved (string) metrics always pass through unchanged: there is
 * no safe way to rewrite an arbitrary SQL expression's aggregate without
 * parsing it, so the totals row keeps their own native aggregate.
 */
export function getTotalsMetrics(
  metrics: QueryFormMetric[],
  aggregate: TotalsAggregate,
): QueryFormMetric[] {
  if (aggregate === 'ORIGINAL') {
    return metrics;
  }
  return metrics.map(metric =>
    isAdhocMetricSimple(metric) ? { ...metric, aggregate } : metric,
  );
}

/**
 * Narrow a raw ``totals_aggregate`` form-data value to a TotalsAggregate.
 *
 * Anything other than an explicit SUM/AVG — including charts saved before the
 * control existed — keeps each metric's own aggregation.
 */
export function toTotalsAggregate(value: unknown): TotalsAggregate {
  return value === 'SUM' || value === 'AVG' ? value : 'ORIGINAL';
}
