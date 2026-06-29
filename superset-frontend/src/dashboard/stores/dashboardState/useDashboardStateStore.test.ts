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

import type { AgGridChartState } from '@superset-ui/core';
import { AutoRefreshStatus } from '../../types/autoRefresh';
import { useDashboardStateStore } from './useDashboardStateStore';

const store = useDashboardStateStore;

test('has correct initial state', () => {
  expect(store.getState().editMode).toBe(false);
  expect(store.getState().fullSizeChartId).toBeNull();
  expect(store.getState().isPublished).toBeNull();
  expect(store.getState().sliceIds).toEqual([]);
  expect(store.getState().activeTabs).toEqual([]);
  expect(store.getState().hasUnsavedChanges).toBe(false);
  expect(store.getState().nativeFiltersBarOpen).toBe(false);
  expect(store.getState().isRefreshing).toBe(false);
  expect(store.getState().directPathToChild).toEqual([]);
});

test('setEditMode', () => {
  store.getState().setEditMode(true);
  expect(store.getState().editMode).toBe(true);
});

test('setFullSizeChartId', () => {
  store.getState().setFullSizeChartId(42);
  expect(store.getState().fullSizeChartId).toBe(42);
  store.getState().setFullSizeChartId(null);
  expect(store.getState().fullSizeChartId).toBeNull();
});

test('setIsPublished', () => {
  store.getState().setIsPublished(true);
  expect(store.getState().isPublished).toBe(true);
  store.getState().setIsPublished(false);
  expect(store.getState().isPublished).toBe(false);
});

test('setSliceIds', () => {
  store.getState().setSliceIds([1, 2, 3]);
  expect(store.getState().sliceIds).toEqual([1, 2, 3]);
});

test('addSliceId appends without duplicating', () => {
  store.getState().setSliceIds([1, 2]);
  store.getState().addSliceId(3);
  expect(store.getState().sliceIds).toEqual([1, 2, 3]);
  // Re-adding an existing id is a no-op.
  store.getState().addSliceId(2);
  expect(store.getState().sliceIds).toEqual([1, 2, 3]);
});

test('removeSliceId filters out the id', () => {
  store.getState().setSliceIds([1, 2, 3]);
  store.getState().removeSliceId(2);
  expect(store.getState().sliceIds).toEqual([1, 3]);
});

test('setActiveTabs', () => {
  store.getState().setActiveTabs(['TAB-1', 'TAB-2']);
  expect(store.getState().activeTabs).toEqual(['TAB-1', 'TAB-2']);
});

test('setHasUnsavedChanges', () => {
  store.getState().setHasUnsavedChanges(true);
  expect(store.getState().hasUnsavedChanges).toBe(true);
});

test('setNativeFiltersBarOpen', () => {
  store.getState().setNativeFiltersBarOpen(true);
  expect(store.getState().nativeFiltersBarOpen).toBe(true);
  store.getState().setNativeFiltersBarOpen(false);
  expect(store.getState().nativeFiltersBarOpen).toBe(false);
});

test('setIsRefreshing', () => {
  store.getState().setIsRefreshing(true);
  expect(store.getState().isRefreshing).toBe(true);
});

test('setDirectPathToChild updates path and timestamp', () => {
  const before = Date.now();
  store.getState().setDirectPathToChild(['ROOT', 'TAB-1', 'CHART-2']);
  expect(store.getState().directPathToChild).toEqual([
    'ROOT',
    'TAB-1',
    'CHART-2',
  ]);
  expect(store.getState().directPathLastUpdated).toBeGreaterThanOrEqual(before);
});

test('subscribeWithSelector fires on field change', () => {
  const listener = jest.fn();
  const unsub = store.subscribe(s => s.editMode, listener);
  store.getState().setEditMode(true);
  expect(listener).toHaveBeenCalledWith(true, false);
  unsub();
});

