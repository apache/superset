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
import rison from 'rison';
import {
  apiGet,
  apiPost,
  apiDelete,
  apiPut,
  ApiRequestOptions,
} from './requests';

export const ENDPOINTS = {
  DASHBOARD: 'api/v1/dashboard/',
  DASHBOARD_EXPORT: 'api/v1/dashboard/export/',
  DASHBOARD_IMPORT: 'api/v1/dashboard/import/',
} as const;

/**
 * TypeScript interface for dashboard creation API payload.
 * Only dashboard_title is required (DashboardPostSchema).
 */
export interface DashboardCreatePayload {
  dashboard_title: string;
  slug?: string;
  position_json?: string;
  css?: string;
  json_metadata?: string;
  published?: boolean;
}

/**
 * POST request to create a dashboard
 * @param page - Playwright page instance (provides authentication context)
 * @param requestBody - Dashboard configuration object
 * @returns API response from dashboard creation
 */
export async function apiPostDashboard(
  page: Page,
  requestBody: DashboardCreatePayload,
): Promise<APIResponse> {
  return apiPost(page, ENDPOINTS.DASHBOARD, requestBody);
}

/**
 * GET request to fetch a dashboard's details
 * @param page - Playwright page instance (provides authentication context)
 * @param dashboardId - ID of the dashboard to fetch
 * @param options - Optional request options
 * @returns API response with dashboard details
 */
export async function apiGetDashboard(
  page: Page,
  dashboardId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiGet(page, `${ENDPOINTS.DASHBOARD}${dashboardId}`, options);
}

/**
 * DELETE request to remove a dashboard
 * @param page - Playwright page instance (provides authentication context)
 * @param dashboardId - ID of the dashboard to delete
 * @param options - Optional request options
 * @returns API response from dashboard deletion
 */
export async function apiDeleteDashboard(
  page: Page,
  dashboardId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.DASHBOARD}${dashboardId}`, options);
}

/**
 * PUT request to update a dashboard
 * @param page - Playwright page instance (provides authentication context)
 * @param dashboardId - ID of the dashboard to update
 * @param data - Partial dashboard payload (Marshmallow allows optional fields)
 * @param options - Optional request options
 * @returns API response from dashboard update
 */
export async function apiPutDashboard(
  page: Page,
  dashboardId: number,
  data: Record<string, unknown>,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiPut(page, `${ENDPOINTS.DASHBOARD}${dashboardId}`, data, options);
}

/**
 * Export dashboards as a zip file via the API.
 * Uses Rison encoding for the query parameter (required by the endpoint).
 * @param page - Playwright page instance (provides authentication context)
 * @param dashboardIds - Array of dashboard IDs to export
 * @returns API response containing the zip file
 */
export async function apiExportDashboards(
  page: Page,
  dashboardIds: number[],
): Promise<APIResponse> {
  const query = rison.encode(dashboardIds);
  return apiGet(page, `${ENDPOINTS.DASHBOARD_EXPORT}?q=${query}`);
}

/**
 * TypeScript interface for dashboard search result
 */
export interface DashboardResult {
  id: number;
  dashboard_title: string;
  slug?: string;
  published?: boolean;
}

/**
 * Get a dashboard by its title
 * @param page - Playwright page instance (provides authentication context)
 * @param title - The dashboard_title to search for
 * @returns Dashboard object if found, null if not found
 */
export async function getDashboardByName(
  page: Page,
  title: string,
): Promise<DashboardResult | null> {
  const filter = {
    filters: [
      {
        col: 'dashboard_title',
        opr: 'eq',
        value: title,
      },
    ],
  };
  const queryParam = rison.encode(filter);
  const response = await apiGet(
    page,
    `${ENDPOINTS.DASHBOARD}?q=${queryParam}`,
    { failOnStatusCode: false },
  );

  if (!response.ok()) {
    return null;
  }

  const body = await response.json();
  if (body.result && body.result.length > 0) {
    return body.result[0] as DashboardResult;
  }

  return null;
}
