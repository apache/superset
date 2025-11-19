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
import { apiPostDatabase } from './database';

// Public Google Sheets URL for testing
const NETFLIX_TITLES_SHEET =
  'https://docs.google.com/spreadsheets/d/19XNqckHGKGGPh83JGFdFGP4Bw9gdXeujq5EoIGwttdM/edit#gid=347941303';

/**
 * Create a Google Sheets database connection for testing
 * Uses a public Netflix titles dataset by default
 * @param page - Playwright page instance
 * @param databaseName - Name for the database connection
 * @param tableName - Name for the table/dataset
 * @returns Database ID from the created database
 */
export async function createGsheetsDatabase(
  page: Page,
  databaseName: string,
  tableName: string,
): Promise<number> {
  const requestBody = {
    database_name: databaseName,
    engine: 'gsheets',
    configuration_method: 'dynamic_form',
    engine_information: {
      disable_ssh_tunneling: true,
      supports_dynamic_catalog: false,
      supports_file_upload: true,
      supports_oauth2: true,
    },
    driver: 'apsw',
    sqlalchemy_uri_placeholder: 'gsheets://',
    extra: JSON.stringify({
      allows_virtual_table_explore: true,
      engine_params: {
        catalog: {
          [tableName]: NETFLIX_TITLES_SHEET,
        },
      },
    }),
    expose_in_sqllab: true,
    catalog: [
      {
        name: tableName,
        value: NETFLIX_TITLES_SHEET,
      },
    ],
    parameters: {
      service_account_info: '',
      catalog: {
        [tableName]: NETFLIX_TITLES_SHEET,
      },
    },
    masked_encrypted_extra: '{}',
    impersonate_user: true,
  };

  const response = await apiPostDatabase(page, requestBody);

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create database: ${response.status()} ${response.statusText()}\n${errorText}`,
    );
  }

  const body = await response.json();
  return body.id;
}
