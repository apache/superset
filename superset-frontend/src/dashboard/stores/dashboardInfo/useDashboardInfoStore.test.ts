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

import { FilterBarOrientation, DashboardInfo } from 'src/dashboard/types';
import {
  useDashboardInfoStore,
  selectFilterBarOrientation,
  selectCrossFiltersEnabled,
} from './useDashboardInfoStore';

const store = useDashboardInfoStore;
const getInfo = () => store.getState().dashboardInfo;

beforeEach(() => {
  store.setState({ dashboardInfo: {} as DashboardInfo });
});

test('holds an empty dashboardInfo object initially', () => {
  expect(getInfo()).toEqual({});
});

test('setDashboardInfo merges partial changes and stamps last_modified_time', () => {
  store.getState().setDashboardInfo({ id: 7, css: '.a {}' });
  expect(getInfo().id).toBe(7);
  expect(getInfo().css).toBe('.a {}');
  expect(typeof getInfo().last_modified_time).toBe('number');
});

test('setDashboardInfo preserves an existing field when a later update omits it', () => {
  store.getState().setDashboardInfo({ theme: { id: 1 } as never });
  store.getState().setDashboardInfo({ css: 'updated' });
  expect(getInfo().theme).toEqual({ id: 1 });
});

test('setDashboardInfo preserves existing fields when the update sets them to undefined', () => {
  store.getState().setDashboardInfo({
    certified_by: 'QA Team',
    certification_details: 'Verified',
  });
  store.getState().setDashboardInfo({
    certified_by: undefined,
    certification_details: undefined,
    slug: 'new-slug',
  });
  expect(getInfo().certified_by).toBe('QA Team');
  expect(getInfo().certification_details).toBe('Verified');
  expect(getInfo().slug).toBe('new-slug');
});

test('setDashboardInfo clears a field when it is explicitly set to null', () => {
  store.getState().setDashboardInfo({ theme: { id: 1 } as never });
  store.getState().setDashboardInfo({ theme: null });
  expect(getInfo().theme).toBeNull();
});

test('setDashboardInfo preserves native filter scopes when metadata refreshes', () => {
  store.getState().setDashboardInfo({
    metadata: {
      native_filter_configuration: [
        { id: 'f1', chartsInScope: [1, 2], tabsInScope: ['t1'] },
      ],
    } as never,
  });
  store.getState().setDashboardInfo({
    metadata: {
      native_filter_configuration: [{ id: 'f1', name: 'refreshed' }],
    } as never,
  });
  const refreshed = getInfo().metadata?.native_filter_configuration?.[0];
  expect(refreshed).toMatchObject({
    id: 'f1',
    chartsInScope: [1, 2],
    tabsInScope: ['t1'],
  });
});

test('setDashboardInfo preserves chart customization scopes when metadata refreshes', () => {
  store.getState().setDashboardInfo({
    metadata: {
      chart_customization_config: [
        { id: 'c1', chartsInScope: [9], tabsInScope: ['tab'] },
      ],
    } as never,
  });
  store.getState().setDashboardInfo({
    metadata: { chart_customization_config: [{ id: 'c1' }] },
  } as never);
  const refreshed = getInfo().metadata?.chart_customization_config?.[0];
  expect(refreshed).toMatchObject({ id: 'c1', chartsInScope: [9] });
});

test('setDashboardInfo leaves metadata untouched when the update has no metadata', () => {
  store
    .getState()
    .setDashboardInfo({ metadata: { color_scheme: 'x' } as never });
  store.getState().setDashboardInfo({ css: 'no-metadata-here' });
  expect(getInfo().metadata?.color_scheme).toBe('x');
});

test('setNativeFiltersConfig replaces the config, preserving prior scopes', () => {
  store.getState().setDashboardInfo({
    metadata: {
      native_filter_configuration: [
        { id: 'f1', chartsInScope: [3], tabsInScope: ['t'] },
      ],
    } as never,
  });
  store
    .getState()
    .setNativeFiltersConfig([{ id: 'f1', name: 'next' }] as never);
  const next = getInfo().metadata?.native_filter_configuration?.[0];
  expect(next).toMatchObject({ id: 'f1', chartsInScope: [3] });
});

