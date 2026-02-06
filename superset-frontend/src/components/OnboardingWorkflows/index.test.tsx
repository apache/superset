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

import UserOnboardingWorkflow from 'src/types/UserOnboardingWorkflow';
import { OnboardingWorkflowNames } from './constants';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import userOnboardingWorkflowsReducer from 'src/userOnboardingWorkflow/reducers';
import { setUserOnboardingWorkflows } from 'src/userOnboardingWorkflow/actions';
import { render, screen, waitFor } from '@testing-library/react';
import OnboardingWorkflow from '.';
import * as userOnboardingWorkflowActions from 'src/userOnboardingWorkflow/actions';
import userEvent from '@testing-library/user-event';

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
const markCurrentUserOnboardingWorkflowAsVisitedSpy = jest
  .spyOn(
    userOnboardingWorkflowActions,
    'markCurrentUserOnboardingWorkflowAsVisited',
  )
  .mockImplementation(() => () => Promise.resolve());

test('OnboardingWorkflow should mark workflow as visited', async () => {
  window.featureFlags = { ENABLE_ONBOARDING_WORKFLOWS: true };

  const mockStore = configureStore({
    reducer: {
      userOnboardingWorkflows: userOnboardingWorkflowsReducer,
    },
  });

  mockStore.dispatch(setUserOnboardingWorkflows([userOnboardingWorkflowMock]));

  render(
    <Provider store={mockStore}>
      <OnboardingWorkflow
        onboardginWorkflowName={
          OnboardingWorkflowNames.CreateDashboardWithNoExistingChart
        }
        run
        steps={[{ target: '#target-element', content: 'Step 1' }]}
      />
      <div id="target-element">Target Element</div>
    </Provider>,
  );

  userEvent.click(screen.getByRole('button', { name: 'Open the dialog' }));
  userEvent.click(screen.getByText('Last'));

  await waitFor(() => {
    expect(markCurrentUserOnboardingWorkflowAsVisitedSpy).toHaveBeenCalledWith(
      1,
    );
  });

  window.featureFlags = originalFeatureFlags;
});
