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
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';

/**
 * Normalize host-app locale codes (e.g. react-i18next) to Superset codes.
 */
export function normalizeLocale(locale: string): string {
  const normalized = locale.trim().replace('-', '_');
  const [language, region] = normalized.split('_');

  if (!language) {
    return 'en';
  }

  if (region?.length === 2) {
    const withRegion = `${language.toLowerCase()}_${region.toUpperCase()}`;
    if (withRegion === 'pt_BR' || withRegion === 'zh_TW') {
      return withRegion;
    }
  }

  return language.toLowerCase();
}

/**
 * Resolve the active locale, preferring the `lang` URL param used by embedded SDK.
 */
export function resolveAppLocale(bootstrapLocale?: string): string {
  const urlLocale = getUrlParam(URL_PARAMS.language);
  if (urlLocale) {
    return normalizeLocale(urlLocale);
  }

  return bootstrapLocale || 'en';
}
