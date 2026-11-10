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
import { ADD_TOAST } from 'src/components/MessageToasts/actions';
import { ToastType } from 'src/components/MessageToasts/types';
import {
  SET_NATIVE_FILTERS_CONFIG_COMPLETE,
  setFilterConfiguration,
} from './nativeFilters';

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
afterEach(() => fetchMock.clearHistory().removeRoutes());

const DASHBOARD_ID = 7;

const setup = () => {
  const state = {
    dashboardInfo: { id: DASHBOARD_ID, metadata: {} },
    nativeFilters: { filters: {} },
    dataMask: {},
  };
  const dispatch = jest.fn();
  return { dispatch, getState: jest.fn(() => state) as unknown as () => any };
};

// Non-empty on purpose: `setFilterConfiguration` returns before touching the
// network when there is nothing to save.
const filterChanges = {
  modified: [{ id: 'NATIVE_FILTER-1', name: 'Region' }],
  deleted: [],
  reordered: [],
};

const successToast = (dispatch: jest.Mock) =>
  dispatch.mock.calls
    .map(call => call[0])
    .find(
      action =>
        action?.type === ADD_TOAST &&
        action.payload.toastType === ToastType.Success,
    );

const dispatchedTypes = (dispatch: jest.Mock) =>
  dispatch.mock.calls.map(call => call[0]?.type);

test('a save the server accepts without applying is not treated as applied', async () => {
  // Without this the filter bar silently keeps showing the author's unsaved
  // configuration as though it were live: nothing errors, nothing is said,
  // and `response.result` is read off a body that has none.
  fetchMock.putOnce(`glob:*/api/v1/dashboard/${DASHBOARD_ID}/filters`, {
    status: 202,
    body: { message: 'Held for review.' },
  });

  const { dispatch, getState } = setup();
  await setFilterConfiguration(filterChanges as never)(dispatch, getState);

  const { text } = successToast(dispatch).payload;
  // The server's own sentence, and nothing else. Only it knows why the write
  // was held; the host has nowhere of its own to send the author next, so it
  // adds no link of its own.
  expect(text).toBe('Held for review.');
  expect(dispatchedTypes(dispatch)).not.toContain(
    SET_NATIVE_FILTERS_CONFIG_COMPLETE,
  );
});

test("a deferral with no message falls back to the host's wording", async () => {
  fetchMock.putOnce(`glob:*/api/v1/dashboard/${DASHBOARD_ID}/filters`, {
    status: 202,
    body: {},
  });

  const { dispatch, getState } = setup();
  await setFilterConfiguration(filterChanges as never)(dispatch, getState);

  expect(successToast(dispatch).payload.text).toContain(
    'Changes saved. Viewers still see the live version.',
  );
});

test('a 200 with a result is still applied', async () => {
  fetchMock.putOnce(`glob:*/api/v1/dashboard/${DASHBOARD_ID}/filters`, {
    status: 200,
    body: { result: [] },
  });

  const { dispatch, getState } = setup();
  await setFilterConfiguration(filterChanges as never)(dispatch, getState);

  expect(dispatchedTypes(dispatch)).toContain(
    SET_NATIVE_FILTERS_CONFIG_COMPLETE,
  );
  expect(successToast(dispatch)).toBeUndefined();
});
