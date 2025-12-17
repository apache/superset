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

export interface DatasourceConnectorState {
  databaseId: number | null;
  databaseName: string | null;
  catalogName: string | null;
  schemaName: string | null;
  isSubmitting: boolean;
}

export interface DatasourceAnalyzerPostPayload {
  database_id: number;
  schema_name: string;
  catalog_name?: string | null;
}

export interface DatasourceAnalyzerResponse {
  result: {
    run_id: string;
  };
}

export enum ConnectorStep {
  CONNECT_DATA_SOURCE = 0,
  REVIEW_SCHEMA = 1,
  GENERATE_DASHBOARD = 2,
}
