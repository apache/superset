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
export interface QueryObject {
  id: number;
  changed_on: string;
  database: {
    database_name: string;
  };
  schema: string;
  sql: string;
  executed_sql: string;
  sql_tables?: { catalog?: string; schema: string; table: string }[];
  status:
    | 'success'
    | 'failed'
    | 'stopped'
    | 'running'
    | 'timed_out'
    | 'scheduled'
    | 'pending';
  tab_name: string;
  user: {
    first_name: string;
    id: number;
    last_name: string;
    username: string;
  };
  start_time: number;
  end_time: number;
  rows: number;
  tmp_table_name: string;
  tracking_url: string;
}
