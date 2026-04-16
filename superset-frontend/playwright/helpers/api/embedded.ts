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
import { apiPost, apiPut } from './requests';
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
 * Get a guest token for an embedded dashboard.
 * Uses the admin login flow (login → access_token → guest_token).
 * @param page - Playwright page instance (used for request context)
 * @param dashboardId - Dashboard id to grant access to
 * @param options - Optional login credentials and RLS rules
 * @returns Signed guest token string
 */
export async function getGuestToken(
  page: Page,
  dashboardId: number | string,
  options?: {
    username?: string;
    password?: string;
    rls?: Array<{ dataset: number; clause: string }>;
  },
): Promise<string> {
  const username = options?.username ?? 'admin';
  const password = options?.password ?? 'general';
  const rls = options?.rls ?? [];

  // Step 1: Login to get access token
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
  const accessToken = loginBody.access_token;

  // Step 2: Fetch guest token using the access token.
  // Uses raw page.request.post() (not apiPost) because the guest token endpoint
  // requires a JWT Bearer token rather than session+CSRF auth.
  const guestResponse = await page.request.post(ENDPOINTS.GUEST_TOKEN, {
    data: {
      user: {
        username: 'embedded_test_user',
        first_name: 'Embedded',
        last_name: 'TestUser',
      },
      resources: [{ type: 'dashboard', id: dashboardId }],
      rls,
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const guestBody = await guestResponse.json();
  return guestBody.token;
}
