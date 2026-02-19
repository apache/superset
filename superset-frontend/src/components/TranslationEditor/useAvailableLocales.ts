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
import { useEffect, useState } from 'react';
import { logging } from '@apache-superset/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { SupersetClient } from '@superset-ui/core/connection';
import type { LocaleInfo } from 'src/types/Localization';

interface AvailableLocalesResult {
  allLocales: LocaleInfo[];
  defaultLocale: string;
}

const EMPTY_RESULT: AvailableLocalesResult = {
  allLocales: [],
  defaultLocale: '',
};

/** Module-level cache: one fetch per page load, shared across all callers. */
let cachedPromise: Promise<AvailableLocalesResult> | null = null;

function fetchLocales(): Promise<AvailableLocalesResult> {
  if (cachedPromise) return cachedPromise;
  cachedPromise = SupersetClient.get({
    endpoint: '/api/v1/localization/available_locales',
  }).then(
    response => {
      const { locales, default_locale } = response.json.result;
      return { allLocales: locales, defaultLocale: default_locale };
    },
    err => {
      logging.error('Failed to fetch available locales', err);
      // Allow retry on next call
      cachedPromise = null;
      return EMPTY_RESULT;
    },
  );
  return cachedPromise;
}

/**
 * Shared hook that fetches available locales once per page load.
 *
 * Returns empty result when `ENABLE_CONTENT_LOCALIZATION` feature flag is off.
 * All component instances share the same cached API response — no duplicate
 * network requests.
 */
export default function useAvailableLocales(): AvailableLocalesResult {
  const [result, setResult] = useState<AvailableLocalesResult>(EMPTY_RESULT);

  useEffect(() => {
    if (!isFeatureEnabled(FeatureFlag.EnableContentLocalization)) return;
    fetchLocales().then(setResult);
  }, []);

  return result;
}

/** Reset the module-level cache. Exposed for tests only. */
export function resetLocalesCache(): void {
  cachedPromise = null;
}
