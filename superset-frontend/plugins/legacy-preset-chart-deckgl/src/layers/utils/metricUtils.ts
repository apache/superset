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

import { getMetricLabel } from '@superset-ui/core';

export type MetricFormValue =
  | string
  | number
  | { label?: string; sqlExpression?: string; value?: string }
  | undefined
  | null;

export interface FixedOrMetricValue {
  type?: 'fix' | 'metric';
  value?: MetricFormValue;
}

/**
 * Checks if a value is configured as a metric (vs fixed value)
 */
export function isMetricValue(
  fixedOrMetric: string | FixedOrMetricValue | undefined | null,
): boolean {
  if (!fixedOrMetric) return false;
  if (typeof fixedOrMetric === 'string') return true;
  return fixedOrMetric.type === 'metric';
}

/**
 * Checks if a value is configured as a fixed value (vs metric)
 */
export function isFixedValue(
  fixedOrMetric: string | FixedOrMetricValue | undefined | null,
): boolean {
  if (!fixedOrMetric) return false;
  if (typeof fixedOrMetric === 'string') return false;
  return fixedOrMetric.type === 'fix';
}

/**
 * Extracts the metric key from a metric value object
 * Handles label, sqlExpression, and value properties
 */
export function extractMetricKey(value: MetricFormValue): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);

  // Handle object metrics (adhoc or saved metrics)
  const metricObj = value as {
    label?: string;
    sqlExpression?: string;
    value?: string;
  };
  return metricObj.label || metricObj.sqlExpression || metricObj.value;
}

/**
 * Gets the metric label from a fixed/metric form value
 * Returns undefined for fixed values, metric label for metric values
 */
export function getMetricLabelFromValue(
  fixedOrMetric: string | FixedOrMetricValue | undefined | null,
): string | undefined {
  if (!fixedOrMetric) return undefined;

  // Legacy string format - treat as metric
  if (typeof fixedOrMetric === 'string') {
    return getMetricLabel(fixedOrMetric);
  }

  // Only return metric label if it's a metric type, not a fixed value
  if (isMetricValue(fixedOrMetric) && fixedOrMetric.value) {
    const metricKey = extractMetricKey(fixedOrMetric.value);
    if (metricKey && typeof metricKey === 'string') {
      return getMetricLabel(metricKey);
    }
  }

  return undefined;
}

/**
 * Gets the fixed value from a fixed/metric form value
 * Returns the value for fixed types, undefined for metrics
 */
export function getFixedValue(
  fixedOrMetric: string | FixedOrMetricValue | undefined | null,
): string | number | undefined {
  if (!fixedOrMetric || typeof fixedOrMetric === 'string') {
    return undefined;
  }

  if (isFixedValue(fixedOrMetric) && fixedOrMetric.value) {
    if (
      typeof fixedOrMetric.value === 'string' ||
      typeof fixedOrMetric.value === 'number'
    ) {
      return fixedOrMetric.value;
    }
  }

  return undefined;
}
