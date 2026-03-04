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
  ChartCustomization,
  ChartCustomizationDivider,
  ChartProps,
  DataMaskStateWithId,
  DatasourceType,
  ExtraFormData,
  JsonObject,
  NativeFilterScope,
  NativeFiltersState,
  NativeFilterTarget,
  ColumnOption,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { Dataset } from '@superset-ui/chart-controls';
import { chart } from 'src/components/Chart/chartReducer';
import componentTypes from 'src/dashboard/util/componentTypes';
import Database from 'src/types/Database';
import { UrlParamEntries } from 'src/utils/urlUtils';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import Owner from 'src/types/Owner';
import Role from 'src/types/Role';
import { TagType } from 'src/components/Tag/TagType';
import { ChartState } from '../explore/types';
import { AutoRefreshStatus } from './types/autoRefresh';

export type { Dashboard } from 'src/types/Dashboard';

export interface ExtendedNativeFilterScope extends NativeFilterScope {
  selectedLayers?: string[];
}

/** Configuration item for native filters and chart customizations */
export interface FilterConfigItem extends JsonObject {
  id: string;
  chartsInScope?: number[];
  tabsInScope?: string[];
  type?: string;
  targets?: Partial<NativeFilterTarget>[];
}

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
    color_scheme: string;
    slice_id: number;
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
export type DashboardLayoutState = {
  past: DashboardLayout[];
  present: DashboardLayout;
  future: DashboardLayout[];
};
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
  nativeFiltersBarOpen?: boolean;
  css?: string;
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
  chartStates?: Record<string, JsonObject>;
  autoRefreshStatus?: AutoRefreshStatus;
  autoRefreshPaused?: boolean;
  autoRefreshPausedByTab?: boolean;
  lastSuccessfulRefresh?: number | null;
  lastAutoRefreshTime?: number | null;
  lastRefreshError?: string | null;
  refreshErrorCount?: number;
  autoRefreshFetchStartTime?: number | null;
  autoRefreshPauseOnInactiveTab?: boolean;
  labelsColorMapMustSync?: boolean;
  sharedLabelsColorsMustSync?: boolean;
  maxUndoHistoryExceeded?: boolean;
  updatedColorScheme?: boolean;
  inactiveTabs?: string[];
  datasetsStatus?: ResourceStatus;
  expandedSlices?: Record<number, boolean>;
  refreshFrequency: number;
  shouldPersistRefreshFrequency?: boolean;
  colorNamespace?: string;
  isStarred?: boolean;
  lastRefreshTime?: number;
  tabActivationTimes?: Record<string, number>;
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
    native_filter_configuration: FilterConfigItem[];
    chart_configuration: ChartConfiguration;
    global_chart_configuration: GlobalChartCrossFilterConfig;
    color_scheme: string;
    color_namespace: string;
    color_scheme_domain: string[];
    label_colors: JsonObject;
    shared_label_colors: string[];
    map_label_colors: JsonObject;
    cross_filters_enabled: boolean;
    chart_customization_config?: (
      | ChartCustomization
      | ChartCustomizationDivider
    )[];
    timed_refresh_immune_slices?: number[];
    refresh_frequency?: number;
    positions?: JsonObject;
    filter_scopes?: JsonObject;
  };
  crossFiltersEnabled: boolean;
  filterBarOrientation: FilterBarOrientation;
  created_on_delta_humanized: string;
  changed_on_delta_humanized: string;
  changed_by?: Owner;
  created_by?: Owner;
  owners: Owner[];
  chartCustomizationData?: { [itemId: string]: ColumnOption[] };
  chartCustomizationLoading?: { [itemId: string]: boolean };
  pendingChartCustomizations?: Record<string, ChartCustomization>;
  theme?: {
    id: number;
    name: string;
  } | null;
  theme_id?: number | null;
  css?: string;
  slug?: string;
  last_modified_time: number;
  certified_by?: string;
  certification_details?: string;
  roles?: Role[];
  tags?: TagType[];
  is_managed_externally?: boolean;
  dash_share_perm?: boolean;
  dash_save_perm?: boolean;
  dash_export_perm?: boolean;
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
export type GetState = () => RootState;

export type RootState = {
  datasources: DatasourcesState;
  sliceEntities: SliceEntitiesState;
  charts: ChartsState;
  dashboardLayout: DashboardLayoutState;
  dashboardFilters: JsonObject;
  dashboardState: DashboardState;
  dashboardInfo: DashboardInfo;
  dataMask: DataMaskStateWithId;
  impressionId: string;
  nativeFilters: NativeFiltersState;
  user: UserWithPermissionsAndRoles;
  common?: { conf: JsonObject };
  lastModifiedTime: number;
};

/** State of dashboardLayout in redux */
export type Layout = { [key: string]: LayoutItem };

/** State of charts in redux */
export type Charts = { [key: number]: Chart };

type ComponentTypesKeys = keyof typeof componentTypes;
export type ComponentType = (typeof componentTypes)[ComponentTypesKeys];

export type LayoutItemMeta = {
  chartId?: number;
  defaultText?: string;
  height?: number;
  placeholder?: string;
  sliceName?: string;
  sliceNameOverride?: string;
  text?: string;
  uuid?: string;
  width?: number;
  headerSize?: string;
  /** Markdown source code for markdown components */
  code?: string;
  /** Background style value for columns and rows */
  background?: string;
  /** Allow additional meta properties used by different component types */
  [key: string]: unknown;
};

/** State of dashboardLayout item in redux */
export type LayoutItem = {
  children: string[];
  parents?: string[];
  type: ComponentType;
  id: string;
  meta: LayoutItemMeta;
};

/** Loose component type used by utility and factory functions */
export interface DashboardComponent {
  id: string;
  type: string;
  children: string[];
  parents?: string[];
  meta: LayoutItemMeta;
}

/** Map of dashboard components keyed by ID */
export type DashboardComponentMap = { [id: string]: DashboardComponent };

type ActiveFilter = {
  filterType?: string;
  targets: Partial<NativeFilterTarget>[];
  scope: number[];
  values: ExtraFormData;
  layerScope?: {
    [chartId: number]: number[];
  };
};

export type ActiveFilters = {
  [key: string]: ActiveFilter;
};

export interface DashboardPermalinkState {
  dataMask: DataMaskStateWithId;
  activeTabs: string[];
  anchor: string;
  urlParams?: UrlParamEntries;
  chartStates?: Record<string, JsonObject>;
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

export interface SliceEntitiesState {
  slices: Record<number, Slice>;
  isLoading: boolean;
  errorMessage: string | null;
  lastUpdated: number;
}

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
  ExportPivotXlsx = 'export_pivot_xlsx',
  EmbedCode = 'embed_code',
}
