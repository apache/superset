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
import { ExtraJson, QueryCostWarning } from '../types';

/** Read the explicit rule or a valid BigQuery draft without implicit opt-in. */
export function getQueryCostWarning(
  extra: ExtraJson,
  engine?: string,
): Record<string, unknown> {
  if ('query_cost_warning' in extra) {
    const rule: unknown = extra.query_cost_warning;
    return rule && typeof rule === 'object' && !Array.isArray(rule)
      ? { ...(rule as Record<string, unknown>) }
      : {};
  }
  const threshold = extra.cost_estimate_warning_threshold_bytes;
  if (
    engine === 'bigquery' &&
    typeof threshold === 'number' &&
    Number.isSafeInteger(threshold) &&
    threshold > 0
  ) {
    return {
      enabled: extra.cost_estimate_warning_enabled === true,
      metric: 'bytes_processed',
      threshold,
    };
  }
  return { enabled: false };
}

/** Disable warnings while retaining only usable saved metric and threshold values. */
export function disableQueryCostWarning(
  rule: Record<string, unknown>,
): QueryCostWarning {
  const metric =
    rule.metric === 'bytes_processed' || rule.metric === 'total_cost'
      ? rule.metric
      : undefined;
  const threshold =
    typeof rule.threshold === 'number' &&
    Number.isFinite(rule.threshold) &&
    rule.threshold > 0 &&
    (metric !== 'bytes_processed' || Number.isSafeInteger(rule.threshold))
      ? rule.threshold
      : undefined;
  return {
    enabled: false,
    ...(metric && { metric }),
    ...(threshold !== undefined && { threshold }),
  };
}
