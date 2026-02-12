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
import type { Translations } from 'src/types/Localization';
import type { QueryFormMetric } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';

/**
 * Sentinel value representing the default (untranslated) column text
 * in the locale switcher. Not a real locale code.
 */
export const DEFAULT_LOCALE_KEY = 'default';

/** Remove empty-string translation values; drop fields with no translations. */
export function stripEmptyValues(translations: Translations): Translations {
  const cleaned: Translations = {};
  for (const [field, locales] of Object.entries(translations)) {
    const filtered: Record<string, string> = {};
    for (const [locale, value] of Object.entries(locales)) {
      if (value) {
        filtered[locale] = value;
      }
    }
    if (Object.keys(filtered).length > 0) {
      cleaned[field] = filtered;
    }
  }
  return cleaned;
}

/** Count non-empty translations for a specific field. */
export function countFieldTranslations(
  translations: Translations,
  fieldName: string,
): number {
  const fieldMap = translations[fieldName];
  if (!fieldMap) return 0;
  return Object.values(fieldMap).filter(Boolean).length;
}

/**
 * Get localized value for a field with fallback chain:
 * 1. Exact locale match (e.g., "de-DE")
 * 2. Base language fallback (e.g., "de" from "de-DE")
 * 3. Default value (original)
 */
export function getLocalizedValue(
  translations: Translations | undefined,
  fieldName: string,
  locale: string,
  defaultValue: string,
): string {
  if (!translations) return defaultValue;
  const fieldMap = translations[fieldName];
  if (!fieldMap) return defaultValue;

  // Try exact locale match
  if (fieldMap[locale]) {
    return fieldMap[locale];
  }

  // Try base language (e.g., "de" from "de-DE")
  const baseLang = locale.split('-')[0];
  if (baseLang !== locale && fieldMap[baseLang]) {
    return fieldMap[baseLang];
  }

  return defaultValue;
}

/**
 * Get localized label for a metric.
 * Uses the current user's locale from bootstrap data.
 *
 * @param metric - The metric object (adhoc or saved)
 * @returns The localized label if available, otherwise the original label
 */
export function getLocalizedMetricLabel(metric: QueryFormMetric): string {
  // Saved metrics are just strings, no translations
  if (typeof metric === 'string') {
    return metric;
  }

  const originalLabel =
    metric.label ??
    (metric.expressionType === 'SIMPLE' && metric.column
      ? `${metric.aggregate}(${
          metric.column.column_name || (metric.column as any).columnName || ''
        })`
      : metric.expressionType === 'SQL'
        ? metric.sqlExpression
        : '');

  // Check if metric has translations
  if (!metric.translations) {
    return originalLabel;
  }

  const locale = getBootstrapData().common?.locale || 'en';
  return getLocalizedValue(metric.translations, 'label', locale, originalLabel);
}

/**
 * Build a map from original metric labels to localized labels.
 * Useful for chart plugins to localize series names, legend, tooltips.
 *
 * @param metrics - Array of metrics from formData
 * @returns Map of { originalLabel: localizedLabel }
 */
export function buildLocalizedMetricLabelMap(
  metrics: QueryFormMetric[] | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!metrics) return map;

  const locale = getBootstrapData().common?.locale || 'en';

  for (const metric of metrics) {
    if (typeof metric === 'string') {
      // Saved metrics have no translations
      continue;
    }

    const originalLabel =
      metric.label ??
      (metric.expressionType === 'SIMPLE' && metric.column
        ? `${metric.aggregate}(${
            metric.column.column_name || (metric.column as any).columnName || ''
          })`
        : metric.expressionType === 'SQL'
          ? metric.sqlExpression
          : '');

    if (metric.translations?.label) {
      const localizedLabel = getLocalizedValue(
        metric.translations,
        'label',
        locale,
        originalLabel,
      );
      if (localizedLabel !== originalLabel) {
        map[originalLabel] = localizedLabel;
      }
    }
  }

  return map;
}
