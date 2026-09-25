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

/** Saved result aggregations are independent of the SQL metric definition. */
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

/** Absence (or the explicit metric choice) retains database-computed totals. */
export function getResultAggregation(
  value: unknown,
): ResultAggregation | undefined {
  return RESULT_AGGREGATIONS.find(name => name === value);
}
