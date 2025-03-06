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
import { QueryResponse } from '@superset-ui/core';
import {
  CommonBootstrapData,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { ToastType } from 'src/components/MessageToasts/types';
import { DropdownButtonProps } from 'src/components/DropdownButton';
import { ButtonProps } from 'src/components/Button';
import type { TableMetaData } from 'src/hooks/apiResources';

export type QueryButtonProps = DropdownButtonProps | ButtonProps;

// Object as Dictionary (associative array) with Query id as the key and type Query as the value
export type QueryDictionary = {
  [id: string]: QueryResponse;
};

export enum QueryEditorVersion {
  V1 = 1,
}

export const LatestQueryEditorVersion = QueryEditorVersion.V1;

export interface CursorPosition {
  row: number;
  column: number;
}

export interface QueryEditor {
  version: QueryEditorVersion;
  id: string;
  dbId?: number;
  name: string;
  title?: string; // keep it optional for backward compatibility
  catalog?: string | null;
  schema?: string;
  autorun: boolean;
  sql: string;
  remoteId: number | null;
  hideLeftBar?: boolean;
  latestQueryId?: string | null;
  templateParams?: string;
  selectedText?: string;
  queryLimit?: number;
  description?: string;
  loaded?: boolean;
  inLocalStorage?: boolean;
  northPercent?: number;
  southPercent?: number;
  updatedAt?: number;
  cursorPosition?: CursorPosition;
}

export type toastState = {
  id: string;
  toastType: ToastType;
  text: string;
  duration: number;
  noDuplicate: boolean;
};

export type UnsavedQueryEditor = Partial<QueryEditor>;

export interface Table {
  id: string;
  dbId: number;
  catalog: string | null;
  schema: string;
  name: string;
  queryEditorId: QueryEditor['id'];
  dataPreviewQueryId?: string | null;
  expanded: boolean;
  initialized?: boolean;
  inLocalStorage?: boolean;
  persistData?: TableMetaData;
}

export type SqlLabRootState = {
  sqlLab: {
    activeSouthPaneTab: string | number; // default is string; action.newQuery.id is number
    alerts: any[];
    databases: Record<string, any>;
    dbConnect: boolean;
    offline: boolean;
    queries: Record<string, QueryResponse & { inLocalStorage?: boolean }>;
    queryEditors: QueryEditor[];
    tabHistory: string[]; // default is activeTab ? [activeTab.id.toString()] : []
    tables: Table[];
    queriesLastUpdate: number;
    errorMessage: string | null;
    unsavedQueryEditor: UnsavedQueryEditor;
    queryCostEstimates?: Record<string, QueryCostEstimate>;
    editorTabLastUpdatedAt: number;
    lastUpdatedActiveTab: string;
    destroyedQueryEditors: Record<string, number>;
  };
  localStorageUsageInKilobytes: number;
  messageToasts: toastState[];
  user: UserWithPermissionsAndRoles;
  common: CommonBootstrapData;
};

export enum DatasetRadioState {
  SaveNew = 1,
  OverwriteDataset = 2,
}

export const EXPLORE_CHART_DEFAULT = {
  metrics: [],
  groupby: [],
  time_range: 'No filter',
  row_limit: 1000,
};

export interface DatasetOwner {
  first_name: string;
  id: number;
  last_name: string;
  username: string;
}

export interface DatasetOptionAutocomplete {
  value: string;
  datasetId: number;
  owners: [DatasetOwner];
}

export interface SchemaOption {
  value: string;
  label: string;
  title: string;
}

export interface QueryCostEstimate {
  completed: string;
  cost: Record<string, any>[];
  error: string;
}
