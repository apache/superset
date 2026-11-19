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
import {
  FETCH_DASHBOARDS_FAILED,
  FETCH_DASHBOARDS_SUCCEEDED,
  SAVE_SLICE_FAILED,
  SAVE_SLICE_SUCCESS,
  SET_SAVE_CHART_MODAL_VISIBILITY,
} from '../actions/saveModalActions';
import { HYDRATE_EXPLORE } from '../actions/hydrateExplore';
import saveModalReducer from './saveModalReducer';

type SaveModalState = Parameters<typeof saveModalReducer>[0];
type SaveModalAction = Parameters<typeof saveModalReducer>[1];

test('initializes to an empty state', () => {
  expect(saveModalReducer(undefined, { type: '@@INIT' })).toEqual({});
});

test('SET_SAVE_CHART_MODAL_VISIBILITY sets isVisible and keeps other state', () => {
  const state: SaveModalState = { dashboards: [{ id: 1 }] };

  const shown = saveModalReducer(state, {
    type: SET_SAVE_CHART_MODAL_VISIBILITY,
    isVisible: true,
  });
  expect(shown).toEqual({ dashboards: [{ id: 1 }], isVisible: true });

  const hidden = saveModalReducer(shown, {
    type: SET_SAVE_CHART_MODAL_VISIBILITY,
    isVisible: false,
  });
  expect(hidden.isVisible).toBe(false);
  expect(hidden.dashboards).toEqual([{ id: 1 }]);
});

test('FETCH_DASHBOARDS_SUCCEEDED stores the dashboard choices', () => {
  const choices = [{ id: 1 }, { id: 2 }];

  const newState = saveModalReducer(
    { isVisible: true },
    { type: FETCH_DASHBOARDS_SUCCEEDED, choices },
  );

  expect(newState).toEqual({ isVisible: true, dashboards: choices });
});

test('FETCH_DASHBOARDS_FAILED sets an alert naming the user', () => {
  const newState = saveModalReducer(
    { isVisible: true },
    { type: FETCH_DASHBOARDS_FAILED, userId: '42' },
  );

  expect(newState).toEqual({
    isVisible: true,
    saveModalAlert: 'fetching dashboards failed for 42',
  });
});

test('SAVE_SLICE_FAILED sets the save failure alert', () => {
  const newState = saveModalReducer(
    { isVisible: true },
    { type: SAVE_SLICE_FAILED },
  );

  expect(newState).toEqual({
    isVisible: true,
    saveModalAlert: 'Failed to save slice',
  });
});

test('SAVE_SLICE_SUCCESS records the saved chart and its response data', () => {
  const data = { id: 7, slice_name: 'My chart' };

  const newState = saveModalReducer(
    { isVisible: true, dashboards: [{ id: 1 }], lastSavedChart: { id: 1 } },
    { type: SAVE_SLICE_SUCCESS, data },
  );

  expect(newState).toEqual({
    isVisible: true,
    dashboards: [{ id: 1 }],
    data,
    lastSavedChart: { id: 7 },
  });
  expect(newState.data).toBe(data);
});

test.each([
  ['id is not a number', { id: '7' }],
  ['id is missing', { slice_name: 'My chart' }],
  ['data is null', null],
  ['data is not an object', 'ok'],
  ['data is undefined', undefined],
])(
  'SAVE_SLICE_SUCCESS keeps the previous lastSavedChart when %s',
  (_label, data) => {
    const newState = saveModalReducer(
      { lastSavedChart: { id: 1 } },
      { type: SAVE_SLICE_SUCCESS, data },
    );

    expect(newState.data).toBe(data);
    expect(newState.lastSavedChart).toEqual({ id: 1 });
  },
);

test('SAVE_SLICE_SUCCESS leaves lastSavedChart unset when there was none', () => {
  const newState = saveModalReducer({}, { type: SAVE_SLICE_SUCCESS, data: {} });

  expect(newState.lastSavedChart).toBeUndefined();
});

test('HYDRATE_EXPLORE replaces the state with payload.saveModal', () => {
  const state: SaveModalState = {
    isVisible: true,
    dashboards: [{ id: 1 }],
    saveModalAlert: 'Failed to save slice',
  };
  const action: SaveModalAction = {
    type: HYDRATE_EXPLORE,
    data: { saveModal: { dashboards: [], isVisible: false } },
  };

  expect(saveModalReducer(state, action)).toStrictEqual({
    dashboards: [],
    isVisible: false,
    lastSavedChart: undefined,
  });
});

test('HYDRATE_EXPLORE preserves lastSavedChart across hydration', () => {
  const state: SaveModalState = {
    isVisible: true,
    lastSavedChart: { id: 7 },
  };
  const action: SaveModalAction = {
    type: HYDRATE_EXPLORE,
    data: { saveModal: { isVisible: false, lastSavedChart: { id: 99 } } },
  };

  const newState = saveModalReducer(state, action);

  expect(newState.lastSavedChart).toEqual({ id: 7 });
  expect(newState.isVisible).toBe(false);
});

test('HYDRATE_EXPLORE without a saveModal payload resets to only lastSavedChart', () => {
  const state: SaveModalState = {
    isVisible: true,
    dashboards: [{ id: 1 }],
    saveModalAlert: 'Failed to save slice',
    lastSavedChart: { id: 7 },
  };

  expect(saveModalReducer(state, { type: HYDRATE_EXPLORE, data: {} })).toEqual({
    lastSavedChart: { id: 7 },
  });
  expect(saveModalReducer(state, { type: HYDRATE_EXPLORE })).toEqual({
    lastSavedChart: { id: 7 },
  });
});

test('returns the same state reference for an unknown action', () => {
  const state: SaveModalState = { isVisible: true };

  expect(saveModalReducer(state, { type: 'UNKNOWN_ACTION' })).toBe(state);
});
