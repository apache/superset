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

import { t } from '@apache-superset/core/translation';

/**
 * A "result aggregation" is a second aggregation pass over a metric's own
 * grouped results (e.g. the median of a set of per-store SUM(sales) values),
 * distinct from -- and independent of -- the metric's own SQL aggregate. This
 * is the pre-SIP-216 "Aggregation function" control's actual job: it never
 * touched leaf cells (those were always the metric's own aggregate), only
 * how subtotals/totals summarized the leaf cells beneath them. SIP-216
 * removed the control because that summarization was computed by re-folding
 * already-displayed cell values client-side, which is wrong for non-additive
 * reducers (see SIP.md). This module restores the same choice, computed
 * correctly: every scope (cell, subtotal, grand total) is reduced from its
 * own original contributing query results, never from another scope's
 * already-computed output.
 */
export const RESULT_AGGREGATIONS = [
  'Count',
  'Count Unique Values',
  'List Unique Values',
  'Sum',
  'Average',
  'Median',
  'Sample Variance',
  'Sample Standard Deviation',
  'Minimum',
  'Maximum',
  'First',
  'Last',
  'Sum as Fraction of Total',
  'Sum as Fraction of Rows',
  'Sum as Fraction of Columns',
  'Count as Fraction of Total',
  'Count as Fraction of Rows',
  'Count as Fraction of Columns',
] as const;

export type ResultAggregation = (typeof RESULT_AGGREGATIONS)[number];

/**
 * Absence, an unrecognized value, or the explicit `'Metric'` choice all mean
 * the same thing: keep today's database-computed, metric-definition totals.
 */
export function getResultAggregation(
  value: unknown,
): ResultAggregation | undefined {
  return RESULT_AGGREGATIONS.find(name => name === value);
}

const FRACTION_RESULT_AGGREGATIONS = new Set<ResultAggregation>([
  'Sum as Fraction of Total',
  'Sum as Fraction of Rows',
  'Sum as Fraction of Columns',
  'Count as Fraction of Total',
  'Count as Fraction of Rows',
  'Count as Fraction of Columns',
]);

/**
 * True for the six "... as Fraction of ..." choices, which compute their own
 * ratio and always render as a percentage -- a per-metric custom formatter
 * (currency, decimals, etc.) doesn't apply to a ratio, unlike the other
 * `RESULT_AGGREGATIONS` (Median, Sum, ...), which re-aggregate a metric's own
 * values and should keep that metric's configured format.
 */
export function isFractionResultAggregation(
  value: ResultAggregation | undefined,
): boolean {
  return value !== undefined && FRACTION_RESULT_AGGREGATIONS.has(value);
}

/**
 * Display label for each `RESULT_AGGREGATIONS` choice. `RESULT_AGGREGATIONS`
 * values double as lookup keys (into `aggregators` in utilities.ts and as the
 * stored `aggregateFunction` control value), so they must stay literal
 * English strings; a `t(name)` over a loop variable can't be picked up by
 * babel's static extraction, so this maps each one through its own literal
 * `t('...')` call instead.
 */
export const RESULT_AGGREGATION_LABELS: Record<ResultAggregation, string> = {
  Count: t('Count'),
  'Count Unique Values': t('Count Unique Values'),
  'List Unique Values': t('List Unique Values'),
  Sum: t('Sum'),
  Average: t('Average'),
  Median: t('Median'),
  'Sample Variance': t('Sample Variance'),
  'Sample Standard Deviation': t('Sample Standard Deviation'),
  Minimum: t('Minimum'),
  Maximum: t('Maximum'),
  First: t('First'),
  Last: t('Last'),
  'Sum as Fraction of Total': t('Sum as Fraction of Total'),
  'Sum as Fraction of Rows': t('Sum as Fraction of Rows'),
  'Sum as Fraction of Columns': t('Sum as Fraction of Columns'),
  'Count as Fraction of Total': t('Count as Fraction of Total'),
  'Count as Fraction of Rows': t('Count as Fraction of Rows'),
  'Count as Fraction of Columns': t('Count as Fraction of Columns'),
};
