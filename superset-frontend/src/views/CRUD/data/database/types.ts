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

export type DatabaseObject = {
  // Connection + general
  id?: number;
  database_name: string;
  sqlalchemy_uri?: string;
  backend?: string;
  created_by?: null | DatabaseUser;
  changed_on_delta_humanized?: string;
  changed_on?: string;

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

  // Extra
  impersonate_user?: boolean;
  allow_csv_upload?: boolean;
  extra?: string;
};
