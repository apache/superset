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

import { makeApi } from '@superset-ui/core';
import { ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';
import UserOnboardingWorkflow, {
  RawUserOnboardingWorkflow,
} from 'src/types/UserOnboardingWorkflow';
import mapToUserOnboardingWorkflows from './utils';

const getCurrentUserOnboardingWorkflowsApi = () =>
  makeApi<void, { result: RawUserOnboardingWorkflow[] }>({
    method: 'GET',
    endpoint: '/api/v1/me/onboarding-workflows/',
  });

const markCurrentUserOnboardingWorkflowAsVisitedApi = (
  userOnboardingWorkflowId: number,
) =>
  makeApi<void, { result: UserOnboardingWorkflow[] }>({
    method: 'PATCH',
    endpoint: `/api/v1/me/onboarding-workflows/${userOnboardingWorkflowId}/set-visited`,
  });

export function setUserOnboardingWorkflows(
  userOnboardingWorkflows: UserOnboardingWorkflow[],
) {
  return {
    type: 'SET_USER_ONBOARDING_WORKFLOWS',
    payload: userOnboardingWorkflows,
  };
}

export function setUserOnboardingWorkflowsIsLoading(isLoading: boolean) {
  return {
    type: 'SET_USER_ONBOARDING_WORKFLOWS_IS_LOADING',
    payload: isLoading,
  };
}

export function resetUserOnboardingWorkflowsState() {
  return {
    type: 'RESET_USER_ONBOARDING_WORKFLOWS_STATE',
  };
}
export function setUserOnboardingWorkflowsError(error: string) {
  return {
    type: 'SET_USER_ONBOARDING_WORKFLOWS_ERROR',
    payload: error,
  };
}

export function setUserOnboardingWorkflowsStepIndex(stepIndex: number) {
  return {
    type: 'SET_USER_ONBOARDING_WORKFLOWS_STEP_INDEX',
    payload: stepIndex,
  };
}

export function fetchCurrentUserOnboardingworkflows() {
  return async function (dispatch: ThunkDispatch<any, undefined, AnyAction>) {
    try {
      dispatch(setUserOnboardingWorkflowsIsLoading(true));
      const response = await getCurrentUserOnboardingWorkflowsApi()();

      const mappedUserOnboardingWorkflows: UserOnboardingWorkflow[] =
        mapToUserOnboardingWorkflows(response.result);

      dispatch(setUserOnboardingWorkflows(mappedUserOnboardingWorkflows));
    } catch (error) {
      dispatch(setUserOnboardingWorkflowsError(error.message));
    }
  };
}

export function markCurrentUserOnboardingWorkflowAsVisited(
  userOnboardingWorkflowId: number,
) {
  return async function (dispatch: ThunkDispatch<any, undefined, AnyAction>) {
    try {
      dispatch(setUserOnboardingWorkflowsIsLoading(true));

      await markCurrentUserOnboardingWorkflowAsVisitedApi(
        userOnboardingWorkflowId,
      )();

      const response = await getCurrentUserOnboardingWorkflowsApi()();

      const mappedUserOnboardingWorkflows: UserOnboardingWorkflow[] =
        mapToUserOnboardingWorkflows(response.result);

      dispatch(setUserOnboardingWorkflows(mappedUserOnboardingWorkflows));
    } catch (error) {
      dispatch(setUserOnboardingWorkflowsError(error.message));
    }
  };
}

export type OnboardingWorkflowActions =
  | {
      type: 'SET_USER_ONBOARDING_WORKFLOWS';
      payload: UserOnboardingWorkflow[] | null;
    }
  | {
      type: 'SET_USER_ONBOARDING_WORKFLOWS_IS_LOADING';
      payload: boolean;
    }
  | {
      type: 'SET_USER_ONBOARDING_WORKFLOWS_ERROR';
      payload: string;
    }
  | {
      type: 'RESET_USER_ONBOARDING_WORKFLOWS_STATE';
    }
  | {
      type: 'SET_USER_ONBOARDING_WORKFLOWS_STEP_INDEX';
      payload: number;
    };
