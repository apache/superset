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
  DatasourceType,
  ExtraFormData,
  GenericDataType,
  JsonObject,
  NativeFilterScope,
  NativeFiltersState,
} from '@superset-ui/core';
import { Dataset } from '@superset-ui/chart-controls';
import { chart } from 'src/components/Chart/chartReducer';
import componentTypes from 'src/dashboard/util/componentTypes';
import Database from 'src/types/Database';
import { UrlParamEntries } from 'src/utils/urlUtils';

import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { ChartState } from '../explore/types';

export type { Dashboard } from 'src/types/Dashboard';

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

export enum FilterBarOrientation {
  Vertical = 'VERTICAL',
  Horizontal = 'HORIZONTAL',
}

// chart's cross filter scoping can have its custom value or point to the global configuration
export const GLOBAL_SCOPE_POINTER = 'global';
export type GlobalScopePointer = typeof GLOBAL_SCOPE_POINTER;
export type ChartCrossFiltersConfig = {
  scope: NativeFilterScope | GlobalScopePointer;
  chartsInScope: number[];
};
export type GlobalChartCrossFilterConfig = {
  scope: NativeFilterScope;
  chartsInScope: number[];
};
export const isCrossFilterScopeGlobal = (
  scope: NativeFilterScope | GlobalScopePointer,
): scope is GlobalScopePointer => scope === GLOBAL_SCOPE_POINTER;

export type ChartConfiguration = {
  [chartId: number]: {
    id: number;
    crossFilters: ChartCrossFiltersConfig;
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
  dashboardIsSaving: boolean;
  colorScheme: string;
  sliceIds: number[];
  directPathLastUpdated: number;
  focusedFilterField?: {
    chartId: number;
    column: string;
  };
  overwriteConfirmMetadata?: {
    updatedAt: string;
    updatedBy: string;
    overwriteConfirmItems: {
      keyPath: string;
      oldValue: string;
      newValue: string;
    }[];
    dashboardId: number;
    data: JsonObject;
  };
};
export type DashboardInfo = {
  id: number;
  common: {
    conf: JsonObject;
  };
  userId: string;
  dash_edit_perm: boolean;
  json_metadata: string;
  metadata: {
    native_filter_configuration: JsonObject;
    chart_configuration: ChartConfiguration;
    global_chart_configuration: GlobalChartCrossFilterConfig;
    color_scheme: string;
    color_namespace: string;
    color_scheme_domain: string[];
    label_colors: JsonObject;
    shared_label_colors: JsonObject;
    cross_filters_enabled: boolean;
  };
  crossFiltersEnabled: boolean;
  filterBarOrientation: FilterBarOrientation;
};

export type ChartsState = { [key: string]: Chart };

export type Datasource = Dataset & {
  uid: string;
  column_types: GenericDataType[];
  table_name: string;
  database?: Database;
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
export type ComponentType = (typeof componentTypes)[ComponentTypesKeys];

/** State of dashboardLayout item in redux */
export type LayoutItem = {
  children: string[];
  parents?: string[];
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

export type Slice = {
  slice_id: number;
  slice_name: string;
  description: string;
  description_markdown: string;
  form_data: any;
  slice_url: string;
  viz_type: string;
  thumbnail_url: string;
  changed_on: number;
  changed_on_humanized: string;
  modified: string;
  datasource_id: number;
  datasource_type: DatasourceType;
  datasource_url: string;
  datasource_name: string;
  owners: { id: number }[];
  created_by: { id: number };
};

export enum MenuKeys {
  DownloadAsImage = 'download_as_image',
  ExploreChart = 'explore_chart',
  ExportCsv = 'export_csv',
  ExportPivotCsv = 'export_pivot_csv',
  ExportFullCsv = 'export_full_csv',
  ExportXlsx = 'export_xlsx',
  ExportFullXlsx = 'export_full_xlsx',
  ForceRefresh = 'force_refresh',
  Fullscreen = 'fullscreen',
  ToggleChartDescription = 'toggle_chart_description',
  ViewQuery = 'view_query',
  ViewResults = 'view_results',
  DrillToDetail = 'drill_to_detail',
  CrossFilterScoping = 'cross_filter_scoping',
  Share = 'share',
  ShareByEmail = 'share_by_email',
  CopyLink = 'copy_link',
  Download = 'download',
  SaveModal = 'save_modal',
  RefreshDashboard = 'refresh_dashboard',
  AutorefreshModal = 'autorefresh_modal',
  SetFilterMapping = 'set_filter_mapping',
  EditProperties = 'edit_properties',
  EditCss = 'edit_css',
  ToggleFullscreen = 'toggle_fullscreen',
  ManageEmbedded = 'manage_embedded',
  ManageEmailReports = 'manage_email_reports',
}
