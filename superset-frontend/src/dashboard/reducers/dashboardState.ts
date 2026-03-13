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
/* eslint-disable camelcase */
import { JsonObject } from '@superset-ui/core';
import {
  ADD_SLICE,
  ON_CHANGE,
  ON_SAVE,
  REMOVE_SLICE,
  SET_COLOR_SCHEME,
  SET_EDIT_MODE,
  SET_MAX_UNDO_HISTORY_EXCEEDED,
  SET_UNSAVED_CHANGES,
  SHOW_BUILDER_PANE,
  TOGGLE_EXPAND_SLICE,
  TOGGLE_FAVE_STAR,
  TOGGLE_PUBLISHED,
  SET_REFRESH_FREQUENCY,
  ON_REFRESH,
  ON_REFRESH_SUCCESS,
  SET_DIRECT_PATH,
  SET_FOCUSED_FILTER_FIELD,
  UNSET_FOCUSED_FILTER_FIELD,
  SET_ACTIVE_TAB,
  SET_ACTIVE_TABS,
  SET_FULL_SIZE_CHART_ID,
  ON_FILTERS_REFRESH,
  ON_FILTERS_REFRESH_SUCCESS,
  SET_DATASETS_STATUS,
  SET_OVERRIDE_CONFIRM,
  SAVE_DASHBOARD_STARTED,
  SAVE_DASHBOARD_FINISHED,
  SET_DASHBOARD_LABELS_COLORMAP_SYNCABLE,
  SET_DASHBOARD_LABELS_COLORMAP_SYNCED,
  SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCABLE,
  SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCED,
  TOGGLE_NATIVE_FILTERS_BAR,
  UPDATE_CHART_STATE,
  REMOVE_CHART_STATE,
  RESTORE_CHART_STATES,
  CLEAR_ALL_CHART_STATES,
} from '../actions/dashboardState';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';
import {
  SET_AUTO_REFRESH_STATUS,
  SET_AUTO_REFRESH_PAUSED,
  SET_AUTO_REFRESH_PAUSED_BY_TAB,
  RECORD_AUTO_REFRESH_SUCCESS,
  RECORD_AUTO_REFRESH_ERROR,
  SET_AUTO_REFRESH_FETCH_START_TIME,
  SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB,
} from '../actions/autoRefresh';
import { AutoRefreshStatus, ERROR_THRESHOLD_COUNT } from '../types/autoRefresh';

interface ChartStateEntry {
  chartId: number;
  vizType: string;
  state: JsonObject;
  lastModified: number;
}

interface DashboardStateShape {
  sliceIds?: number[];
  isStarred?: boolean;
  isPublished?: boolean;
  editMode?: boolean;
  maxUndoHistoryExceeded?: boolean;
  colorScheme?: string;
  updatedColorScheme?: boolean;
  labelsColorMapMustSync?: boolean;
  sharedLabelsColorsMustSync?: boolean;
  expandedSlices?: Record<number, boolean>;
  hasUnsavedChanges?: boolean;
  dashboardIsSaving?: boolean;
  lastModifiedTime?: number;
  refreshFrequency?: number;
  shouldPersistRefreshFrequency?: boolean;
  isRefreshing?: boolean;
  isFiltersRefreshing?: boolean;
  lastRefreshTime?: number;
  directPathToChild?: string[];
  directPathLastUpdated?: number;
  activeTabs?: string[];
  inactiveTabs?: string[];
  tabActivationTimes?: Record<string, number>;
  focusedFilterField?: { chartId: number; column: string } | null;
  fullSizeChartId?: number | null;
  datasetsStatus?: string;
  overwriteConfirmMetadata?: JsonObject;
  nativeFiltersBarOpen?: boolean;
  chartStates?: Record<string, ChartStateEntry>;
  css?: string;
  preselectNativeFilters?: JsonObject;
  autoRefreshStatus?: AutoRefreshStatus;
  autoRefreshPaused?: boolean;
  autoRefreshPausedByTab?: boolean;
  lastSuccessfulRefresh?: number | null;
  lastAutoRefreshTime?: number | null;
  lastRefreshError?: string | null;
  refreshErrorCount?: number;
  autoRefreshFetchStartTime?: number | null;
  autoRefreshPauseOnInactiveTab?: boolean;
  [key: string]: unknown;
}

