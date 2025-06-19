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

export interface QueryExecutePayload {
  client_id: string;
  database_id: number;
  json: boolean;
  runAsync: boolean;
  catalog: string | null;
  schema: string;
  sql: string;
  tmp_table_name: string;
  select_as_cta: boolean;
  ctas_method: string;
  queryLimit: number;
  expand_data: boolean;
}
export interface Column {
  name: string;
  type: string;
  is_dttm: boolean;
  type_generic: number;
  is_hidden: boolean;
  column_name: string;
}
export interface QueryExecuteResponse {
  status: string;
  query_id: string;
  data: any[];
  columns: Column[];
  selected_columns: Column[];
  expanded_columns: Column[];
  query: any;
}

export interface QueryAdhocState {
  isLoading: boolean | null;
  sql: string | null;
  queryResult: QueryExecuteResponse | null;
  error: string | null;
}
