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
import { apiPost, ApiRequestOptions } from './requests';

const ENDPOINTS = {
  SQLLAB_EXECUTE: 'api/v1/sqllab/execute/',
} as const;

/**
 * Execute a SQL query via SQL Lab API.
 * Requires `allow_dml=True` on the target database for DDL/DML statements.
 * @param page - Playwright page instance (provides authentication context)
 * @param databaseId - ID of the database to execute against
 * @param sql - SQL statement to execute
 * @param schema - Optional schema context for the query
 * @returns API response from SQL Lab execution
 */
export async function apiExecuteSql(
  page: Page,
  databaseId: number,
  sql: string,
  schema?: string,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiPost(
    page,
    ENDPOINTS.SQLLAB_EXECUTE,
    {
      database_id: databaseId,
      sql,
      schema: schema ?? null,
    },
    options,
  );
}
