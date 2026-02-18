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
 * Resolve a localized value for a formData text field.
 *
 * Looks up `translations[fieldName][locale]` with base language fallback
 * (e.g., "de" from "de-AT").
 *
 * @param translations - The translations object from formData (field → locale → value)
 * @param fieldName - The control name (e.g., "x_axis_title", "subtitle")
 * @param locale - The user's locale (e.g., "de", "de-AT")
 * @returns The translated string, or undefined if no translation exists
 */
export default function getLocalizedFormDataValue(
  translations: Record<string, Record<string, string>> | undefined,
  fieldName: string,
  locale?: string,
): string | undefined {
  if (!translations || !locale) return undefined;

  const fieldTranslations = translations[fieldName];
  if (!fieldTranslations) return undefined;

  if (fieldTranslations[locale]) return fieldTranslations[locale];

  const baseLang = locale.split('-')[0];
  if (baseLang !== locale && fieldTranslations[baseLang]) {
    return fieldTranslations[baseLang];
  }

  return undefined;
}
