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
import {
  DataMaskStateWithId,
  ExtraFormData,
  GenericDataType,
  JsonObject,
  NativeFiltersState,
  NativeFilterScope,
  QueryFormData,
} from '@superset-ui/core';
import { Dataset } from '@superset-ui/chart-controls';
import componentTypes from 'src/dashboard/util/componentTypes';
import { UrlParamEntries } from 'src/utils/urlUtils';

import {
  CommonBootstrapData,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { ChartState, Slice } from '../explore/types';

export { Dashboard } from 'src/types/Dashboard';

/** Redux shape for state.charts */
export type Chart = ChartState & {
  form_data: QueryFormData & {
    url_params: JsonObject;
  };
};

export type ChartsState = { [key: string]: Chart };

/** Redux shape for state.dashboardState */
export type ActiveTabs = string[];
export type DashboardState = {
  preselectNativeFilters?: JsonObject;
  editMode: boolean;
  isPublished: boolean;
  directPathToChild: string[];
  activeTabs: ActiveTabs;
  fullSizeChartId: number | null;
  isRefreshing: boolean;
  isFiltersRefreshing: boolean;
  hasUnsavedChanges: boolean;
};
export type DashboardInfo = {
  id: number;
  common: {
    flash_messages: string[];
    conf: JsonObject;
  };
  userId: string;
  dash_edit_perm: boolean;
  json_metadata: string;
  metadata: {
    native_filter_configuration: JsonObject;
    show_native_filters: boolean;
    chart_configuration: JsonObject;
  };
};

/** Redux shape for state.datasources */
export type Datasource = Dataset & {
  uid: string;
  column_types: GenericDataType[];
  table_name: string;
};

export type DatasourcesState = {
  [key: string]: Datasource;
};

/** Redux shape for state.dashboardLayout */
type ComponentTypesKeys = keyof typeof componentTypes;
export type ComponentType = typeof componentTypes[ComponentTypesKeys];
export type LayoutItem = {
  children: string[];
  parents: string[];
  type: ComponentType;
  id: string;
  meta: {
    chartId: number;
    defaultText?: string;
    height: number;
    placeholder?: string;
    sliceName?: string;
    sliceNameOverride?: string;
    text?: string;
    uuid: string;
    width: number;
  };
};

export type DashboardLayout = { [key: string]: LayoutItem };
export type DashboardLayoutState = { present: DashboardLayout };

/** Redux shape for state.sliceEntities */
export type SliceEntities = {
  slices: Record<string, Slice>;
  isLoading: boolean;
  errorMessage: string | null;
  lastUpdated: number;
};

/** Redux root state */
export type RootState = {
  common: CommonBootstrapData;
  datasources: DatasourcesState;
  sliceEntities: SliceEntities;
  charts: ChartsState;
  dashboardLayout: DashboardLayoutState;
  dashboardFilters: {};
  dashboardState: DashboardState;
  dashboardInfo: DashboardInfo;
  dataMask: DataMaskStateWithId;
  impressionId: string;
  nativeFilters: NativeFiltersState;
  user: UserWithPermissionsAndRoles;
};

type ActiveFilter = {
  scope: number[];
  values: ExtraFormData;
};

export type ActiveFilters = {
  [key: string]: ActiveFilter;
};

export interface DashboardPermalinkState {
  dataMask: DataMaskStateWithId;
  activeTabs: string[];
  anchor: string;
  urlParams?: UrlParamEntries;
}

export interface DashboardPermalinkValue {
  dashboardId: string;
  state: DashboardPermalinkState;
}

export type EmbeddedDashboard = {
  uuid: string;
  dashboard_id: string;
  allowed_domains: string[];
};

export type ChartConfiguration = {
  [chartId: number]: {
    id: number;
    crossFilters: {
      scope: NativeFilterScope;
    };
  };
};

export type FilterSetFullData = {
  changed_by_fk: string | null;
  changed_on: string | null;
  created_by_fk: string | null;
  created_on: string | null;
  dashboard_id: number;
  description: string | null;
  name: string;
  owner_id: number;
  owner_type: string;
  params: JsonObject;
};
