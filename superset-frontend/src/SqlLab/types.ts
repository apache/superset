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
import { SupersetError } from 'src/components/ErrorMessage/types';
import { CtasEnum } from 'src/SqlLab/actions/sqlLab';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { ToastType } from 'src/components/MessageToasts/types';

export type Column = {
  name: string;
  is_date?: boolean;
};

export type QueryState =
  | 'stopped'
  | 'failed'
  | 'pending'
  | 'running'
  | 'scheduled'
  | 'success'
  | 'fetching'
  | 'timed_out';

export type Query = {
  cached: boolean;
  ctas: boolean;
  ctas_method?: keyof typeof CtasEnum;
  dbId: number;
  errors?: SupersetError[];
  errorMessage: string | null;
  extra: {
    progress: string | null;
  };
  id: string;
  isDataPreview: boolean;
  link?: string;
  progress: number;
  results: {
    displayLimitReached: boolean;
    columns: Column[];
    data: Record<string, unknown>[];
    expanded_columns: Column[];
    selected_columns: Column[];
    query: { limit: number };
  };
  resultsKey: string | null;
  schema: string;
  sql: string;
  sqlEditorId: string;
  state: QueryState;
  tab: string | null;
  tempSchema: string | null;
  tempTable: string;
  trackingUrl: string | null;
  templateParams: any;
  rows: number;
  queryLimit: number;
  limitingFactor: string;
  endDttm: number;
  duration: string;
  startDttm: number;
  time: Record<string, any>;
  user: Record<string, any>;
  userId: number;
  db: Record<string, any>;
  started: string;
  querylink: Record<string, any>;
  queryId: number;
  executedSql: string;
  output: string | Record<string, any>;
  actions: Record<string, any>;
};

export interface QueryEditor {
  dbId?: number;
  title: string;
  schema: string;
  autorun: boolean;
  sql: string;
  remoteId: number | null;
  validationResult?: {
    completed: boolean;
    errors: SupersetError[];
  };
}

export type toastState = {
  id: string;
  toastType: ToastType;
  text: string;
  duration: number;
  noDuplicate: boolean;
};

export type RootState = {
  sqlLab: {
    activeSouthPaneTab: string | number; // default is string; action.newQuery.id is number
    alerts: any[];
    databases: Record<string, any>;
    offline: boolean;
    queries: Query[];
    queryEditors: QueryEditor[];
    tabHistory: string[]; // default is activeTab ? [activeTab.id.toString()] : []
    tables: Record<string, any>[];
    queriesLastUpdate: number;
    user: UserWithPermissionsAndRoles;
    errorMessage: string | null;
  };
  localStorageUsageInKilobytes: number;
  messageToasts: toastState[];
  common: {};
};
