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
  ChartProps,
  DataMaskStateWithId,
  ExtraFormData,
  GenericDataType,
  JsonObject,
  NativeFiltersState,
} from '@superset-ui/core';
import { Dataset } from '@superset-ui/chart-controls';
import { chart } from 'src/components/Chart/chartReducer';
import componentTypes from 'src/dashboard/util/componentTypes';
import { UrlParamEntries } from 'src/utils/urlUtils';

import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { ChartState } from '../explore/types';

export { Dashboard } from 'src/types/Dashboard';

export type ChartReducerInitialState = typeof chart;

// chart query built from initialState
// Ref: https://github.com/apache/superset/blob/dcac860f3e5528ecbc39e58f045c7388adb5c3d0/superset-frontend/src/dashboard/reducers/getInitialState.js#L120
export interface ChartQueryPayload extends Partial<ChartReducerInitialState> {
  id: number;
  form_data?: ChartProps['rawFormData'];
  [key: string]: unknown;
}

/** Chart state of redux */
export type Chart = ChartState & {
  form_data: {
    viz_type: string;
    datasource: string;
  };
};

export type ActiveTabs = string[];
export type DashboardLayout = { [key: string]: LayoutItem };
export type DashboardLayoutState = { present: DashboardLayout };
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
  colorScheme: string;
  sliceIds: number[];
  directPathLastUpdated: number;
  focusedFilterField?: {
    chartId: number;
    column: string;
  };
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
    color_scheme: string;
    color_namespace: string;
    color_scheme_domain: string[];
    label_colors: JsonObject;
    shared_label_colors: JsonObject;
  };
};

export type ChartsState = { [key: string]: Chart };

export type Datasource = Dataset & {
  uid: string;
  column_types: GenericDataType[];
  table_name: string;
};
export type DatasourcesState = {
  [key: string]: Datasource;
};

/** Root state of redux */
export type RootState = {
  datasources: DatasourcesState;
  sliceEntities: JsonObject;
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

/** State of dashboardLayout in redux */
export type Layout = { [key: string]: LayoutItem };

/** State of charts in redux */
export type Charts = { [key: number]: Chart };

type ComponentTypesKeys = keyof typeof componentTypes;
export type ComponentType = typeof componentTypes[ComponentTypesKeys];

/** State of dashboardLayout item in redux */
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
