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
import fetchMock from 'fetch-mock';
import {
  SET_NATIVE_FILTERS_CONFIG_COMPLETE,
  SET_NATIVE_FILTERS_CONFIG_FAIL,
  setFilterConfiguration,
} from './nativeFilters';

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
afterEach(() => fetchMock.clearHistory().removeRoutes());

const getState = () =>
  ({
    dashboardInfo: { id: 1 },
    nativeFilters: { filters: {} },
  }) as any;

const filterChanges = {
  modified: [{ id: 'NATIVE_FILTER-1', name: 'Country' }],
  deleted: [],
  reordered: [],
} as any;

test('setFilterConfiguration shows the server message and applies nothing when the save needs review', async () => {
  const message = 'Changes saved. Viewers still see the live version.';
  fetchMock.put('glob:*/api/v1/dashboard/1/filters', {
    status: 202,
    body: {
      id: 12,
      asset_id: 1,
      asset_type: 'dashboard',
      review_required: true,
      message,
    },
  });
  const dispatch = jest.fn();

  await setFilterConfiguration(filterChanges)(dispatch, getState);

  const types = dispatch.mock.calls.map(([action]) => action.type);
  expect(types).not.toContain(SET_NATIVE_FILTERS_CONFIG_COMPLETE);
  expect(types).not.toContain(SET_NATIVE_FILTERS_CONFIG_FAIL);
  const toasts = dispatch.mock.calls.filter(
    ([action]) => action.type === 'ADD_TOAST',
  );
  expect(toasts).toHaveLength(1);
  expect(toasts[0][0].payload.toastType).toBe('SUCCESS_TOAST');
  expect(toasts[0][0].payload.text).toContain(message);
  expect(toasts[0][0].payload.text).toContain('/approvals/submitted-by-me');
});

test('setFilterConfiguration still applies a normal save', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/1/filters', {
    result: [{ id: 'NATIVE_FILTER-1', name: 'Country' }],
  });
  const dispatch = jest.fn();

  await setFilterConfiguration(filterChanges)(dispatch, getState);

  expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(
    SET_NATIVE_FILTERS_CONFIG_COMPLETE,
  );
});
