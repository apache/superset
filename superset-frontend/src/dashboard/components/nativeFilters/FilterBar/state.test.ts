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
import { act, renderHook } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { DataMaskState, DataMaskStateWithId } from '@superset-ui/core';
import {
  useAllAppliedDataMask,
  useFilterUpdates,
  useInitialization,
  useNativeFiltersDataMask,
} from './state';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

const mockUseSelector = (mockState: object) => {
  (useSelector as jest.Mock).mockImplementation(
    (selector: (state: object) => unknown) => selector(mockState),
  );
};

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  document
    .querySelectorAll('[data-ui-anchor="chart"]')
    .forEach(node => node.remove());
});

test('useNativeFiltersDataMask keeps only entries whose id carries the native filter prefix', () => {
  const dataMask: DataMaskStateWithId = {
    'NATIVE_FILTER-1': { id: 'NATIVE_FILTER-1', extraFormData: {} },
    'CHART_CUSTOMIZATION-1': {
      id: 'CHART_CUSTOMIZATION-1',
      extraFormData: {},
    },
    groupby_1: { id: 'groupby_1', extraFormData: {} },
  } as unknown as DataMaskStateWithId;
  mockUseSelector({ dataMask });

  const { result } = renderHook(() => useNativeFiltersDataMask());

  expect(Object.keys(result.current)).toEqual(['NATIVE_FILTER-1']);
});

test('useAllAppliedDataMask keeps native filter, chart customization, and legacy groupby entries', () => {
  const dataMask: DataMaskStateWithId = {
    'NATIVE_FILTER-1': { id: 'NATIVE_FILTER-1', extraFormData: {} },
    'CHART_CUSTOMIZATION-1': {
      id: 'CHART_CUSTOMIZATION-1',
      extraFormData: {},
    },
    groupby_1: { id: 'groupby_1', extraFormData: {} },
    'UNRELATED-1': { id: 'UNRELATED-1', extraFormData: {} },
  } as unknown as DataMaskStateWithId;
  mockUseSelector({ dataMask });

  const { result } = renderHook(() => useAllAppliedDataMask());

  expect(Object.keys(result.current).sort()).toEqual([
    'CHART_CUSTOMIZATION-1',
    'NATIVE_FILTER-1',
    'groupby_1',
  ]);
});

test('useFilterUpdates removes a selected id that no longer maps to a known filter', () => {
  mockUseSelector({
    dashboardState: { preselectNativeFilters: {} },
    dashboardInfo: { metadata: { native_filter_configuration: [] } },
    dataMask: {},
  });
  const dataMaskSelected: DataMaskState = {
    'NATIVE_FILTER-stale': { extraFormData: {} },
  };
  const setDataMaskSelected = jest.fn();

  renderHook(() => useFilterUpdates(dataMaskSelected, setDataMaskSelected));

  expect(setDataMaskSelected).toHaveBeenCalledTimes(1);
  const draft: Record<string, unknown> = {
    'NATIVE_FILTER-stale': { extraFormData: {} },
  };
  setDataMaskSelected.mock.calls[0][0](draft);
  expect(draft).not.toHaveProperty('NATIVE_FILTER-stale');
});

test('useFilterUpdates leaves a selected id that still maps to a known filter', () => {
  const filter = {
    id: 'NATIVE_FILTER-known',
    name: 'Known filter',
    filterType: 'filter_select',
  };
  mockUseSelector({
    dashboardState: { preselectNativeFilters: {} },
    dashboardInfo: {
      metadata: { native_filter_configuration: [filter] },
    },
    dataMask: {},
  });
  const dataMaskSelected: DataMaskState = {
    'NATIVE_FILTER-known': { extraFormData: {} },
  };
  const setDataMaskSelected = jest.fn();

  renderHook(() => useFilterUpdates(dataMaskSelected, setDataMaskSelected));

  expect(setDataMaskSelected).not.toHaveBeenCalled();
});

test('useFilterUpdates leaves a chart customization id even when it is not a known filter', () => {
  mockUseSelector({
    dashboardState: { preselectNativeFilters: {} },
    dashboardInfo: { metadata: { native_filter_configuration: [] } },
    dataMask: {},
  });
  const dataMaskSelected: DataMaskState = {
    'CHART_CUSTOMIZATION-1': { extraFormData: {} },
  };
  const setDataMaskSelected = jest.fn();

  renderHook(() => useFilterUpdates(dataMaskSelected, setDataMaskSelected));

  expect(setDataMaskSelected).not.toHaveBeenCalled();
});

test('useInitialization is true immediately when a filter requires first-load', () => {
  mockUseSelector({
    dashboardState: { preselectNativeFilters: {} },
    dashboardInfo: {
      metadata: {
        native_filter_configuration: [
          { id: 'NATIVE_FILTER-1', name: 'F1', requiredFirst: true },
        ],
      },
    },
    charts: {},
  });

  const { result } = renderHook(() => useInitialization());

  expect(result.current).toBe(true);
});

test('useInitialization becomes true once every loading chart on the page finishes loading', () => {
  document.body.innerHTML =
    '<div data-ui-anchor="chart"></div><div data-ui-anchor="chart"></div>';
  mockUseSelector({
    dashboardState: { preselectNativeFilters: {} },
    dashboardInfo: { metadata: { native_filter_configuration: [] } },
    charts: {
      1: { chartStatus: 'rendered' },
      2: { chartStatus: 'rendered' },
    },
  });

  const { result } = renderHook(() => useInitialization());

  expect(result.current).toBe(true);
});

test('useInitialization stays false while charts are still loading', () => {
  jest.useFakeTimers();
  document.body.innerHTML =
    '<div data-ui-anchor="chart"></div><div data-ui-anchor="chart"></div>';
  mockUseSelector({
    dashboardState: { preselectNativeFilters: {} },
    dashboardInfo: { metadata: { native_filter_configuration: [] } },
    charts: {
      1: { chartStatus: 'loading' },
      2: { chartStatus: 'rendered' },
    },
  });

  const { result } = renderHook(() => useInitialization());
  expect(result.current).toBe(false);

  // The no-charts fallback timer must not flip it while a chart is loading.
  act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(result.current).toBe(false);
});

test('useInitialization falls back to true after a 1s timeout when there are no charts on the page', () => {
  jest.useFakeTimers();
  mockUseSelector({
    dashboardState: { preselectNativeFilters: {} },
    dashboardInfo: { metadata: { native_filter_configuration: [] } },
    charts: {},
  });

  const { result } = renderHook(() => useInitialization());
  expect(result.current).toBe(false);

  act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(result.current).toBe(true);
});
