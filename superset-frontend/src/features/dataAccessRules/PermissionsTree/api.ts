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

import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';

export interface DatabaseInfo {
  id: number;
  database_name: string;
}

export interface FetchResult<T> {
  result: T[];
  count: number;
}

export async function fetchDatabases(): Promise<DatabaseInfo[]> {
  const query = rison.encode({
    columns: ['id', 'database_name'],
    page_size: 1000,
  });
  const response = await SupersetClient.get({
    endpoint: `/api/v1/database/?q=${query}`,
  });
  return response.json.result;
}

export async function fetchCatalogs(
  databaseId: number,
  filter?: string,
  page?: number,
  pageSize?: number,
): Promise<FetchResult<string>> {
  const params: Record<string, unknown> = {};
  if (filter) params.filter = filter;
  if (page !== undefined) params.page = page;
  if (pageSize !== undefined) params.page_size = pageSize;

  const query = rison.encode(params);
  const response = await SupersetClient.get({
    endpoint: `/api/v1/database/${databaseId}/catalogs/?q=${query}`,
  });
  return {
    result: response.json.result,
    count: response.json.count ?? response.json.result.length,
  };
}

export async function fetchSchemas(
  databaseId: number,
  catalog?: string,
  filter?: string,
  page?: number,
  pageSize?: number,
): Promise<FetchResult<string>> {
  const params: Record<string, unknown> = {};
  if (catalog) params.catalog = catalog;
  if (filter) params.filter = filter;
  if (page !== undefined) params.page = page;
  if (pageSize !== undefined) params.page_size = pageSize;

  const query = rison.encode(params);
  const response = await SupersetClient.get({
    endpoint: `/api/v1/database/${databaseId}/schemas/?q=${query}`,
  });
  return {
    result: response.json.result,
    count: response.json.count ?? response.json.result.length,
  };
}

export interface TableInfo {
  value: string;
  type: 'table' | 'view' | 'materialized_view';
  extra?: Record<string, unknown>;
}

export async function fetchTables(
  databaseId: number,
  schemaName: string,
  catalogName?: string,
  filter?: string,
  page?: number,
  pageSize?: number,
): Promise<FetchResult<TableInfo>> {
  const params: Record<string, unknown> = {
    schema_name: schemaName,
  };
  if (catalogName) params.catalog_name = catalogName;
  if (filter) params.filter = filter;
  if (page !== undefined) params.page = page;
  if (pageSize !== undefined) params.page_size = pageSize;

  const query = rison.encode(params);
  const response = await SupersetClient.get({
    endpoint: `/api/v1/database/${databaseId}/tables/?q=${query}`,
  });
  return {
    result: response.json.result,
    count: response.json.count,
  };
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
}

export async function fetchColumns(
  databaseId: number,
  tableName: string,
  schemaName?: string,
  catalogName?: string,
): Promise<ColumnInfo[]> {
  const params: Record<string, string> = {
    name: tableName,
  };
  if (schemaName) params.schema = schemaName;
  if (catalogName) params.catalog = catalogName;

  const queryString = new URLSearchParams(params).toString();
  const response = await SupersetClient.get({
    endpoint: `/api/v1/database/${databaseId}/table_metadata/?${queryString}`,
  });
  return response.json.columns || [];
}
