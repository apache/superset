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

jest.mock('../views/store', () => ({
  store: { dispatch: jest.fn(), getState: jest.fn(), subscribe: jest.fn() },
}));

// eslint-disable-next-line import/first
import { embeddedApi } from './api';
// eslint-disable-next-line import/first
import { updateDataMask } from '../dataMask/actions';

const { logging: mockLogging } = jest.requireMock(
  '@apache-superset/core/utils',
);
const { store: mockStore } = jest.requireMock('../views/store');
const mockDispatch = mockStore.dispatch;
const mockGetState = mockStore.getState;

const nativeFilterMask = { filterState: { value: ['CA'] } };
const crossFilterMask = { filterState: { value: [2024] } };

// `dashboardInfo.id` is only set once HYDRATE_DASHBOARD lands, so it doubles as
// the "dashboard is hydrated" signal setDataMask waits for.
function stateWithFilters(filterIds: string[]) {
  return {
    dashboardInfo: { id: 1 },
    dataMask: Object.fromEntries(filterIds.map(id => [id, { id }])),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('setDataMask dispatches an update for each known filter', () => {
  mockGetState.mockReturnValue(
    stateWithFilters(['NATIVE_FILTER-1', 'NATIVE_FILTER-2']),
  );

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
      'NATIVE_FILTER-2': crossFilterMask,
    } as unknown as DataMaskStateWithId,
  });

  expect(mockDispatch).toHaveBeenCalledTimes(2);
  expect(mockDispatch).toHaveBeenCalledWith(
    updateDataMask('NATIVE_FILTER-1', nativeFilterMask),
  );
  expect(mockDispatch).toHaveBeenCalledWith(
    updateDataMask('NATIVE_FILTER-2', crossFilterMask),
  );
  expect(mockLogging.warn).not.toHaveBeenCalled();
});

test('setDataMask ignores filter ids the dashboard does not know', () => {
  mockGetState.mockReturnValue(stateWithFilters(['NATIVE_FILTER-1']));

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
      'NATIVE_FILTER-from-another-dashboard': crossFilterMask,
    } as unknown as DataMaskStateWithId,
  });

  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(
    updateDataMask('NATIVE_FILTER-1', nativeFilterMask),
  );
  expect(mockLogging.warn).toHaveBeenCalledWith(
    expect.stringContaining('unknown filter ids'),
    'NATIVE_FILTER-from-another-dashboard',
  );
});

test('setDataMask ignores the change-trigger flags observeDataMask emits', () => {
  mockGetState.mockReturnValue(stateWithFilters(['NATIVE_FILTER-1']));

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
      crossFiltersChanged: false,
      nativeFiltersChanged: true,
    } as unknown as DataMaskStateWithId,
  });

  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(
    updateDataMask('NATIVE_FILTER-1', nativeFilterMask),
  );
});

test('setDataMask dispatches nothing when no filter id is known', () => {
  mockGetState.mockReturnValue(stateWithFilters([]));

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
    } as unknown as DataMaskStateWithId,
  });

  expect(mockDispatch).not.toHaveBeenCalled();
  expect(mockLogging.warn).toHaveBeenCalled();
});

test('setDataMask queues the mask until the dashboard hydrates', () => {
  let notifyStoreSubscribers = () => {};
  mockStore.subscribe.mockImplementation((listener: () => void) => {
    notifyStoreSubscribers = listener;
    return jest.fn();
  });
  mockGetState.mockReturnValue({ dataMask: {} });

  embeddedApi.setDataMask({
    dataMask: {
      'NATIVE_FILTER-1': nativeFilterMask,
    } as unknown as DataMaskStateWithId,
  });

  expect(mockDispatch).not.toHaveBeenCalled();
  expect(mockLogging.warn).not.toHaveBeenCalled();

  mockGetState.mockReturnValue(stateWithFilters(['NATIVE_FILTER-1']));
  notifyStoreSubscribers();

  expect(mockDispatch).toHaveBeenCalledWith(
    updateDataMask('NATIVE_FILTER-1', nativeFilterMask),
  );
});

// getScrollSize measures layout, which jsdom does not do, so the geometry is
// stubbed: the dashboard has laid out and the body is taller than the frame.
function layOut({ content, frame }: { content: number; frame: number }) {
  // No data-test attribute on purpose: the production build strips them, so
  // the measurement must key off something that survives it.
  document.body.innerHTML = `
    <div id="app">
      <div class="dashboard"></div>
      <div class="filter-bar-bounded" style="max-height: 100vh">
        <div class="filter-bar-scroll"></div>
      </div>
    </div>`;
  jest
    .spyOn(
      document.querySelector('.dashboard') as Element,
      'getBoundingClientRect',
    )
    .mockReturnValue({ height: content } as DOMRect);
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

test('getScrollSize reports the frame until the dashboard has laid out', () => {
  layOut({ content: 0, frame: 900 });

  expect(embeddedApi.getScrollSize().height).toBe(900);
});

test('getScrollSize restores every style it lifts', () => {
  layOut({ content: 1600, frame: 800 });
  document.documentElement.style.height = '100%';
  document.body.style.minHeight = '100vh';
  const app = document.getElementById('app') as HTMLElement;
  app.style.height = '100%';
  const bar = document.querySelector('.filter-bar-bounded') as HTMLElement;

  embeddedApi.getScrollSize();

  expect(document.documentElement.style.height).toBe('100%');
  expect(document.documentElement.style.minHeight).toBe('');
  expect(document.body.style.height).toBe('');
  expect(document.body.style.minHeight).toBe('100vh');
  expect(app.style.height).toBe('100%');
  expect(app.style.minHeight).toBe('');
  expect(bar.style.maxHeight).toBe('100vh');
});
