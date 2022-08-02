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
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { ToastType } from 'src/components/MessageToasts/types';
import { Dataset } from '@superset-ui/chart-controls';
import { Query, QueryResponse } from '@superset-ui/core';
import { ExploreRootState } from 'src/explore/types';

export type ExploreDatasource = Dataset | QueryResponse;

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

export type SqlLabRootState = {
  sqlLab: {
    activeSouthPaneTab: string | number; // default is string; action.newQuery.id is number
    alerts: any[];
    databases: Record<string, any>;
    dbConnect: boolean;
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

export type SqlLabExploreRootState = SqlLabRootState | ExploreRootState;

export const getInitialState = (state: SqlLabExploreRootState) => {
  if (state.hasOwnProperty('sqlLab')) {
    const {
      sqlLab: { user },
    } = state as SqlLabRootState;
    return user;
  }

  const {
    explore: { user },
  } = state as ExploreRootState;
  return user;
};

export enum DatasetRadioState {
  SAVE_NEW = 1,
  OVERWRITE_DATASET = 2,
}

export const EXPLORE_CHART_DEFAULT = {
  metrics: [],
  groupby: [],
  time_range: 'No filter',
  viz_type: 'table',
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
