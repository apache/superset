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
type DatabaseUser = {
  first_name: string;
  last_name: string;
};

export type CatalogObject = {
  name: string;
  value: string;
};

export type DatabaseObject = {
  // Connection + general
  id?: number;
  database_name: string;
  name: string; // synonym to database_name
  sqlalchemy_uri?: string;
  backend?: string;
  created_by?: null | DatabaseUser;
  changed_on_delta_humanized?: string;
  changed_on?: string;
  parameters?: {
    database_name?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    encryption?: boolean;
    credentials_info?: string;
    service_account_info?: string;
    query?: Record<string, string>;
    catalog?: Record<string, string>;
    properties?: Record<string, any>;
    warehouse?: string;
    role?: string;
    account?: string;
  };
  configuration_method: CONFIGURATION_METHOD;
  engine?: string;
  paramProperties?: Record<string, any>;

  // Performance
  cache_timeout?: string;
  allow_run_async?: boolean;

  // SQL Lab
  expose_in_sqllab?: boolean;
  allow_ctas?: boolean;
  allow_cvas?: boolean;
  allow_dml?: boolean;
  allow_multi_schema_metadata_fetch?: boolean;
  force_ctas_schema?: string;

  // Security
  encrypted_extra?: string;
  server_cert?: string;
  allow_file_upload?: boolean;
  impersonate_user?: boolean;
  parameters_schema?: Record<string, any>;

  // Extra
  extra_json?: {
    engine_params?: {
      catalog: Record<any, any> | string;
    };
    metadata_params?: {} | string;
    metadata_cache_timeout?: {
      schema_cache_timeout?: number; // in Performance
      table_cache_timeout?: number; // in Performance
    }; // No field, holds schema and table timeout
    allows_virtual_table_explore?: boolean; // in SQL Lab
    schemas_allowed_for_file_upload?: string[]; // in Security
    cancel_query_on_windows_unload?: boolean; // in Performance

    version?: string;
    cost_estimate_enabled?: boolean; // in SQL Lab
  };

  // Temporary storage
  catalog?: Array<CatalogObject>;
  query_input?: string;
  extra?: string;
};

export type DatabaseForm = {
  engine: string;
  name: string;
  parameters: {
    properties: {
      database: {
        description: string;
        type: string;
      };
      host: {
        description: string;
        type: string;
      };
      password: {
        description: string;
        nullable: boolean;
        type: string;
      };
      port: {
        description: string;
        format: string;
        type: string;
      };
      query: {
        additionalProperties: {};
        description: string;
        type: string;
      };
      username: {
        description: string;
        nullable: boolean;
        type: string;
      };
      credentials_info: {
        description: string;
        nullable: boolean;
        type: string;
      };
      service_account_info: {
        description: string;
        nullable: boolean;
        type: string;
      };
    };
    required: string[];
    type: string;
  };
  preferred: boolean;
  sqlalchemy_uri_placeholder: string;
};

// the values should align with the database
// model enum in superset/superset/models/core.py
export enum CONFIGURATION_METHOD {
  SQLALCHEMY_URI = 'sqlalchemy_form',
  DYNAMIC_FORM = 'dynamic_form',
}
