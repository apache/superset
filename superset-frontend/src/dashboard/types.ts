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
  ExtraFormData,
  GenericDataType,
  JsonObject,
} from '@superset-ui/core';
import { DatasourceMeta } from '@superset-ui/chart-controls';
import { chart } from 'src/chart/chartReducer';
import componentTypes from 'src/dashboard/util/componentTypes';

import { DataMaskStateWithId } from '../dataMask/types';
import { NativeFiltersState } from './reducers/types';
import { ChartState } from '../explore/types';

export { Dashboard } from 'src/types/Dashboard';

export type ChartReducerInitialState = typeof chart;

// chart query built from initialState
// Ref: https://github.com/apache/superset/blob/dcac860f3e5528ecbc39e58f045c7388adb5c3d0/superset-frontend/src/dashboard/reducers/getInitialState.js#L120
export interface ChartQueryPayload extends Partial<ChartReducerInitialState> {
  id: number;
  formData: ChartProps['formData'];
  form_data?: ChartProps['rawFormData'];
  [key: string]: unknown;
}

/** Chart state of redux */
export type Chart = ChartState & {
  formData: {
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
  metadata: {
    show_native_filters: boolean;
    chart_configuration: JsonObject;
  };
};

export type ChartsState = { [key: string]: Chart };

export type Datasource = DatasourceMeta & {
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
