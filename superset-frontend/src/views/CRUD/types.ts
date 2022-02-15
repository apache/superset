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
import { User } from 'src/types/bootstrapTypes';
import Database from 'src/types/Database';
import Owner from 'src/types/Owner';

export type FavoriteStatus = {
  [id: number]: boolean;
};

export enum TableTabTypes {
  FAVORITE = 'Favorite',
  MINE = 'Mine',
  EXAMPLES = 'Examples',
}

export type Filters = {
  col: string;
  opr: string;
  value: string | number;
};

export interface DashboardTableProps {
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  search: string;
  user?: User;
  mine: Array<Dashboard>;
  showThumbnails?: boolean;
  featureFlag?: boolean;
  examples: Array<Dashboard>;
}

export interface Dashboard {
  certified_by?: string;
  certification_details?: string;
  changed_by_name: string;
  changed_by_url: string;
  changed_on_delta_humanized?: string;
  changed_on_utc?: string;
  changed_by: string;
  dashboard_title: string;
  slice_name?: string;
  id: number;
  published: boolean;
  url: string;
  thumbnail_url: string;
  owners: Owner[];
  loading?: boolean;
}

export type SavedQueryObject = {
  id: number;
  changed_on: string;
  changed_on_delta_humanized: string;
  database: {
    database_name: string;
    id: number;
  };
  db_id: number;
  description?: string;
  label: string;
  schema: string;
  sql: string | null;
  sql_tables?: { catalog?: string; schema: string; table: string }[];
};

export interface QueryObject {
  id: number;
  changed_on: string;
  database: {
    database_name: string;
  };
  schema: string;
  sql: string;
  executed_sql: string | null;
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

export enum QueryObjectColumns {
  id = 'id',
  changed_on = 'changed_on',
  database = 'database',
  database_name = 'database.database_name',
  schema = 'schema',
  sql = 'sql',
  executed_sql = 'exceuted_sql',
  sql_tables = 'sql_tables',
  status = 'status',
  tab_name = 'tab_name',
  user = 'user',
  user_first_name = 'user.first_name',
  start_time = 'start_time',
  end_time = 'end_time',
  rows = 'rows',
  tmp_table_name = 'tmp_table_name',
  tracking_url = 'tracking_url',
}

export type ImportResourceName =
  | 'chart'
  | 'dashboard'
  | 'database'
  | 'dataset'
  | 'saved_query';

export type DatabaseObject = Partial<Database> &
  Pick<Database, 'sqlalchemy_uri'>;
