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

// ---------------------------------------------------------------------------
// Captured listeners — allows tests to trigger action notifications manually.
// ---------------------------------------------------------------------------
type ListenerEntry = {
  predicate: (action: { type: string }) => boolean;
  effect: (action: { type: string }) => void;
};

const capturedListeners: ListenerEntry[] = [];

// Declared before jest.mock so the factory closure can reference it.
let mockState: Record<string, unknown>;

jest.mock('src/views/store', () => ({
  store: { getState: () => mockState, dispatch: jest.fn() },
  listenerMiddleware: {
    startListening: (opts: {
      predicate: (action: { type: string }) => boolean;
      effect: (action: { type: string }) => void;
    }) => {
      const entry = { predicate: opts.predicate, effect: opts.effect };
      capturedListeners.push(entry);
      return () => {
        const idx = capturedListeners.indexOf(entry);
        if (idx !== -1) capturedListeners.splice(idx, 1);
      };
    },
  },
}));

jest.mock('../navigation', () => ({
  navigation: { getPageType: jest.fn(() => 'explore') },
}));

function dispatch(actionType: string) {
  const action = { type: actionType };
  capturedListeners
    .filter(e => e.predicate(action))
    .forEach(e => e.effect(action));
}

// Imported after mocks
// eslint-disable-next-line import/first
import { explore } from './index';

beforeEach(() => {
  mockState = {
    explore: {
      slice: { slice_id: 42, slice_name: 'My Chart' },
      datasource: { id: 7, table_name: 'orders' },
      controls: { viz_type: { value: 'bar' } },
      sliceName: 'My Chart',
      form_data: {},
    },
  };
});

afterEach(() => {
  capturedListeners.length = 0;
  jest.restoreAllMocks();
});

test('getCurrentChart returns undefined when not on explore page', () => {
  const { navigation } = jest.requireMock('../navigation');
  (navigation.getPageType as jest.Mock).mockReturnValueOnce('dashboard');
  expect(explore.getCurrentChart()).toBeUndefined();
});

test('getCurrentChart returns undefined when explore state is absent', () => {
  mockState = {};
  expect(explore.getCurrentChart()).toBeUndefined();
});

test('getCurrentChart returns chart context from Redux state', () => {
  expect(explore.getCurrentChart()).toEqual({
    chartId: 42,
    chartName: 'My Chart',
    vizType: 'bar',
    datasourceId: 7,
    datasourceName: 'orders',
  });
});

test('getCurrentChart returns null chartId for unsaved chart', () => {
  mockState = {
    explore: {
      slice: null,
      datasource: { id: 1, table_name: 'events' },
      controls: { viz_type: { value: 'line' } },
      sliceName: null,
      form_data: { viz_type: 'line' },
    },
  };
  expect(explore.getCurrentChart()?.chartId).toBeNull();
});

// Action type strings match the constants in src/explore/actions/exploreActions
// and src/explore/actions/datasourcesActions — kept as literals so this test
// file has no import dependency on those modules.
test.each([
  'HYDRATE_EXPLORE',
  'UPDATE_FORM_DATA', // SET_FORM_DATA constant resolves to this string
  'UPDATE_CHART_TITLE',
  'SET_DATASOURCE',
  'CREATE_NEW_SLICE',
  'SLICE_UPDATED',
])('onDidChangeChart fires on action type %s', actionType => {
  const listener = jest.fn();
  const disposable = explore.onDidChangeChart(listener);

  dispatch(actionType);

  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ chartId: 42, vizType: 'bar' }),
  );
  disposable.dispose();
});

test('onDidChangeChart does not fire when page type is not explore', () => {
  const { navigation } = jest.requireMock('../navigation');
  (navigation.getPageType as jest.Mock).mockReturnValue('dashboard');

  const listener = jest.fn();
  const disposable = explore.onDidChangeChart(listener);
  dispatch('HYDRATE_EXPLORE');

  expect(listener).not.toHaveBeenCalled();
  (navigation.getPageType as jest.Mock).mockReturnValue('explore');
  disposable.dispose();
});

test('disposed listener is not called', () => {
  const listener = jest.fn();
  const disposable = explore.onDidChangeChart(listener);
  disposable.dispose();
  dispatch('HYDRATE_EXPLORE');
  expect(listener).not.toHaveBeenCalled();
});