test('subscribeWithSelector fires for activeTabs change', () => {
  const listener = jest.fn();
  const unsub = store.subscribe(s => s.activeTabs, listener);
  store.getState().setActiveTabs(['TAB-X']);
  expect(listener).toHaveBeenCalledWith(['TAB-X'], []);
  unsub();
});

test('metadata slice has correct initial state', () => {
  expect(store.getState().isStarred).toBe(false);
  expect(store.getState().maxUndoHistoryExceeded).toBe(false);
  expect(store.getState().dashboardIsSaving).toBe(false);
  expect(store.getState().expandedSlices).toEqual({});
  expect(store.getState().chartStates).toEqual({});
  expect(store.getState().focusedFilterField).toBeNull();
  expect(store.getState().refreshFrequency).toBe(0);
  expect(store.getState().updatedColorScheme).toBe(false);
  expect(store.getState().tabActivationTimes).toEqual({});
});

test('setColorScheme also flags updatedColorScheme', () => {
  store.getState().setColorScheme('d3Category10');
  expect(store.getState().colorScheme).toBe('d3Category10');
  expect(store.getState().updatedColorScheme).toBe(true);
});

test('toggleExpandSlice adds then removes the slice', () => {
  store.getState().toggleExpandSlice(7);
  expect(store.getState().expandedSlices).toEqual({ 7: true });
  store.getState().toggleExpandSlice(7);
  expect(store.getState().expandedSlices).toEqual({});
});

const emptyChartState: AgGridChartState = {
  columnState: [],
  sortModel: [],
  filterModel: {},
};

test('updateChartState / removeChartState / clearAllChartStates', () => {
  store.getState().updateChartState(5, 'table', emptyChartState);
  expect(store.getState().chartStates[5]).toMatchObject({
    chartId: 5,
    vizType: 'table',
  });
  store.getState().updateChartState(6, 'pie', emptyChartState);
  store.getState().removeChartState(5);
  expect(store.getState().chartStates[5]).toBeUndefined();
  expect(store.getState().chartStates[6]).toBeDefined();
  store.getState().clearAllChartStates();
  expect(store.getState().chartStates).toEqual({});
});

test('setRefreshFrequency persists flag and dirties only when persistent', () => {
  store.getState().setRefreshFrequency(30, true);
  expect(store.getState().refreshFrequency).toBe(30);
  expect(store.getState().shouldPersistRefreshFrequency).toBe(true);
  expect(store.getState().hasUnsavedChanges).toBe(true);
  store.getState().setRefreshFrequency(60, false);
  expect(store.getState().shouldPersistRefreshFrequency).toBe(false);
  expect(store.getState().hasUnsavedChanges).toBe(false);
});

test('focusedFilterField set and conditional unset', () => {
  store.getState().setFocusedFilterField(3, 'gender');
  expect(store.getState().focusedFilterField).toEqual({
    chartId: 3,
    column: 'gender',
  });
  // unset for a different field is a no-op
  store.getState().unsetFocusedFilterField(9, 'name');
  expect(store.getState().focusedFilterField).toEqual({
    chartId: 3,
    column: 'gender',
  });
  store.getState().unsetFocusedFilterField(3, 'gender');
  expect(store.getState().focusedFilterField).toBeNull();
});

test('markSaved resets the save-related flags', () => {
  store.getState().setHasUnsavedChanges(true);
  store.getState().setEditMode(true);
  store.getState().setMaxUndoHistoryExceeded(true);
  store.getState().setColorScheme('x');
  store.getState().markSaved(1700000000000);
  expect(store.getState().hasUnsavedChanges).toBe(false);
  expect(store.getState().editMode).toBe(false);
  expect(store.getState().maxUndoHistoryExceeded).toBe(false);
  expect(store.getState().updatedColorScheme).toBe(false);
  expect(store.getState().lastModifiedTime).toBe(1700000000000);
});

