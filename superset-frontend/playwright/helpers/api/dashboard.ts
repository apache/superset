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
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  ApiRequestOptions,
} from './requests';

export const ENDPOINTS = {
  DASHBOARD: 'api/v1/dashboard/',
} as const;

/** Payload for POST /api/v1/dashboard/ */
export interface DashboardCreatePayload {
  dashboard_title: string;
  slug?: string;
  owners?: number[];
  published?: boolean;
}

/** Payload for PUT /api/v1/dashboard/{id} */
export interface DashboardUpdatePayload {
  dashboard_title?: string;
  slug?: string;
  json_metadata?: string;
  owners?: number[];
  certified_by?: string;
  certification_details?: string;
  css?: string;
  translations?: Record<string, Record<string, string>>;
}

/** Dashboard data shape from API responses */
export interface DashboardResult {
  id: number;
  dashboard_title: string;
  slug?: string;
  translations?: Record<string, Record<string, string>>;
  available_locales?: string[];
  current_locale?: string;
}

/**
 * POST /api/v1/dashboard/
 * Creates a new dashboard.
 */
export async function apiPostDashboard(
  page: Page,
  payload: DashboardCreatePayload,
): Promise<APIResponse> {
  return apiPost(page, ENDPOINTS.DASHBOARD, payload);
}

/**
 * GET /api/v1/dashboard/{id}
 * Fetches dashboard details.
 */
export async function apiGetDashboard(
  page: Page,
  dashboardId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiGet(page, `${ENDPOINTS.DASHBOARD}${dashboardId}`, options);
}

/**
 * PUT /api/v1/dashboard/{id}
 * Updates dashboard fields including translations.
 */
export async function apiPutDashboard(
  page: Page,
  dashboardId: number,
  data: DashboardUpdatePayload,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiPut(page, `${ENDPOINTS.DASHBOARD}${dashboardId}`, data, options);
}

/**
 * DELETE /api/v1/dashboard/{id}
 * Removes a dashboard.
 */
export async function apiDeleteDashboard(
  page: Page,
  dashboardId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.DASHBOARD}${dashboardId}`, options);
}

/**
 * Creates a minimal dashboard for testing.
 * @returns Dashboard ID, or null on failure.
 */
export async function createTestDashboard(
  page: Page,
  title: string,
): Promise<number | null> {
  const response = await apiPostDashboard(page, {
    dashboard_title: title,
    owners: [],
  });

  if (!response.ok()) {
    console.warn(`Failed to create dashboard: ${response.status()}`);
    return null;
  }

  const body = await response.json();
  return body.id ?? null;
}
