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

import { isPhysicalColumn, QueryFormColumn } from './types';

/**
 * Extract display label from column.
 *
 * @param column - Physical column name (string) or AdhocColumn object
 * @returns Label string: custom label > sqlExpression > column name
 */
export default function getColumnLabel(column: QueryFormColumn): string {
  if (isPhysicalColumn(column)) {
    return column;
  }
  if (column?.label) {
    return column.label;
  }
  return column?.sqlExpression;
}

/**
 * Get localized label for a column.
 *
 * Resolution order:
 * 1. Exact locale match (e.g., "de-DE")
 * 2. Base language match (e.g., "de" from "de-DE")
 * 3. Original label
 *
 * @param column - Physical column name or AdhocColumn object
 * @param locale - User's locale (e.g., "de", "de-DE")
 * @returns Localized label if translation exists, otherwise original label
 */
export function getLocalizedColumnLabel(
  column: QueryFormColumn,
  locale?: string,
): string {
  const originalLabel = getColumnLabel(column);

  if (isPhysicalColumn(column)) {
    return originalLabel;
  }

  if (!locale || !column.translations?.label) {
    return originalLabel;
  }

  const translations = column.translations.label;

  if (translations[locale]) {
    return translations[locale];
  }

  const baseLang = locale.split('-')[0];
  if (baseLang !== locale && translations[baseLang]) {
    return translations[baseLang];
  }

  return originalLabel;
}

/**
 * Build map from original column labels to localized labels.
 *
 * @param columns - Array of columns from formData (groupby, columns, etc.)
 * @param locale - User's locale
 * @returns Map of { originalLabel: localizedLabel } for columns with translations
 */
export function buildLocalizedColumnLabelMap(
  columns: QueryFormColumn[] | undefined,
  locale?: string,
): Record<string, string> {
  const map: Record<string, string> = {};

  if (!columns || !locale) {
    return map;
  }

  for (const column of columns) {
    if (isPhysicalColumn(column)) {
      continue;
    }
    const originalLabel = getColumnLabel(column);
    const localizedLabel = getLocalizedColumnLabel(column, locale);
    if (localizedLabel !== originalLabel) {
      map[originalLabel] = localizedLabel;
    }
  }

  return map;
}