test('updateTabActivationTimes records times for given tabs', () => {
  const before = Date.now();
  store.getState().updateTabActivationTimes(['TAB-A', 'TAB-B']);
  expect(store.getState().tabActivationTimes['TAB-A']).toBeGreaterThanOrEqual(
    before,
  );
  expect(store.getState().tabActivationTimes['TAB-B']).toBeGreaterThanOrEqual(
    before,
  );
});

test('applyActiveTab merges deltas, preserving sibling tab groups', () => {
  // Two independent tab groups, each with one active tab.
  store.getState().setActiveTabs(['TAB-groupA-1', 'TAB-groupB-1']);
  // User switches group B from tab 1 to tab 2 — only group B is a delta.
  store
    .getState()
    .applyActiveTab(['TAB-groupB-2'], ['TAB-groupB-1'], 'TAB-groupB-1');

  const { activeTabs, inactiveTabs } = store.getState();
  // sibling group A stays active (merge, not replace)
  expect(activeTabs).toContain('TAB-groupA-1');
  expect(activeTabs).toContain('TAB-groupB-2');
  expect(activeTabs).not.toContain('TAB-groupB-1');
  expect(inactiveTabs).toContain('TAB-groupB-1');
});

test('color-sync flags toggle independently', () => {
  store.getState().setLabelsColorMapMustSync(true);
  store.getState().setSharedLabelsColorsMustSync(true);
  expect(store.getState().labelsColorMapMustSync).toBe(true);
  expect(store.getState().sharedLabelsColorsMustSync).toBe(true);
  store.getState().setLabelsColorMapMustSync(false);
  expect(store.getState().labelsColorMapMustSync).toBe(false);
  expect(store.getState().sharedLabelsColorsMustSync).toBe(true);
});

test('auto-refresh slice has correct initial state', () => {
  expect(store.getState().autoRefreshStatus).toBe(AutoRefreshStatus.Idle);
  expect(store.getState().autoRefreshPaused).toBe(false);
  expect(store.getState().autoRefreshPausedByTab).toBe(false);
  expect(store.getState().refreshErrorCount).toBe(0);
  expect(store.getState().lastSuccessfulRefresh).toBeNull();
});

test('auto-refresh setters', () => {
  store.getState().setAutoRefreshStatus(AutoRefreshStatus.Fetching);
  expect(store.getState().autoRefreshStatus).toBe(AutoRefreshStatus.Fetching);
  store.getState().setAutoRefreshPaused(true);
  expect(store.getState().autoRefreshPaused).toBe(true);
  store.getState().setAutoRefreshPausedByTab(true);
  expect(store.getState().autoRefreshPausedByTab).toBe(true);
  store.getState().setAutoRefreshFetchStartTime(123);
  expect(store.getState().autoRefreshFetchStartTime).toBe(123);
  store.getState().setAutoRefreshPauseOnInactiveTab(true);
  expect(store.getState().autoRefreshPauseOnInactiveTab).toBe(true);
});

test('recordAutoRefreshSuccess resets the error streak', () => {
  store.getState().recordAutoRefreshError('boom');
  store.getState().recordAutoRefreshSuccess(1700000000000);
  expect(store.getState().autoRefreshStatus).toBe(AutoRefreshStatus.Success);
  expect(store.getState().refreshErrorCount).toBe(0);
  expect(store.getState().lastRefreshError).toBeNull();
  expect(store.getState().lastSuccessfulRefresh).toBe(1700000000000);
});

test('recordAutoRefreshError escalates Delayed -> Error on the 2nd error', () => {
  store.getState().recordAutoRefreshSuccess();
  store.getState().recordAutoRefreshError('first');
  expect(store.getState().autoRefreshStatus).toBe(AutoRefreshStatus.Delayed);
  expect(store.getState().refreshErrorCount).toBe(1);
  store.getState().recordAutoRefreshError('second');
  expect(store.getState().autoRefreshStatus).toBe(AutoRefreshStatus.Error);
  expect(store.getState().refreshErrorCount).toBe(2);
  expect(store.getState().lastRefreshError).toBe('second');
});
