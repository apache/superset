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
import { DataMaskStateWithId } from '@superset-ui/core';

// Mock factories must build their own jest.fn()s: jest.mock calls are hoisted
// above this file's declarations, so a factory closing over a const would read
// it before initialization.
jest.mock('@apache-superset/core/utils', () => ({
  logging: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// api.tsx still imports the Redux store for chart-data payloads; keep a minimal
// mock so importing the module doesn't spin up the real store.
jest.mock('../views/store', () => ({
  store: { dispatch: jest.fn(), getState: jest.fn(), subscribe: jest.fn() },
}));

// eslint-disable-next-line import/first
import { embeddedApi } from './api';
// eslint-disable-next-line import/first
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
// eslint-disable-next-line import/first
import { useDashboardInfoStore } from 'src/dashboard/stores';

const { logging: mockLogging } = jest.requireMock(
  '@apache-superset/core/utils',
);

const nativeFilterMask = { filterState: { value: ['CA'] } };
const crossFilterMask = { filterState: { value: [2024] } };

// The dashboard's data mask holds an entry per known filter id, so it doubles
// as the set of ids setDataMask will accept. `dashboardInfo.id` is only set
// once HYDRATE_DASHBOARD lands, so it doubles as the "hydrated" signal.
function hydrateWithFilters(filterIds: string[]) {
  useDataMaskStore.setState({
    dataMask: Object.fromEntries(
      filterIds.map(id => [id, { id }]),
    ) as unknown as DataMaskStateWithId,
  });
  useDashboardInfoStore.setState({
    dashboardInfo: { id: 1 } as ReturnType<
      typeof useDashboardInfoStore.getState
    >['dashboardInfo'],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useDataMaskStore.setState({ dataMask: {} });
  useDashboardInfoStore.setState({
    dashboardInfo: {} as ReturnType<
      typeof useDashboardInfoStore.getState
    >['dashboardInfo'],
  });
});

test('setDataMask applies an update for each known filter', () => {
  hydrateWithFilters(['NATIVE_FILTER-1', 'NATIVE_FILTER-2']);

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
      'NATIVE_FILTER-2': crossFilterMask,
    } as unknown as DataMaskStateWithId,
  });

  const result = useDataMaskStore.getState().dataMask;
  expect(result['NATIVE_FILTER-1'].filterState).toEqual({ value: ['CA'] });
  expect(result['NATIVE_FILTER-2'].filterState).toEqual({ value: [2024] });
  expect(mockLogging.warn).not.toHaveBeenCalled();
});

test('setDataMask ignores filter ids the dashboard does not know', () => {
  hydrateWithFilters(['NATIVE_FILTER-1']);

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
      'NATIVE_FILTER-from-another-dashboard': crossFilterMask,
    } as unknown as DataMaskStateWithId,
  });

  const result = useDataMaskStore.getState().dataMask;
  expect(result['NATIVE_FILTER-1'].filterState).toEqual({ value: ['CA'] });
  expect(result['NATIVE_FILTER-from-another-dashboard']).toBeUndefined();
  expect(mockLogging.warn).toHaveBeenCalledWith(
    expect.stringContaining('unknown filter ids'),
    'NATIVE_FILTER-from-another-dashboard',
  );
});

test('setDataMask ignores the change-trigger flags observeDataMask emits', () => {
  hydrateWithFilters(['NATIVE_FILTER-1']);

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
      crossFiltersChanged: false,
      nativeFiltersChanged: true,
    } as unknown as DataMaskStateWithId,
  });

  const result = useDataMaskStore.getState().dataMask;
  expect(result['NATIVE_FILTER-1'].filterState).toEqual({ value: ['CA'] });
  expect(result.crossFiltersChanged).toBeUndefined();
  expect(result.nativeFiltersChanged).toBeUndefined();
});

test('setDataMask applies nothing when no filter id is known', () => {
  hydrateWithFilters([]);

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
    } as unknown as DataMaskStateWithId,
  });

  expect(
    useDataMaskStore.getState().dataMask['NATIVE_FILTER-1'],
  ).toBeUndefined();
  expect(mockLogging.warn).toHaveBeenCalled();
});

test('setDataMask queues the mask until the dashboard hydrates', () => {
  // Not hydrated yet: no dashboardInfo.id, no known filter ids.
  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
    } as unknown as DataMaskStateWithId,
  });

  expect(
    useDataMaskStore.getState().dataMask['NATIVE_FILTER-1'],
  ).toBeUndefined();
  expect(mockLogging.warn).not.toHaveBeenCalled();

  // Hydration lands: the known filter id appears, then dashboardInfo.id is set,
  // which fires the store subscription and replays the queued mask.
  useDataMaskStore.setState({
    dataMask: {
      'NATIVE_FILTER-1': { id: 'NATIVE_FILTER-1' },
    } as unknown as DataMaskStateWithId,
  });
  useDashboardInfoStore.setState({
    dashboardInfo: { id: 1 } as ReturnType<
      typeof useDashboardInfoStore.getState
    >['dashboardInfo'],
  });

  expect(
    useDataMaskStore.getState().dataMask['NATIVE_FILTER-1'].filterState,
  ).toEqual({ value: ['CA'] });
});
