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
 * Translation value for a single locale.
 * Maps locale code (e.g., "de", "fr", "pt-BR") to translated string.
 */
export type FieldTranslations = Record<string, string>;

/**
 * Translations for multiple fields.
 * Maps field name (e.g., "dashboard_title", "slice_name") to locale translations.
 *
 * Example:
 * {
 *   "dashboard_title": { "de": "Verkaufs-Dashboard", "fr": "Tableau de bord" },
 *   "description": { "de": "Monatlicher Bericht" }
 * }
 */
export type Translations = Record<string, FieldTranslations>;

/**
 * Interface for entities that support content localization.
 * Both Dashboard and Chart models implement this interface.
 */
export interface LocalizableEntity {
  translations?: Translations;
  available_locales?: string[];
}

/**
 * Locale info returned from /api/v1/localization/available_locales endpoint.
 */
export interface LocaleInfo {
  code: string;
  name: string;
  flag?: string;
}

/**
 * Response from /api/v1/localization/available_locales endpoint.
 */
export interface AvailableLocalesResponse {
  locales: LocaleInfo[];
  default_locale: string;
}
