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
import { createGsheetsDatabase } from './database.factories';
import { apiPostDataset } from './dataset';

/**
 * Create a test dataset with Google Sheets database
 * Creates both the database connection and dataset in one call
 * @param page - Playwright page instance
 * @param datasetName - Name for the dataset/table
 * @returns Object containing database ID and dataset ID
 */
export async function createTestDataset(
  page: Page,
  datasetName: string,
): Promise<{ dbId: number; datasetId: number }> {
  // Step 1: Create Google Sheets database with catalog entry
  // The tableName in the catalog must match the table_name used when creating the dataset
  const dbName = `test_db_${Date.now()}`;
  const tableName = datasetName; // Use same name for catalog entry and dataset table_name
  const dbId = await createGsheetsDatabase(page, dbName, tableName);

  // Step 2: Create dataset using the database
  // For Google Sheets, table_name must reference the catalog entry name
  // catalog: null is required to avoid OAuth validation issues
  const datasetRequestBody = {
    database: dbId,
    catalog: null,
    schema: 'main',
    table_name: tableName, // Must match the catalog entry name
  };

  const response = await apiPostDataset(page, datasetRequestBody);

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create dataset: ${response.status()} ${response.statusText()}\n${errorText}`,
    );
  }

  const body = await response.json();
  const datasetId = body.id;

  return { dbId, datasetId };
}
