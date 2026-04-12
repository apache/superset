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
import { apiPost, apiPut, apiGet } from './requests';

export const ENDPOINTS = {
  SECURITY_LOGIN: 'api/v1/security/login',
  GUEST_TOKEN: 'api/v1/security/guest_token/',
  DASHBOARD: 'api/v1/dashboard/',
} as const;

export interface EmbeddedConfig {
  uuid: string;
  allowed_domains: string[];
  dashboard_id: string;
}

/**
 * Enable embedding on a dashboard and return the embedded UUID.
 * Uses PUT (upsert) to preserve UUID across repeated calls.
 */
export async function apiEnableEmbedding(
  page: Page,
  dashboardIdOrSlug: number | string,
  allowedDomains: string[] = [],
): Promise<EmbeddedConfig> {
  const response = await apiPut(
    page,
    `${ENDPOINTS.DASHBOARD}${dashboardIdOrSlug}/embedded`,
    { allowed_domains: allowedDomains },
  );
  const body = await response.json();
  return body.result as EmbeddedConfig;
}

/**
 * Get a guest token for an embedded dashboard.
 * Uses the admin login flow (login → access_token → guest_token).
 */
export async function getGuestToken(
  page: Page,
  dashboardId: string,
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

  // Step 2: Fetch guest token using the access token
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

/**
 * Get a dashboard by slug, returning its numeric ID.
 */
export async function getDashboardIdBySlug(
  page: Page,
  slug: string,
): Promise<number | null> {
  const response = await apiGet(
    page,
    `${ENDPOINTS.DASHBOARD}?q=(filters:!((col:slug,opr:eq,value:'${slug}')))`,
    { failOnStatusCode: false },
  );
  if (!response.ok()) return null;
  const body = await response.json();
  if (body.result?.length > 0) {
    return body.result[0].id;
  }
  return null;
}
