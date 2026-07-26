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
import { apiGet, apiPost, apiDelete, ApiRequestOptions } from './requests';

const ENDPOINTS = {
  DATABASE: 'api/v1/database/',
} as const;

/**
 * TypeScript interface for database API response
 */
export interface DatabaseResult {
  id: number;
  database_name: string;
  /** Optional - list API masks this for security, only detail API returns it */
  sqlalchemy_uri?: string;
  backend?: string;
  engine_information?: {
    disable_ssh_tunneling?: boolean;
    supports_dynamic_catalog?: boolean;
    supports_file_upload?: boolean;
    supports_oauth2?: boolean;
  };
  extra?: string;
  expose_in_sqllab?: boolean;
  impersonate_user?: boolean;
}

/**
 * TypeScript interface for database creation API payload
 * Provides compile-time safety for required fields
 */
export interface DatabaseCreatePayload {
  database_name: string;
  engine: string;
  sqlalchemy_uri?: string;
  configuration_method?: string;
  engine_information?: {
    disable_ssh_tunneling?: boolean;
    supports_dynamic_catalog?: boolean;
    supports_file_upload?: boolean;
    supports_oauth2?: boolean;
  };
  driver?: string;
  sqlalchemy_uri_placeholder?: string;
  extra?: string;
  expose_in_sqllab?: boolean;
  catalog?: Array<{ name: string; value: string }>;
  parameters?: {
    service_account_info?: string;
    catalog?: Record<string, string>;
  };
  masked_encrypted_extra?: string;
  impersonate_user?: boolean;
}

/**
 * POST request to create a database connection
 * @param page - Playwright page instance (provides authentication context)
 * @param requestBody - Database configuration object with type safety
 * @returns API response from database creation
 */
export async function apiPostDatabase(
  page: Page,
  requestBody: DatabaseCreatePayload,
): Promise<APIResponse> {
  return apiPost(page, ENDPOINTS.DATABASE, requestBody);
}

/**
 * DELETE request to remove a database connection
 * @param page - Playwright page instance (provides authentication context)
 * @param databaseId - ID of the database to delete
 * @returns API response from database deletion
 */
export async function apiDeleteDatabase(
  page: Page,
  databaseId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.DATABASE}${databaseId}`, options);
}

/**
 * GET request to fetch a database's details
 * @param page - Playwright page instance (provides authentication context)
 * @param databaseId - ID of the database to fetch
 * @returns API response with database details
 */
export async function apiGetDatabase(
  page: Page,
  databaseId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiGet(page, `${ENDPOINTS.DATABASE}${databaseId}`, options);
}

/**
 * Get a database by its name
 * @param page - Playwright page instance (provides authentication context)
 * @param databaseName - The database_name to search for
 * @returns Database object if found, null if not found
 */
export async function getDatabaseByName(
  page: Page,
  databaseName: string,
): Promise<DatabaseResult | null> {
  const filter = {
    filters: [
      {
        col: 'database_name',
        opr: 'eq',
        value: databaseName,
      },
    ],
  };
  const queryParam = rison.encode(filter);
  const response = await apiGet(page, `${ENDPOINTS.DATABASE}?q=${queryParam}`, {
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    return null;
  }

  const body = await response.json();
  if (body.result && body.result.length > 0) {
    return body.result[0] as DatabaseResult;
  }

  return null;
}
