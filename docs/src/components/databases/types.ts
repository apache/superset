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

/**
 * TypeScript types for database documentation data
 * Generated from superset/db_engine_specs/lib.py
 */

export interface Driver {
  name: string;
  pypi_package?: string;
  connection_string?: string;
  is_recommended?: boolean;
  notes?: string;
  docs_url?: string;
  default_port?: number;
  odbc_driver_paths?: Record<string, string>;
  environment_variables?: Record<string, string>;
}

export interface ConnectionExample {
  description: string;
  connection_string: string;
}

export interface HostExample {
  platform: string;
  host: string;
}

export interface AuthenticationMethod {
  name: string;
  description?: string;
  requirements?: string;
  connection_string?: string;
  secure_extra?: Record<string, unknown>;
  secure_extra_body?: Record<string, unknown>;
  secure_extra_path?: Record<string, unknown>;
  engine_parameters?: Record<string, unknown>;
  config_example?: Record<string, unknown>;
  notes?: string;
}

export interface EngineParameter {
  name: string;
  description?: string;
  json?: Record<string, unknown>;
  secure_extra?: Record<string, unknown>;
  docs_url?: string;
}

export interface SSLConfiguration {
  custom_certificate?: string;
  disable_ssl_verification?: {
    engine_params?: Record<string, unknown>;
  };
}

export interface CompatibleDatabase {
  name: string;
  description?: string;
  logo?: string;
  homepage_url?: string;
  categories?: string[];  // Category classifications (e.g., ["TRADITIONAL_RDBMS", "OPEN_SOURCE"])
  pypi_packages?: string[];
  connection_string?: string;
  parameters?: Record<string, string>;
  connection_examples?: ConnectionExample[];
  notes?: string;
  docs_url?: string;
}

export interface DatabaseDocumentation {
  description?: string;
  logo?: string;
  homepage_url?: string;
  categories?: string[];  // Category classifications (e.g., ["TRADITIONAL_RDBMS", "OPEN_SOURCE"])
  pypi_packages?: string[];
  connection_string?: string;
  default_port?: number;
  parameters?: Record<string, string>;
  notes?: string;
  limitations?: string[];  // Known limitations or caveats
  connection_examples?: ConnectionExample[];
  host_examples?: HostExample[];
  drivers?: Driver[];
  authentication_methods?: AuthenticationMethod[];
  engine_parameters?: EngineParameter[];
  ssl_configuration?: SSLConfiguration;
  version_requirements?: string;
  install_instructions?: string;
  warnings?: string[];
  tutorials?: string[];
  docs_url?: string;
  sqlalchemy_docs_url?: string;
  advanced_features?: Record<string, string>;
  compatible_databases?: CompatibleDatabase[];
}

export interface TimeGrains {
  SECOND?: boolean;
  MINUTE?: boolean;
  HOUR?: boolean;
  DAY?: boolean;
  WEEK?: boolean;
  MONTH?: boolean;
  QUARTER?: boolean;
  YEAR?: boolean;
  FIVE_SECONDS?: boolean;
  THIRTY_SECONDS?: boolean;
  FIVE_MINUTES?: boolean;
  TEN_MINUTES?: boolean;
  FIFTEEN_MINUTES?: boolean;
  THIRTY_MINUTES?: boolean;
  HALF_HOUR?: boolean;
  SIX_HOURS?: boolean;
  WEEK_STARTING_SUNDAY?: boolean;
  WEEK_STARTING_MONDAY?: boolean;
  WEEK_ENDING_SATURDAY?: boolean;
  WEEK_ENDING_SUNDAY?: boolean;
  QUARTER_YEAR?: boolean;
}

export interface DatabaseInfo {
  engine: string;
  engine_name: string;
  engine_aliases?: string[];
  default_driver?: string;
  module?: string;
  documentation: DatabaseDocumentation;

  // Diagnostics from lib.py diagnose() function
  time_grains: TimeGrains;
  score: number;
  max_score: number;

  // SQL capabilities
  joins: boolean;
  subqueries: boolean;
  alias_in_select?: boolean;
  alias_in_orderby?: boolean;
  cte_in_subquery?: boolean;
  sql_comments?: boolean;
  escaped_colons?: boolean;
  time_groupby_inline?: boolean;
  alias_to_source_column?: boolean;
  order_by_not_in_select?: boolean;
  expressions_in_orderby?: boolean;

  // Platform features
  limit_method?: string;
  limit_clause?: boolean;
  max_column_name?: number;
  supports_file_upload?: boolean;
  supports_dynamic_schema?: boolean;
  supports_catalog?: boolean;
  supports_dynamic_catalog?: boolean;

  // Advanced features
  user_impersonation?: boolean;
  ssh_tunneling?: boolean;
  query_cancelation?: boolean;
  expand_data?: boolean;
  query_cost_estimation?: boolean;
  sql_validation?: boolean;
  get_metrics?: boolean;
  where_latest_partition?: boolean;
  get_extra_table_metadata?: boolean;
  dbapi_exception_mapping?: boolean;
  custom_errors?: boolean;
  masked_encrypted_extra?: boolean;
  column_type_mapping?: boolean;
  function_names?: boolean;
}

export interface Statistics {
  totalDatabases: number;
  withDocumentation: number;
  withConnectionString: number;
  withDrivers: number;
  withAuthMethods: number;
  supportsJoins: number;
  supportsSubqueries: number;
  supportsDynamicSchema: number;
  supportsCatalog: number;
  averageScore: number;
  maxScore: number;
  byCategory: Record<string, string[]>;
}

export interface DatabaseData {
  generated: string;
  statistics: Statistics;
  databases: Record<string, DatabaseInfo>;
}

// Helper type for sorting databases
export type SortField = 'name' | 'score' | 'category';
export type SortDirection = 'asc' | 'desc';

// Helper to get common time grains
export const COMMON_TIME_GRAINS = [
  'SECOND',
  'MINUTE',
  'HOUR',
  'DAY',
  'WEEK',
  'MONTH',
  'QUARTER',
  'YEAR',
] as const;

export const EXTENDED_TIME_GRAINS = [
  'FIVE_SECONDS',
  'THIRTY_SECONDS',
  'FIVE_MINUTES',
  'TEN_MINUTES',
  'FIFTEEN_MINUTES',
  'THIRTY_MINUTES',
  'HALF_HOUR',
  'SIX_HOURS',
  'WEEK_STARTING_SUNDAY',
  'WEEK_STARTING_MONDAY',
  'WEEK_ENDING_SATURDAY',
  'WEEK_ENDING_SUNDAY',
  'QUARTER_YEAR',
] as const;
