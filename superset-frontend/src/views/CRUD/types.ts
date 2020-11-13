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
import Owner from 'src/types/Owner';

export type FavoriteStatus = {
  [id: number]: boolean;
};

export interface DashboardTableProps {
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  search: string;
  user?: User;
  mine: Array<Dashboard>;
}

export interface Dashboard {
  changed_by_name: string;
  changed_by_url: string;
  changed_on_delta_humanized: string;
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
  database: {
    database_name: string;
    id: number;
  };
  db_id: number;
  description?: string;
  id: number;
  label: string;
  schema: string;
  sql: string;
  sql_tables?: { catalog?: string; schema: string; table: string }[];
};
