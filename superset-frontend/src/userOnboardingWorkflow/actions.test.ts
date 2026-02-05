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

import { waitFor } from '@testing-library/react';
import {
  fetchCurrentUserOnboardingworkflows,
  markCurrentUserOnboardingWorkflowAsVisited,
} from './actions';
import { configureStore } from '@reduxjs/toolkit';
import userOnboardingWorkflowsReducer from './reducers';
import { RawUserOnboardingWorkflow } from 'src/types/UserOnboardingWorkflow';
import { makeApi } from '@superset-ui/core';
import mapToUserOnboardingWorkflows from './utils';

const rawUserOnboardingWorkflowMock: RawUserOnboardingWorkflow = {
  onboarding_workflow: {
    description:
      'Onboarding workflow for creating a dashboard with none existing chart',
    id: 1,
    name: 'CREATE_DASHBOARD_WITH_NO_EXISTING_CHART',
  },
  onboarding_workflow_id: 1,
  user_id: 1,
  visited_times: 0,
  should_visit: true,
};

const userOnboardingWorkflowMock = mapToUserOnboardingWorkflows([
  rawUserOnboardingWorkflowMock,
])[0]!;

jest.mock('@superset-ui/core', () => ({
  makeApi: jest.fn(),
}));

const makeApiMock = makeApi as jest.MockedFunction<typeof makeApi>;

test('fetchCurrentUserOnboardingworkflows should set the onbarding workflows in the state', async () => {
  const mockStore = configureStore({
    reducer: {
      userOnboardingWorkflows: userOnboardingWorkflowsReducer,
    },
  });

  makeApiMock.mockImplementation(args => {
    if (args.endpoint === '/api/v1/me/onboarding-workflows/') {
      return jest
        .fn()
        .mockResolvedValue({ result: [rawUserOnboardingWorkflowMock] }) as any;
    }

    return jest.fn().mockResolvedValue({ result: null }) as any;
  });

  mockStore.dispatch(fetchCurrentUserOnboardingworkflows() as any);

  await waitFor(() => {
    expect(
      mockStore.getState().userOnboardingWorkflows.userOnboardingWorkflows,
    ).toEqual([userOnboardingWorkflowMock]);
  });

  expect(mockStore.getState().userOnboardingWorkflows.isLoading).toBeFalsy();

  expect(
    mockStore.getState().userOnboardingWorkflows.userOnboardingWorkflowNamesMap,
  ).toEqual({
    [userOnboardingWorkflowMock.onboardingWorkflow.name]:
      userOnboardingWorkflowMock,
  });

  makeApiMock.mockClear();
  makeApiMock.mockReset();
});

test('markCurrentUserOnboardingWorkflowAsVisited should mark onboarding workflow as visited in the state', async () => {
  const mockStore = configureStore({
    reducer: {
      userOnboardingWorkflows: userOnboardingWorkflowsReducer,
    },
  });

  const rawCloneMockResponse = { ...rawUserOnboardingWorkflowMock };

  makeApiMock.mockImplementation(args => {
    if (args.endpoint === '/api/v1/me/onboarding-workflows/') {
      return jest
        .fn()
        .mockResolvedValue({ result: [rawCloneMockResponse] }) as any;
    }

    if (args.endpoint.includes('set-visited')) {
      rawCloneMockResponse.visited_times += 1;
    }

    return jest.fn().mockResolvedValue({ result: null }) as any;
  });

  mockStore.dispatch(markCurrentUserOnboardingWorkflowAsVisited(1) as any);

  const cloneMockResponse = mapToUserOnboardingWorkflows([
    rawCloneMockResponse,
  ])[0]!;

  await waitFor(() => {
    expect(
      mockStore.getState().userOnboardingWorkflows.userOnboardingWorkflows,
    ).toEqual([cloneMockResponse]);
  });

  expect(mockStore.getState().userOnboardingWorkflows.isLoading).toBeFalsy();

  expect(
    mockStore.getState().userOnboardingWorkflows.userOnboardingWorkflowNamesMap,
  ).toEqual({ [cloneMockResponse.onboardingWorkflow.name]: cloneMockResponse });

  makeApiMock.mockClear();
  makeApiMock.mockReset();
});
