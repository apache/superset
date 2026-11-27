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
import { getMetricLabel, QueryFormMetric } from '@superset-ui/core';
import { CustomControlItem, sharedControls } from '@superset-ui/chart-controls';

/**
 * An optional, clearable single-metric picker whose result drives a chart
 * bound (axis min/max, target, marker line) instead of a typed number.
 */
export const boundMetricControl = (
  name: string,
  label: string,
  description: string,
): CustomControlItem => ({
  name,
  config: {
    ...sharedControls.metric,
    label,
    description,
    clearable: true,
    default: null,
    validators: [],
  },
});

/** The finite numeric value of a metric in a result row, if any. */
export function getMetricValue(
  row: Record<string, unknown> | undefined,
  metric: QueryFormMetric | null | undefined,
): number | undefined {
  if (!row || !metric) return undefined;
  const raw = row[getMetricLabel(metric)];
  if (raw === null || raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export const isValidNumber = (
  val: number | null | undefined | string,
): val is number => {
  if (val == null || val === '') return false;
  const num = typeof val === 'string' ? Number(val) : val;
  return !Number.isNaN(num) && Number.isFinite(num);
};

/**
 * Resolve a bound with the precedence: value from a metric, then the typed
 * value, then the chart's automatic default.
 */
export function resolveBound({
  fromMetric,
  fixed,
  fallback,
}: {
  fromMetric?: number;
  fixed?: number | string | null;
  fallback: () => number;
}): number {
  if (fromMetric !== undefined && Number.isFinite(fromMetric)) {
    return fromMetric;
  }
  if (isValidNumber(fixed)) return Number(fixed);
  return fallback();
}
