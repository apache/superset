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
import {
  DASHBOARD_GRID_CLASS,
  FILTER_BAR_BOUNDED_CLASS,
  FILTER_BAR_SCROLL_CLASS,
} from 'src/dashboard/util/embeddedLayout';

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

// jsdom does no layout, so the geometry is stubbed. The markers are the same
// constants the components render, so a rename breaks this fixture too.
function layOut({
  content,
  frame,
  hydrated = true,
  gridMounted = true,
}: {
  content: number;
  frame: number;
  hydrated?: boolean;
  gridMounted?: boolean;
}) {
  useDashboardInfoStore.setState({
    dashboardInfo: (hydrated ? { id: 1 } : undefined) as ReturnType<
      typeof useDashboardInfoStore.getState
    >['dashboardInfo'],
  });
  document.body.innerHTML = `
    <div id="app">
      <div class="dashboard">
        ${gridMounted ? `<div class="${DASHBOARD_GRID_CLASS}"></div>` : ''}
      </div>
      <div class="${FILTER_BAR_BOUNDED_CLASS}" style="max-height: 100vh">
        <div class="${FILTER_BAR_SCROLL_CLASS}"></div>
      </div>
    </div>`;
  Object.defineProperty(document.body, 'scrollHeight', {
    configurable: true,
    get: () => content,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    get: () => frame,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
});

test('getScrollSize reports the content height rather than the frame height', () => {
  layOut({ content: 1600, frame: 2400 });

  expect(embeddedApi.getScrollSize().height).toBe(1600);
});

test('getScrollSize reports the frame until the dashboard has hydrated', () => {
  layOut({ content: 120, frame: 900, hydrated: false });

  expect(embeddedApi.getScrollSize().height).toBe(900);
});

test('getScrollSize reports the frame until the grid is mounted', () => {
  // The chrome alone has height, so height cannot stand in for "laid out".
  layOut({ content: 120, frame: 900, gridMounted: false });

  expect(embeddedApi.getScrollSize().height).toBe(900);
});

test('getScrollSize restores every style it lifts', () => {
  layOut({ content: 1600, frame: 800 });
  document.documentElement.style.height = '100%';
  document.body.style.minHeight = '100vh';
  const app = document.getElementById('app') as HTMLElement;
  app.style.height = '100%';
  const bar = document.querySelector(
    `.${FILTER_BAR_BOUNDED_CLASS}`,
  ) as HTMLElement;

  embeddedApi.getScrollSize();

  expect(document.documentElement.style.height).toBe('100%');
  expect(document.documentElement.style.minHeight).toBe('');
  expect(document.body.style.height).toBe('');
  expect(document.body.style.minHeight).toBe('100vh');
  expect(app.style.height).toBe('100%');
  expect(app.style.minHeight).toBe('');
  expect(bar.style.maxHeight).toBe('100vh');
});
