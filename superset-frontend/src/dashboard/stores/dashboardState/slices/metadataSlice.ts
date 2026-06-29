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

import type { AgGridChartState, JsonObject } from '@superset-ui/core';
import type { StateCreator } from 'zustand';
import type { DashboardChartStates } from 'src/dashboard/types/chartState';
import type { DashboardStateStore } from '../types';

export type FocusedFilterField = { chartId: number; column: string } | null;

export interface MetadataSlice {
  isStarred: boolean;
  maxUndoHistoryExceeded: boolean;
  dashboardIsSaving: boolean;
  lastModifiedTime: number;
  overwriteConfirmMetadata?: JsonObject;
  datasetsStatus?: string;
  colorScheme?: string;
  updatedColorScheme: boolean;
  labelsColorMapMustSync: boolean;
  sharedLabelsColorsMustSync: boolean;
  expandedSlices: Record<number, boolean>;
  focusedFilterField: FocusedFilterField;
  chartStates: DashboardChartStates;
  refreshFrequency: number;
  shouldPersistRefreshFrequency: boolean;
  lastRefreshTime: number;
  preselectNativeFilters?: JsonObject;
  colorNamespace?: string;

  setIsStarred: (isStarred: boolean) => void;
  setMaxUndoHistoryExceeded: (exceeded: boolean) => void;
  setDashboardIsSaving: (saving: boolean) => void;
  setLastModifiedTime: (time: number) => void;
  setOverwriteConfirmMetadata: (metadata: JsonObject | undefined) => void;
  setDatasetsStatus: (status: string) => void;
  setColorScheme: (colorScheme: string) => void;
  setLabelsColorMapMustSync: (mustSync: boolean) => void;
  setSharedLabelsColorsMustSync: (mustSync: boolean) => void;
  toggleExpandSlice: (sliceId: number) => void;
  setFocusedFilterField: (chartId: number, column: string) => void;
  unsetFocusedFilterField: (chartId: number, column: string) => void;
  updateChartState: (
    chartId: number,
    vizType: string,
    state: AgGridChartState,
  ) => void;
  removeChartState: (chartId: number) => void;
  restoreChartStates: (states: DashboardChartStates) => void;
  clearAllChartStates: () => void;
  setRefreshFrequency: (frequency: number, isPersistent?: boolean) => void;
  recordRefreshTime: () => void;
  markSaved: (lastModifiedTime: number) => void;
}

export const metadataInitialState = {
  isStarred: false,
  maxUndoHistoryExceeded: false,
  dashboardIsSaving: false,
  lastModifiedTime: 0,
  overwriteConfirmMetadata: undefined as JsonObject | undefined,
  datasetsStatus: undefined as string | undefined,
  colorScheme: undefined as string | undefined,
  updatedColorScheme: false,
  labelsColorMapMustSync: false,
  sharedLabelsColorsMustSync: false,
  expandedSlices: {} as Record<number, boolean>,
  focusedFilterField: null as FocusedFilterField,
  chartStates: {} as DashboardChartStates,
  refreshFrequency: 0,
  shouldPersistRefreshFrequency: false,
  lastRefreshTime: 0,
  preselectNativeFilters: undefined as JsonObject | undefined,
  colorNamespace: undefined as string | undefined,
};

export const createMetadataSlice: StateCreator<
  DashboardStateStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  MetadataSlice
> = set => ({
  ...metadataInitialState,

  setIsStarred: isStarred =>
    set({ isStarred }, false, 'dashboardState/setIsStarred'),

  setMaxUndoHistoryExceeded: maxUndoHistoryExceeded =>
    set(
      { maxUndoHistoryExceeded },
      false,
      'dashboardState/setMaxUndoHistoryExceeded',
    ),

  setDashboardIsSaving: dashboardIsSaving =>
    set({ dashboardIsSaving }, false, 'dashboardState/setDashboardIsSaving'),

  setLastModifiedTime: lastModifiedTime =>
    set({ lastModifiedTime }, false, 'dashboardState/setLastModifiedTime'),

  setOverwriteConfirmMetadata: overwriteConfirmMetadata =>
    set(
      { overwriteConfirmMetadata },
      false,
      'dashboardState/setOverwriteConfirmMetadata',
    ),

  setDatasetsStatus: datasetsStatus =>
    set({ datasetsStatus }, false, 'dashboardState/setDatasetsStatus'),

  setColorScheme: colorScheme =>
    set(
      { colorScheme, updatedColorScheme: true },
      false,
      'dashboardState/setColorScheme',
    ),

  setLabelsColorMapMustSync: labelsColorMapMustSync =>
    set(
      { labelsColorMapMustSync },
      false,
      'dashboardState/setLabelsColorMapMustSync',
    ),

  setSharedLabelsColorsMustSync: sharedLabelsColorsMustSync =>
    set(
      { sharedLabelsColorsMustSync },
      false,
      'dashboardState/setSharedLabelsColorsMustSync',
    ),

  toggleExpandSlice: sliceId =>
    set(
      state => {
        const expandedSlices = { ...state.expandedSlices };
        if (expandedSlices[sliceId]) {
          delete expandedSlices[sliceId];
        } else {
          expandedSlices[sliceId] = true;
        }
        return { expandedSlices };
      },
      false,
      'dashboardState/toggleExpandSlice',
    ),

  setFocusedFilterField: (chartId, column) =>
    set(
      { focusedFilterField: { chartId, column } },
      false,
      'dashboardState/setFocusedFilterField',
    ),

  unsetFocusedFilterField: (chartId, column) =>
    set(
      state => {
        // Blur/focus can fire out of order across filter boxes; only clear
        // when the field still matches.
        if (
          !state.focusedFilterField ||
          chartId !== state.focusedFilterField.chartId ||
          column !== state.focusedFilterField.column
        ) {
          return {};
        }
        return { focusedFilterField: null };
      },
      false,
      'dashboardState/unsetFocusedFilterField',
    ),

  updateChartState: (chartId, vizType, chartState) =>
    set(
      state => ({
        chartStates: {
          ...state.chartStates,
          [chartId]: {
            chartId,
            vizType,
            state: chartState,
            lastModified: Date.now(),
          },
        },
      }),
      false,
      'dashboardState/updateChartState',
    ),

  removeChartState: chartId =>
    set(
      state => {
        const chartStates = { ...state.chartStates };
        delete chartStates[chartId];
        return { chartStates };
      },
      false,
      'dashboardState/removeChartState',
    ),

  restoreChartStates: chartStates =>
    set(
      { chartStates: chartStates || {} },
      false,
      'dashboardState/restoreChartStates',
    ),

  clearAllChartStates: () =>
    set({ chartStates: {} }, false, 'dashboardState/clearAllChartStates'),

  setRefreshFrequency: (refreshFrequency, isPersistent) =>
    set(
      {
        refreshFrequency,
        shouldPersistRefreshFrequency: isPersistent,
        // Only dirty on explicit user change; the unmount/reset path omits
        // isPersistent and must not clobber other unsaved edits.
        ...(typeof isPersistent === 'boolean' && {
          hasUnsavedChanges: isPersistent,
        }),
      },
      false,
      'dashboardState/setRefreshFrequency',
    ),

  recordRefreshTime: () =>
    set(
      { lastRefreshTime: Date.now() },
      false,
      'dashboardState/recordRefreshTime',
    ),

  markSaved: lastModifiedTime =>
    set(
      {
        hasUnsavedChanges: false,
        maxUndoHistoryExceeded: false,
        editMode: false,
        updatedColorScheme: false,
        lastModifiedTime,
      },
      false,
      'dashboardState/markSaved',
    ),
});
