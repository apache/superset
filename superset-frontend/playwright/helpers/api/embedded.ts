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

import { Page } from '@playwright/test';
import { apiPost, apiPut, getCsrfToken } from './requests';
import { ENDPOINTS as DASHBOARD_ENDPOINTS } from './dashboard';

export const ENDPOINTS = {
  SECURITY_LOGIN: 'api/v1/security/login',
  GUEST_TOKEN: 'api/v1/security/guest_token/',
} as const;

export interface EmbeddedConfig {
  uuid: string;
  allowed_domains: string[];
  dashboard_id: number;
}

/**
 * Enable embedding on a dashboard and return the embedded UUID.
 * Uses PUT (upsert) to preserve UUID across repeated calls.
 * @param page - Playwright page instance (provides authentication context)
 * @param dashboardIdOrSlug - Numeric dashboard id or slug
 * @param allowedDomains - Domains allowed to embed; empty array allows all
 * @returns Embedded config with UUID, allowed_domains, and dashboard_id
 */
export async function apiEnableEmbedding(
  page: Page,
  dashboardIdOrSlug: number | string,
  allowedDomains: string[] = [],
): Promise<EmbeddedConfig> {
  const response = await apiPut(
    page,
    `${DASHBOARD_ENDPOINTS.DASHBOARD}${dashboardIdOrSlug}/embedded`,
    { allowed_domains: allowedDomains },
  );
  const body = await response.json();
  return body.result as EmbeddedConfig;
}

/**
 * Login as admin and return the JWT access token used by the guest_token
 * endpoint. Cache the result at suite level (`beforeAll`) and pass it into
 * `getGuestToken` to avoid a fresh login on every test.
 *
 * Defaults match `playwright/global-setup.ts` so credentials come from one
 * source (env vars). Overrides via `options` win.
 */
export async function getAccessToken(
  page: Page,
  options?: { username?: string; password?: string },
): Promise<string> {
  const username =
    options?.username ?? process.env.PLAYWRIGHT_ADMIN_USERNAME ?? 'admin';
  const password =
    options?.password ?? process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'general';
  const loginResponse = await apiPost(
    page,
    ENDPOINTS.SECURITY_LOGIN,
    {
      username,
      password,
      provider: 'db',
      refresh: true,
    },
    { allowMissingCsrf: true },
  );
  const loginBody = await loginResponse.json();
  return loginBody.access_token;
}

/**
 * Get a guest token for an embedded dashboard.
 * If `accessToken` is provided, the login round-trip is skipped — preferred
 * for tests that fetch many tokens from a single suite.
 * @returns Signed guest token string
 */
export async function getGuestToken(
  page: Page,
  dashboardId: number | string,
  options?: {
    accessToken?: string;
    username?: string;
    password?: string;
    rls?: Array<{ dataset: number; clause: string }>;
  },
): Promise<string> {
  const accessToken =
    options?.accessToken ??
    (await getAccessToken(page, {
      username: options?.username,
      password: options?.password,
    }));
  const rls = options?.rls ?? [];

  // The guest_token endpoint authenticates via JWT Bearer, but if the
  // request also carries a session cookie (which page.request inherits from
  // storageState), Flask-WTF still requires a matching X-CSRFToken. Send it
  // unconditionally so this works whether the caller is authenticated via
  // session, JWT, or both.
  const { token: csrfToken } = await getCsrfToken(page);
  const guestResponse = await page.request.post(ENDPOINTS.GUEST_TOKEN, {
    data: {
      user: {
        username: 'embedded_test_user',
        first_name: 'Embedded',
        last_name: 'TestUser',
      },
      resources: [{ type: 'dashboard', id: String(dashboardId) }],
      rls,
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
  });
  const guestBody = await guestResponse.json();
  return guestBody.token;
}
