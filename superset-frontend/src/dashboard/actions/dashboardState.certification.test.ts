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
import { SupersetClient, isFeatureEnabled } from '@superset-ui/core';
import { waitFor } from 'spec/helpers/testing-library';
import {
  filterId,
  sliceEntitiesForDashboard as sliceEntities,
} from 'spec/fixtures/mockSliceEntities';
import { emptyFilters } from 'spec/fixtures/mockDashboardFilters';
import mockDashboardData from 'spec/fixtures/mockDashboardData';
import { saveDashboardRequest } from 'src/dashboard/actions/dashboardState';
import { SAVE_TYPE_OVERWRITE } from 'src/dashboard/util/constants';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const mockState = {
  dashboardState: { sliceIds: [filterId], hasUnsavedChanges: true },
  dashboardInfo: { metadata: { color_scheme: 'supersetColors' } },
  sliceEntities,
  dashboardFilters: emptyFilters,
  dashboardLayout: {
    past: [],
    present: mockDashboardData.positions,
    future: {},
  },
  charts: {},
};

let putStub: jest.SpyInstance;

beforeEach(() => {
  // Disable ConfirmDashboardDiff so SAVE_TYPE_OVERWRITE always calls PUT
  // directly (skipping the GET precheck) — without this the test outcome
  // depends on the global feature-flag state and the assertions become
  // non-deterministic, meaning a reverted fix may go undetected.
  mockIsFeatureEnabled.mockReturnValue(false);
  jest.spyOn(SupersetClient, 'post').mockResolvedValue({} as any);
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({} as any);
  putStub = jest.spyOn(SupersetClient, 'put').mockResolvedValue({
    json: { result: mockDashboardData },
  } as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function setup() {
  const getState = jest.fn(() => mockState) as unknown as () => any;
  const dispatch = jest.fn();
  return { getState, dispatch };
}

test('clears certification_details when certified_by is cleared', async () => {
  const { getState, dispatch } = setup();
  const thunk = saveDashboardRequest(
    {
      ...mockDashboardData,
      certified_by: '',
      certification_details: 'Old details',
    },
    1,
    SAVE_TYPE_OVERWRITE,
  );
  thunk(dispatch, getState);
  await waitFor(() => expect(putStub.mock.calls.length).toBe(1));
  const body = JSON.parse(putStub.mock.calls[0][0].body);
  expect(body.certified_by).toBe('');
  expect(body.certification_details).toBe('');
});

test('preserves certification_details when certified_by is set', async () => {
  const { getState, dispatch } = setup();
  const thunk = saveDashboardRequest(
    {
      ...mockDashboardData,
      certified_by: 'Alice',
      certification_details: 'Verified by Alice',
    },
    1,
    SAVE_TYPE_OVERWRITE,
  );
  thunk(dispatch, getState);
  await waitFor(() => expect(putStub.mock.calls.length).toBe(1));
  const body = JSON.parse(putStub.mock.calls[0][0].body);
  expect(body.certified_by).toBe('Alice');
  expect(body.certification_details).toBe('Verified by Alice');
});

test('omits certification fields when certified_by is undefined', async () => {
  const { getState, dispatch } = setup();
  const thunk = saveDashboardRequest(
    {
      ...mockDashboardData,
      certified_by: undefined,
      certification_details: undefined,
    },
    1,
    SAVE_TYPE_OVERWRITE,
  );
  thunk(dispatch, getState);
  await waitFor(() => expect(putStub.mock.calls.length).toBe(1));
  const body = JSON.parse(putStub.mock.calls[0][0].body);
  expect(body).not.toHaveProperty('certified_by');
  expect(body).not.toHaveProperty('certification_details');
});