test('setFilterBarOrientation writes the orientation to metadata (the single source)', () => {
  store.getState().setDashboardInfo({ id: 1 });
  store.getState().setFilterBarOrientation(FilterBarOrientation.Horizontal);
  // metadata is the single source the save payload spreads from.
  expect(getInfo().metadata?.filter_bar_orientation).toBe(
    FilterBarOrientation.Horizontal,
  );
  expect(selectFilterBarOrientation(store.getState())).toBe(
    FilterBarOrientation.Horizontal,
  );
  expect(getInfo().id).toBe(1);
});

test('setCrossFiltersEnabled writes the flag to metadata (the single source)', () => {
  store.getState().setCrossFiltersEnabled(true);
  expect(getInfo().metadata?.cross_filters_enabled).toBe(true);
  expect(selectCrossFiltersEnabled(store.getState())).toBe(true);
  store.getState().setCrossFiltersEnabled(false);
  expect(getInfo().metadata?.cross_filters_enabled).toBe(false);
  expect(selectCrossFiltersEnabled(store.getState())).toBe(false);
});

test('selectors default to vertical orientation and enabled cross-filtering when metadata is unset', () => {
  store.setState({ dashboardInfo: {} as DashboardInfo });
  expect(selectFilterBarOrientation(store.getState())).toBe(
    FilterBarOrientation.Vertical,
  );
  expect(selectCrossFiltersEnabled(store.getState())).toBe(true);
});

test('hydrateDashboardInfo seeds the store and resets pending customizations', () => {
  store.getState().setPendingChartCustomization({ id: 'pending' } as never);
  store.getState().hydrateDashboardInfo({
    id: 42,
    metadata: { color_scheme: 'blue' },
  } as never);
  expect(getInfo().id).toBe(42);
  expect(getInfo().metadata?.color_scheme).toBe('blue');
  expect(getInfo().pendingChartCustomizations).toEqual({});
});

test('setChartCustomizationComplete writes the config and drops the groupby customization', () => {
  store.getState().setDashboardInfo({
    metadata: {
      native_filter_configuration: [
        { id: 'chart_customization_groupby', type: 'CHART_CUSTOMIZATION' },
        { id: 'real-filter', type: 'NATIVE_FILTER' },
      ],
    } as never,
  });
  store.getState().setChartCustomizationComplete([{ id: 'cc1' }] as never);
  const config = getInfo().metadata?.native_filter_configuration ?? [];
  expect(config.map(item => item.id)).toEqual(['real-filter']);
  expect(getInfo().metadata?.chart_customization_config).toEqual([
    { id: 'cc1' },
  ]);
});

test('setChartCustomizationDataLoading tracks loading per item id', () => {
  store.getState().setChartCustomizationDataLoading('item-1', true);
  expect(getInfo().chartCustomizationLoading).toEqual({ 'item-1': true });
  store.getState().setChartCustomizationDataLoading('item-1', false);
  expect(getInfo().chartCustomizationLoading).toEqual({ 'item-1': false });
});

test('setChartCustomizationData stores column options per item id', () => {
  store
    .getState()
    .setChartCustomizationData('item-1', [{ column_name: 'c' }] as never);
  expect(getInfo().chartCustomizationData?.['item-1']).toEqual([
    { column_name: 'c' },
  ]);
});

test('pending chart customizations can be added, cleared by id, and cleared all', () => {
  store.getState().setPendingChartCustomization({ id: 'a' } as never);
  store.getState().setPendingChartCustomization({ id: 'b' } as never);
  expect(Object.keys(getInfo().pendingChartCustomizations ?? {})).toEqual([
    'a',
    'b',
  ]);
  store.getState().clearPendingChartCustomization('a');
  expect(Object.keys(getInfo().pendingChartCustomizations ?? {})).toEqual([
    'b',
  ]);
  store.getState().clearAllPendingChartCustomizations();
  expect(getInfo().pendingChartCustomizations).toEqual({});
});

test('clearAllChartCustomizations strips customization targets down to datasetId', () => {
  store.getState().setDashboardInfo({
    metadata: {
      chart_customization_config: [
        {
          id: 'cc1',
          targets: [{ datasetId: 5, column: 'region', extra: 'drop-me' }],
        },
      ],
    } as never,
  });
  store.getState().clearAllChartCustomizations();
  expect(getInfo().metadata?.chart_customization_config?.[0]).toMatchObject({
    id: 'cc1',
    targets: [{ datasetId: 5 }],
  });
});
