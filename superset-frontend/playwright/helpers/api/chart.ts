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
  CHART: 'api/v1/chart/',
} as const;

/** Payload for POST /api/v1/chart/ */
export interface ChartCreatePayload {
  slice_name: string;
  datasource_id: number;
  datasource_type: string;
  viz_type?: string;
  owners?: number[];
  dashboards?: number[];
  params?: string;
}

/** Payload for PUT /api/v1/chart/{id} */
export interface ChartUpdatePayload {
  slice_name?: string;
  owners?: number[];
  dashboards?: number[];
  translations?: Record<string, Record<string, string>>;
}

/** Chart data shape from API responses */
export interface ChartResult {
  id: number;
  uuid: string;
  slice_name: string;
  viz_type?: string;
  translations?: Record<string, Record<string, string>>;
  available_locales?: string[];
}

/**
 * POST /api/v1/chart/
 * Creates a new chart.
 */
export async function apiPostChart(
  page: Page,
  payload: ChartCreatePayload,
): Promise<APIResponse> {
  return apiPost(page, ENDPOINTS.CHART, payload);
}

/**
 * GET /api/v1/chart/{id}
 * Fetches chart details.
 */
export async function apiGetChart(
  page: Page,
  chartId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiGet(page, `${ENDPOINTS.CHART}${chartId}`, options);
}

/**
 * PUT /api/v1/chart/{id}
 * Updates chart fields including translations.
 */
export async function apiPutChart(
  page: Page,
  chartId: number,
  data: ChartUpdatePayload,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiPut(page, `${ENDPOINTS.CHART}${chartId}`, data, options);
}

/**
 * DELETE /api/v1/chart/{id}
 * Removes a chart.
 */
export async function apiDeleteChart(
  page: Page,
  chartId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.CHART}${chartId}`, options);
}

/**
 * Creates a minimal chart for testing.
 * Requires a datasource (use createTestVirtualDataset first).
 * Fetches UUID via GET after creation (not in POST response).
 * @returns Chart ID and UUID, or null on failure.
 */
export async function createTestChart(
  page: Page,
  sliceName: string,
  datasourceId: number,
): Promise<{ id: number; uuid: string } | null> {
  const response = await apiPostChart(page, {
    slice_name: sliceName,
    datasource_id: datasourceId,
    datasource_type: 'table',
    viz_type: 'table',
    owners: [],
  });

  if (!response.ok()) {
    console.warn(`Failed to create chart: ${response.status()}`);
    return null;
  }

  const body = await response.json();
  const id = body.id ?? null;
  if (!id) return null;

  // Fetch uuid (auto-generated, not in POST response)
  const getResponse = await apiGetChart(page, id);
  if (!getResponse.ok()) {
    console.warn(`Failed to fetch chart uuid: ${getResponse.status()}`);
    return null;
  }

  const detail = await getResponse.json();
  const uuid = detail.result?.uuid;
  if (!uuid) {
    console.warn('Chart uuid not found in GET response');
    return null;
  }

  return { id, uuid };
}
