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

import { renderHook } from '@testing-library/react-hooks';
import useShouldRenderOnboardingWorkflow from './useShouldRenderOnboardingWorkflow';
import UserOnboardingWorkflow from 'src/types/UserOnboardingWorkflow';
import { OnboardingWorkflowNames } from './constants';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import userOnboardingWorkflowsReducer from 'src/userOnboardingWorkflow/reducers';
import { setUserOnboardingWorkflows } from 'src/userOnboardingWorkflow/actions';

const userOnboardingWorkflowMock: UserOnboardingWorkflow = {
  onboardingWorkflow: {
    description:
      'Onboarding workflow for creating a dashboard with none existing chart',
    id: 1,
    name: OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
  },
  onboardingWorkflowId: 1,
  userId: 1,
  visitedTimes: 0,
  shouldVisit: true,
};

const originalFeatureFlags = window.featureFlags;

test('useShouldRenderOnboardingWorkflow should return true', () => {
  window.featureFlags = { ENABLE_ONBOARDING_WORKFLOWS: true };

  const mockStore = configureStore({
    reducer: {
      userOnboardingWorkflows: userOnboardingWorkflowsReducer,
    },
  });

  const hookResult = renderHook(
    () =>
      useShouldRenderOnboardingWorkflow(
        OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      ),
    {
      wrapper: ({ children }) => (
        <Provider store={mockStore}>{children}</Provider>
      ),
    },
  );

  mockStore.dispatch(setUserOnboardingWorkflows([userOnboardingWorkflowMock]));

  expect(hookResult.result.current).toBe(true);

  window.featureFlags = originalFeatureFlags;
});

test('useShouldRenderOnboardingWorkflow should return false', () => {
  const mockStore = configureStore({
    reducer: {
      userOnboardingWorkflows: userOnboardingWorkflowsReducer,
    },
  });

  const hookResult = renderHook(
    () =>
      useShouldRenderOnboardingWorkflow(
        OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      ),
    {
      wrapper: ({ children }) => (
        <Provider store={mockStore}>{children}</Provider>
      ),
    },
  );

  expect(hookResult.result.current).toBe(false);
});
