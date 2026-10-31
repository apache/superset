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
import type {
  ExtraJson,
  QueryCostWarning,
  QueryCostWarningMetric,
} from './types';

export const queryCostWarningMetrics = {
  bytes_processed: {
    thresholdLabel: () => t('Warning threshold (bytes processed)'),
    settingsExplanation: () =>
      t(
        'Estimated usage, not a guaranteed bill. 1 MB = 1,000,000 bytes; 1 GB = 1,000,000,000 bytes.',
      ),
    usesByteUnits: true,
  },
  total_cost: {
    thresholdLabel: () => t('Warning threshold (planner cost)'),
    settingsExplanation: () =>
      t('Planner cost is relative, not dollars or memory.'),
    usesByteUnits: false,
  },
};

/** Recognize only explicitly defined native metrics, including for API responses. */
export function isQueryCostWarningMetric(
  metric: unknown,
): metric is QueryCostWarningMetric {
  return (
    typeof metric === 'string' &&
    Object.prototype.hasOwnProperty.call(queryCostWarningMetrics, metric)
  );
}

/** Bound numeric settings for browser editing; database estimates have no such cap. */
export function isQueryCostWarningThreshold(
  value: unknown,
  metric: QueryCostWarningMetric,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER &&
    (!queryCostWarningMetrics[metric].usesByteUnits || Number.isInteger(value))
  );
}

export const costWarningUnits = { Bytes: 1, MB: 1000000, GB: 1000000000 };
export type CostWarningUnit = keyof typeof costWarningUnits;

/** Prefer an exact large display unit when reopening a saved byte threshold. */
export function getCostWarningUnit(threshold: unknown): CostWarningUnit {
  if (typeof threshold !== 'number' || !Number.isSafeInteger(threshold)) {
    return 'Bytes';
  }
  if (threshold >= 1e9 && threshold % 1e9 === 0) return 'GB';
  if (threshold >= 1e6 && threshold % 1e6 === 0) return 'MB';
  return 'Bytes';
}

/** Display whole bytes in decimal units without losing a byte to float rounding. */
export function formatWarningBytes(
  bytes: number,
  unit: CostWarningUnit,
): string {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return String(bytes);
  const places = unit === 'GB' ? 9 : unit === 'MB' ? 6 : 0;
  if (!places) return String(bytes);
  const digits = String(bytes).padStart(places + 1, '0');
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(
    /\.?0+$/,
    '',
  );
}

/** Convert a decimal input to exact whole bytes, never rounding an entered amount. */
export function parseWarningBytes(
  amount: string,
  unit: CostWarningUnit,
): number | undefined {
  const match = /^\+?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(amount.trim());
  if (!match) return undefined;
  const fraction = match[2] || '';
  const digits = `${match[1]}${fraction}`.replace(/^0+/, '');
  if (!digits) return undefined;
  const significant = digits.replace(/0+$/, '');
  const places = unit === 'GB' ? 9 : unit === 'MB' ? 6 : 0;
  const shift =
    places +
    Number(match[3] || 0) -
    fraction.length +
    digits.length -
    significant.length;
  if (shift < 0 || significant.length + shift > 16) return undefined;
  const bytes = Number(significant + '0'.repeat(shift));
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : undefined;
}

/** Mirror saved-rule validation so disabled values and engine changes stay editable. */
export function getQueryCostWarningError(
  rule: Record<string, unknown>,
  metric: QueryCostWarningMetric | null | undefined,
  supported = isQueryCostWarningMetric(metric),
): string | undefined {
  if (supported && metric == null) {
    return typeof rule.enabled === 'boolean'
      ? undefined
      : t(
          'Saved warning settings are invalid. Turn warnings off to clear invalid fields.',
        );
  }
  if (
    typeof rule.enabled !== 'boolean' ||
    ('metric' in rule && typeof rule.metric !== 'string')
  ) {
    return t(
      'Saved warning settings are invalid. Turn warnings off to clear invalid fields.',
    );
  }
  if (
    'threshold' in rule &&
    (typeof rule.threshold !== 'number' ||
      !Number.isFinite(rule.threshold) ||
      rule.threshold <= 0)
  ) {
    return t('Enter a positive, finite warning threshold.');
  }
  if (
    typeof rule.threshold === 'number' &&
    rule.threshold > Number.MAX_SAFE_INTEGER
  ) {
    return t(
      'Enter a warning threshold no greater than 9,007,199,254,740,991.',
    );
  }
  if (
    isQueryCostWarningMetric(rule.metric) &&
    queryCostWarningMetrics[rule.metric].usesByteUnits &&
    'threshold' in rule &&
    !isQueryCostWarningThreshold(rule.threshold, rule.metric)
  ) {
    return t('Enter whole bytes, no greater than 9,007,199,254,740,991.');
  }
  if (rule.enabled) {
    if (
      !supported ||
      !isQueryCostWarningMetric(metric) ||
      rule.metric !== metric
    ) {
      return t(
        'The saved warning metric is not supported by this engine. Turn warnings off or enter a new threshold.',
      );
    }
    if (!('threshold' in rule)) return t('Enter a warning threshold.');
  }
  return undefined;
}

/** Read the connection's warning rule without implicit opt-in. */
export function getQueryCostWarning(extra: ExtraJson): Record<string, unknown> {
  if ('query_cost_warning' in extra) {
    const rule: unknown = extra.query_cost_warning;
    return rule && typeof rule === 'object' && !Array.isArray(rule)
      ? { ...(rule as Record<string, unknown>) }
      : {};
  }
  return { enabled: false };
}

/** Disable warnings while retaining only usable saved metric and threshold values. */
export function disableQueryCostWarning(
  rule: Record<string, unknown>,
): QueryCostWarning {
  const metric = isQueryCostWarningMetric(rule.metric)
    ? rule.metric
    : undefined;
  const threshold =
    typeof rule.threshold === 'number' &&
    Number.isFinite(rule.threshold) &&
    rule.threshold > 0 &&
    rule.threshold <= Number.MAX_SAFE_INTEGER &&
    (!metric || isQueryCostWarningThreshold(rule.threshold, metric))
      ? rule.threshold
      : undefined;
  return {
    enabled: false,
    ...(metric && { metric }),
    ...(threshold !== undefined && { threshold }),
  };
}
