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

/**
 * Imperative domain API for dashboard client state, for use outside render
 * (callbacks, effects, non-React modules). Keeps the state library an
 * implementation detail; for reactive reads in render use `./hooks`.
 */
import type { AgGridChartState, JsonObject } from '@superset-ui/core';
import { useDashboardStateStore } from './useDashboardStateStore';

export const setEditMode = (editMode: boolean): void =>
  useDashboardStateStore.getState().setEditMode(editMode);

export const setHasUnsavedChanges = (hasUnsavedChanges: boolean): void =>
  useDashboardStateStore.getState().setHasUnsavedChanges(hasUnsavedChanges);

export const setDirectPathToChild = (path: string[]): void =>
  useDashboardStateStore.getState().setDirectPathToChild(path);

export const setColorScheme = (colorScheme: string): void =>
  useDashboardStateStore.getState().setColorScheme(colorScheme);

export const setNativeFiltersBarOpen = (isOpen: boolean): void =>
  useDashboardStateStore.getState().setNativeFiltersBarOpen(isOpen);

export const toggleExpandSlice = (sliceId: number): void =>
  useDashboardStateStore.getState().toggleExpandSlice(sliceId);

export const setRefreshFrequency = (
  frequency: number,
  isPersistent?: boolean,
): void =>
  useDashboardStateStore
    .getState()
    .setRefreshFrequency(frequency, isPersistent);

export const setOverwriteConfirmMetadata = (
  metadata: JsonObject | undefined,
): void =>
  useDashboardStateStore.getState().setOverwriteConfirmMetadata(metadata);

export const setMaxUndoHistoryExceeded = (exceeded: boolean): void =>
  useDashboardStateStore.getState().setMaxUndoHistoryExceeded(exceeded);

export const setIsFiltersRefreshing = (isFiltersRefreshing: boolean): void =>
  useDashboardStateStore.getState().setIsFiltersRefreshing(isFiltersRefreshing);

export const setFocusedFilterField = (chartId: number, column: string): void =>
  useDashboardStateStore.getState().setFocusedFilterField(chartId, column);

export const clearAllChartStates = (): void =>
  useDashboardStateStore.getState().clearAllChartStates();

export const updateChartState = (
  chartId: number,
  vizType: string,
  state: AgGridChartState,
): void =>
  useDashboardStateStore.getState().updateChartState(chartId, vizType, state);

export const unsetFocusedFilterField = (
  chartId: number,
  column: string,
): void =>
  useDashboardStateStore.getState().unsetFocusedFilterField(chartId, column);
