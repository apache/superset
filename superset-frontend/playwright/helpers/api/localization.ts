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

import { Page, APIResponse } from '@playwright/test';
import { apiGet, ApiRequestOptions } from './requests';

export const ENDPOINTS = {
  LOCALIZATION: 'api/v1/localization/',
} as const;

/** Locale entry from /api/v1/localization/available_locales */
export interface LocaleInfo {
  code: string;
  name: string;
  flag: string;
}

/** Response shape from /api/v1/localization/available_locales */
export interface AvailableLocalesResponse {
  locales: LocaleInfo[];
  default_locale: string;
}

/**
 * GET /api/v1/localization/available_locales
 * Returns configured locales for content localization.
 */
export async function apiGetAvailableLocales(
  page: Page,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiGet(
    page,
    `${ENDPOINTS.LOCALIZATION}available_locales`,
    options,
  );
}
