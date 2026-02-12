/*
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

import { QueryFormMetric, isSavedMetric, isAdhocMetricSimple } from './types';

export default function getMetricLabel(metric: QueryFormMetric): string {
  if (isSavedMetric(metric)) {
    return metric;
  }
  if (metric.label) {
    return metric.label;
  }
  if (isAdhocMetricSimple(metric)) {
    return `${metric.aggregate}(${
      metric.column.columnName || metric.column.column_name
    })`;
  }
  return metric.sqlExpression;
}

/**
 * Get localized label for a metric.
 * If locale is provided, attempts to find a translation in metric.translations.
 * Falls back to the original label if no translation is found.
 *
 * @param metric - The metric object (adhoc or saved)
 * @param locale - The user's locale (e.g., 'de', 'ru')
 * @returns The localized label if available, otherwise the original label
 */
export function getLocalizedMetricLabel(
  metric: QueryFormMetric,
  locale?: string,
): string {
  const originalLabel = getMetricLabel(metric);

  // Saved metrics (strings) don't have translations
  if (isSavedMetric(metric)) {
    return originalLabel;
  }

  // If no locale or no translations, return original
  if (!locale || !metric.translations?.label) {
    return originalLabel;
  }

  // Try exact locale match (e.g., "de-DE")
  if (metric.translations.label[locale]) {
    return metric.translations.label[locale];
  }

  // Try base language (e.g., "de" from "de-DE")
  const baseLang = locale.split('-')[0];
  if (baseLang !== locale && metric.translations.label[baseLang]) {
    return metric.translations.label[baseLang];
  }

  return originalLabel;
}

/**
 * Build a map from original metric labels to localized labels.
 * Useful for chart plugins to localize series names, legend, tooltips.
 *
 * @param metrics - Array of metrics from formData
 * @param locale - The user's locale
 * @returns Map of { originalLabel: localizedLabel }
 */
export function buildLocalizedMetricLabelMap(
  metrics: QueryFormMetric[] | undefined,
  locale?: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!metrics || !locale) return map;

  for (const metric of metrics) {
    const originalLabel = getMetricLabel(metric);
    const localizedLabel = getLocalizedMetricLabel(metric, locale);
    if (localizedLabel !== originalLabel) {
      map[originalLabel] = localizedLabel;
    }
  }

  return map;
}
