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
 * Reactive domain hooks for dashboard client state, read in render. Keeps the
 * state library an implementation detail; for imperative reads/writes in
 * callbacks and effects use `./actions`.
 */
import type { JsonObject } from '@superset-ui/core';
import type {
  ChartState,
  DashboardChartStates,
} from 'src/dashboard/types/chartState';
import { useDashboardStateStore } from './useDashboardStateStore';

export const useEditMode = (): boolean =>
  useDashboardStateStore(s => s.editMode);

export const useHasUnsavedChanges = (): boolean =>
  useDashboardStateStore(s => s.hasUnsavedChanges);

export const useDashboardIsSaving = (): boolean =>
  useDashboardStateStore(s => s.dashboardIsSaving);

export const useFullSizeChartId = (): number | null =>
  useDashboardStateStore(s => s.fullSizeChartId);

export const useIsPublished = (): boolean =>
  useDashboardStateStore(s => !!s.isPublished);

export const useMaxUndoHistoryExceeded = (): boolean =>
  useDashboardStateStore(s => s.maxUndoHistoryExceeded);

export const useSliceIds = (): number[] =>
  useDashboardStateStore(s => s.sliceIds);

export const useActiveTabs = (): string[] =>
  useDashboardStateStore(s => s.activeTabs);

export const useDirectPathToChild = (): string[] =>
  useDashboardStateStore(s => s.directPathToChild);

export const useDirectPathLastUpdated = (): number =>
  useDashboardStateStore(s => s.directPathLastUpdated);

export const useNativeFiltersBarOpen = (): boolean =>
  useDashboardStateStore(s => s.nativeFiltersBarOpen);

export const useExpandedSlices = (): Record<number, boolean> =>
  useDashboardStateStore(s => s.expandedSlices);

export const useChartStates = (): DashboardChartStates =>
  useDashboardStateStore(s => s.chartStates);

export const useColorScheme = (): string | undefined =>
  useDashboardStateStore(s => s.colorScheme);

export const useColorNamespace = (): string | undefined =>
  useDashboardStateStore(s => s.colorNamespace);

export const useUpdatedColorScheme = (): boolean =>
  useDashboardStateStore(s => s.updatedColorScheme);

export const useIsStarred = (): boolean =>
  useDashboardStateStore(s => s.isStarred);

export const useIsRefreshing = (): boolean =>
  useDashboardStateStore(s => s.isRefreshing);

export const useIsFiltersRefreshing = (): boolean =>
  useDashboardStateStore(s => s.isFiltersRefreshing);

export const useRefreshFrequency = (): number =>
  useDashboardStateStore(s => s.refreshFrequency);

export const useShouldPersistRefreshFrequency = (): boolean =>
  useDashboardStateStore(s => s.shouldPersistRefreshFrequency);

export const useLastRefreshTime = (): number =>
  useDashboardStateStore(s => s.lastRefreshTime);

export const useLastModifiedTime = (): number =>
  useDashboardStateStore(s => s.lastModifiedTime);

export const useDatasetsStatus = (): string | undefined =>
  useDashboardStateStore(s => s.datasetsStatus);

export const useOverwriteConfirmMetadata = (): JsonObject | undefined =>
  useDashboardStateStore(s => s.overwriteConfirmMetadata);

export const usePreselectNativeFilters = (): JsonObject | undefined =>
  useDashboardStateStore(s => s.preselectNativeFilters);

export const useIsSliceExpanded = (sliceId: number): boolean =>
  useDashboardStateStore(s => !!s.expandedSlices?.[sliceId]);

export const useChartState = (chartId: number): ChartState =>
  useDashboardStateStore(s => s.chartStates[chartId]);

export const useTabActivationTime = (tabId: string): number =>
  useDashboardStateStore(s => s.tabActivationTimes[tabId]);
