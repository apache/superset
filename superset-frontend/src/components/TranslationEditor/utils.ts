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

/**
 * Sentinel value representing the default (untranslated) column text
 * in the locale switcher. Not a real locale code.
 */
export const DEFAULT_LOCALE_KEY = 'default';

/** Shallow-copy each field's locale map to allow safe mutation. */
export function deepCopyTranslations(src: Translations): Translations {
  const copy: Translations = {};
  for (const field of Object.keys(src)) {
    copy[field] = { ...src[field] };
  }
  return copy;
}

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
