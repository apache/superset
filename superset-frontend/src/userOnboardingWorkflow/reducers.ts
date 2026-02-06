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

import { OnboardingWorkflowActions } from './actions';
import type UserOnboardingWorkflowState from './types';

const initialState: UserOnboardingWorkflowState = {
  isLoading: null,
  userOnboardingWorkflows: null,
  userOnboardingWorkflowNamesMap: null,
  onboardingWorkflowStepIndex: 0,
  error: null,
};

export default function userOnboardingWorkflowsReducer(
  state: UserOnboardingWorkflowState = initialState,
  action: OnboardingWorkflowActions,
): UserOnboardingWorkflowState {
  switch (action.type) {
    case 'SET_USER_ONBOARDING_WORKFLOWS':
      return {
        ...state,
        userOnboardingWorkflows: action.payload ?? [],
        userOnboardingWorkflowNamesMap:
          action.payload?.reduce(
            (acc, uow) => ({ ...acc, [uow.onboardingWorkflow.name]: uow }),
            {},
          ) || {},
        isLoading: false,
        error: null,
      };
    case 'SET_USER_ONBOARDING_WORKFLOWS_IS_LOADING':
      return {
        ...state,
        isLoading: action.payload,
        error: null,
      };
    case 'SET_USER_ONBOARDING_WORKFLOWS_ERROR':
      return {
        ...initialState,
        error: action.payload,
      };
    case 'SET_USER_ONBOARDING_WORKFLOWS_STEP_INDEX':
      return {
        ...state,
        onboardingWorkflowStepIndex: action.payload,
      };
    case 'RESET_USER_ONBOARDING_WORKFLOWS_STATE':
      return initialState;
    default:
      return state;
  }
}
