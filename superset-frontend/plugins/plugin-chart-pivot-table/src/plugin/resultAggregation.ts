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