interface Slice {
  slice_id: number;
  [key: string]: unknown;
}

interface DashboardStateAction {
  type: string;
  slice?: Slice;
  sliceId?: number;
  isStarred?: boolean;
  isPublished?: boolean;
  editMode?: boolean;
  colorScheme?: string;
  refreshFrequency?: number;
  isPersistent?: boolean;
  path?: string[];
  chartId?: number;
  column?: string;
  lastModifiedTime?: number;
  activeTabs?: string[];
  inactiveTabs?: string[];
  prevTabId?: string;
  overwriteConfirmMetadata?: JsonObject;
  isOpen?: boolean;
  vizType?: string;
  chartState?: JsonObject;
  lastModified?: number;
  chartStates?: Record<string, ChartStateEntry>;
  status?: string;
  isPaused?: boolean;
  isPausedByTab?: boolean;
  timestamp?: number | null;
  error?: string | null;
  pauseOnInactiveTab?: boolean;
  payload?: {
    maxUndoHistoryExceeded?: boolean;
    hasUnsavedChanges?: boolean;
    [key: string]: unknown;
  };
  data?: {
    dashboardState: DashboardStateShape;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export default function dashboardStateReducer(
  state: DashboardStateShape = {},
  action: DashboardStateAction,
): DashboardStateShape {
  const actionHandlers: Record<string, () => DashboardStateShape> = {
    [HYDRATE_DASHBOARD](): DashboardStateShape {
      const hydratedState: DashboardStateShape = {
        ...state,
        ...action.data?.dashboardState,
      };
      // Initialize tab activation times for initially active tabs
      if (hydratedState.activeTabs && hydratedState.activeTabs.length > 0) {
        const now = Date.now();
        hydratedState.tabActivationTimes =
          hydratedState.tabActivationTimes || {};
        hydratedState.activeTabs.forEach((tabId: string) => {
          hydratedState.tabActivationTimes![tabId] = now;
        });
      }
      return hydratedState;
    },
    [ADD_SLICE](): DashboardStateShape {
      const updatedSliceIds = new Set(state.sliceIds);
      updatedSliceIds.add(action.slice!.slice_id);
      return {
        ...state,
        sliceIds: Array.from(updatedSliceIds),
      };
    },
    [REMOVE_SLICE](): DashboardStateShape {
      const { sliceId } = action;
      const updatedSliceIds = new Set(state.sliceIds);
      updatedSliceIds.delete(sliceId!);

      return {
        ...state,
        sliceIds: Array.from(updatedSliceIds),
      };
    },
    [TOGGLE_FAVE_STAR](): DashboardStateShape {
      return { ...state, isStarred: action.isStarred };
    },
    [TOGGLE_PUBLISHED](): DashboardStateShape {
      return { ...state, isPublished: action.isPublished };
    },
    [SET_EDIT_MODE](): DashboardStateShape {
      return {
        ...state,
        editMode: action.editMode,
      };
    },
    [SET_MAX_UNDO_HISTORY_EXCEEDED](): DashboardStateShape {
      const { maxUndoHistoryExceeded = true } = action.payload || {};
      return { ...state, maxUndoHistoryExceeded };
    },
    [SHOW_BUILDER_PANE](): DashboardStateShape {
      return { ...state };
    },
    [SET_COLOR_SCHEME](): DashboardStateShape {
      return {
        ...state,
        colorScheme: action.colorScheme,
        updatedColorScheme: true,
      };
    },
    [SET_DASHBOARD_LABELS_COLORMAP_SYNCABLE](): DashboardStateShape {
      return {
        ...state,
        labelsColorMapMustSync: true,
      };
    },
    [SET_DASHBOARD_LABELS_COLORMAP_SYNCED](): DashboardStateShape {
      return {
        ...state,
        labelsColorMapMustSync: false,
      };
    },
    [SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCABLE](): DashboardStateShape {
      return {
        ...state,
        sharedLabelsColorsMustSync: true,
      };
    },
    [SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCED](): DashboardStateShape {
      return {
        ...state,
        sharedLabelsColorsMustSync: false,
      };
    },
    [TOGGLE_EXPAND_SLICE](): DashboardStateShape {
      const updatedExpandedSlices = { ...state.expandedSlices };
      const { sliceId } = action;
      if (sliceId !== undefined) {
        if (updatedExpandedSlices[sliceId]) {
          delete updatedExpandedSlices[sliceId];
        } else {
          updatedExpandedSlices[sliceId] = true;
        }
      }
      return { ...state, expandedSlices: updatedExpandedSlices };
    },
    [ON_CHANGE](): DashboardStateShape {
      return { ...state, hasUnsavedChanges: true };
    },
    [SAVE_DASHBOARD_STARTED](): DashboardStateShape {
      return {
        ...state,
        dashboardIsSaving: true,
      };
    },
    [SAVE_DASHBOARD_FINISHED](): DashboardStateShape {
      return {
        ...state,
        dashboardIsSaving: false,
      };
    },
    [ON_SAVE](): DashboardStateShape {
      return {
        ...state,
        hasUnsavedChanges: false,
        maxUndoHistoryExceeded: false,
        editMode: false,
        updatedColorScheme: false,
        // server-side returns last_modified_time for latest change
        lastModifiedTime: action.lastModifiedTime,
      };
    },
    [SET_UNSAVED_CHANGES](): DashboardStateShape {
      const { hasUnsavedChanges } = action.payload || {};
      return { ...state, hasUnsavedChanges };
    },
    [SET_REFRESH_FREQUENCY](): DashboardStateShape {
      return {
        ...state,
        refreshFrequency: action.refreshFrequency,
        shouldPersistRefreshFrequency: action.isPersistent,
        hasUnsavedChanges: action.isPersistent,
      };
    },
    [ON_REFRESH](): DashboardStateShape {
      return {
        ...state,
        isRefreshing: true,
        lastRefreshTime: Date.now(),
      };
    },
    [ON_FILTERS_REFRESH](): DashboardStateShape {
      return {
        ...state,
        isFiltersRefreshing: true,
      };
    },
    [ON_FILTERS_REFRESH_SUCCESS](): DashboardStateShape {
      return {
        ...state,
        isFiltersRefreshing: false,
      };
    },
    [ON_REFRESH_SUCCESS](): DashboardStateShape {
      return {
        ...state,
        isRefreshing: false,
      };
    },
    [SET_DIRECT_PATH](): DashboardStateShape {
      return {
        ...state,
        directPathToChild: action.path,
        directPathLastUpdated: Date.now(),
      };
    },
    [SET_ACTIVE_TAB](): DashboardStateShape {
      const toRemoveFromActive = new Set(
        (action.inactiveTabs || []).concat(action.prevTabId || ''),
      );
      const newActiveTabs = new Set(
        (state.activeTabs || []).filter(tab => !toRemoveFromActive.has(tab)),
      );

      const activeTabsSet = new Set(action.activeTabs || []);
      const inactiveTabsSet = new Set(action.inactiveTabs || []);
      const newInactiveTabs = new Set(
        (state.inactiveTabs || []).filter(tab => !activeTabsSet.has(tab)),
      );
      inactiveTabsSet.forEach(tab => newInactiveTabs.add(tab));

      // Track when each tab was last activated
      const tabActivationTimes: Record<string, number> = {
        ...state.tabActivationTimes,
      };
      (action.activeTabs || []).forEach((tabId: string) => {
        tabActivationTimes[tabId] = Date.now();
      });

      (action.activeTabs || []).forEach(tab => newActiveTabs.add(tab));

      return {
        ...state,
        inactiveTabs: Array.from(newInactiveTabs),
        activeTabs: Array.from(newActiveTabs),
        tabActivationTimes,
      };
    },
    [SET_ACTIVE_TABS](): DashboardStateShape {
      return {
        ...state,
        activeTabs: action.activeTabs,
      };
    },
    [SET_OVERRIDE_CONFIRM](): DashboardStateShape {
      return {
        ...state,
        overwriteConfirmMetadata: action.overwriteConfirmMetadata,
      };
    },
    [SET_FOCUSED_FILTER_FIELD](): DashboardStateShape {
      return {
        ...state,
        focusedFilterField: {
          chartId: action.chartId!,
          column: action.column!,
        },
      };
    },
    [UNSET_FOCUSED_FILTER_FIELD](): DashboardStateShape {
      // dashboard only has 1 focused filter field at a time,
      // but when user switch different filter boxes,
      // browser didn't always fire onBlur and onFocus events in order.
      if (
        !state.focusedFilterField ||
        action.chartId !== state.focusedFilterField.chartId ||
        action.column !== state.focusedFilterField.column
      ) {
        return state;
      }
      return {
        ...state,
        focusedFilterField: null,
      };
    },
    [SET_FULL_SIZE_CHART_ID](): DashboardStateShape {
      return {
        ...state,
        fullSizeChartId: action.chartId,
      };
    },
    [SET_DATASETS_STATUS](): DashboardStateShape {
      return {
        ...state,
        datasetsStatus: action.status,
      };
    },
    [TOGGLE_NATIVE_FILTERS_BAR](): DashboardStateShape {
      return {
        ...state,
        nativeFiltersBarOpen: action.isOpen,
      };
    },
    [UPDATE_CHART_STATE](): DashboardStateShape {
      const { chartId, vizType, chartState, lastModified } = action;
      return {
        ...state,
        chartStates: {
          ...state.chartStates,
          [chartId!]: {
            chartId: chartId!,
            vizType: vizType!,
            state: chartState!,
            lastModified: lastModified!,
          },
        },
      };
    },
    [REMOVE_CHART_STATE](): DashboardStateShape {
      const { chartId } = action;
      const updatedChartStates = { ...state.chartStates };
      delete updatedChartStates[chartId!];
      return {
        ...state,
        chartStates: updatedChartStates,
      };
    },
    [RESTORE_CHART_STATES](): DashboardStateShape {
      const { chartStates } = action;
      return {
        ...state,
        chartStates: chartStates || {},
      };
    },
    [CLEAR_ALL_CHART_STATES](): DashboardStateShape {
      return {
        ...state,
        chartStates: {},
      };
    },
    // Auto-refresh status indicator handlers
    [SET_AUTO_REFRESH_STATUS]() {
      return {
        ...state,
        autoRefreshStatus: action.status as AutoRefreshStatus,
      };
    },
    [SET_AUTO_REFRESH_PAUSED]() {
      return {
        ...state,
        autoRefreshPaused: action.isPaused,
      };
    },
    [SET_AUTO_REFRESH_PAUSED_BY_TAB]() {
      return {
        ...state,
        autoRefreshPausedByTab: action.isPausedByTab,
      };
    },
    [RECORD_AUTO_REFRESH_SUCCESS]() {
      return {
        ...state,
        autoRefreshStatus: AutoRefreshStatus.Success,
        lastSuccessfulRefresh: action.timestamp,
        lastAutoRefreshTime: action.timestamp,
        lastRefreshError: null,
        refreshErrorCount: 0,
      };
    },
    [RECORD_AUTO_REFRESH_ERROR]() {
      const newErrorCount = (state.refreshErrorCount || 0) + 1;
      // Determine status based on error count threshold
      // 1 error = Delayed (yellow), 2+ errors = Error (red)
      const newStatus =
        newErrorCount >= ERROR_THRESHOLD_COUNT
          ? AutoRefreshStatus.Error
          : AutoRefreshStatus.Delayed;
      return {
        ...state,
        autoRefreshStatus: newStatus,
        lastRefreshError: action.error,
        refreshErrorCount: newErrorCount,
        lastAutoRefreshTime: action.timestamp,
      };
    },
    [SET_AUTO_REFRESH_FETCH_START_TIME]() {
      return {
        ...state,
        autoRefreshFetchStartTime: action.timestamp,
      };
    },
    [SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB]() {
      return {
        ...state,
        autoRefreshPauseOnInactiveTab: action.pauseOnInactiveTab,
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
