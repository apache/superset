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

import { CallBackProps, Step } from 'react-joyride';

const ONBOARDING_WORKFLOW_LOCAL_STORAGE_KEY = 'onboarding_workflows_state';

export default function buildOnboardingWorkflowStepId(
  workflowName: string,
  stepNumber: number,
) {
  return `${workflowName}-step-${stepNumber}`;
}

export const setZIndexForStepTarget = (
  steps: (Step & { targetClassName: string })[],
  stepIdx: number,
  zIndex: string,
) => {
  if (
    stepIdx > 0 &&
    stepIdx < steps.length &&
    document.querySelector(steps[stepIdx].targetClassName)
  ) {
    const el = document.querySelector(
      steps[stepIdx].targetClassName,
    ) as HTMLElement;
    el.style.zIndex = zIndex;
  }
};

export const getOnboardingWorkflowStateFromLocalStorage = (
  onboardingWorkflowName: string,
): CallBackProps | undefined => {
  const stateStr = localStorage.getItem(ONBOARDING_WORKFLOW_LOCAL_STORAGE_KEY);

  if (!stateStr) {
    return undefined;
  }

  const state = JSON.parse(stateStr);

  return state[onboardingWorkflowName];
};

export const setOnboardingWorkflowStateToLocalStorage = (
  onboardingWorkflowName: string,
  callbackProps: CallBackProps,
) => {
  let stateStr = localStorage.getItem(ONBOARDING_WORKFLOW_LOCAL_STORAGE_KEY);

  if (!stateStr) {
    stateStr = '{}';
  }

  const state = JSON.parse(stateStr);

  const clonedCallbackProps: Record<string, unknown> = { ...callbackProps };
  delete clonedCallbackProps.step;

  state[onboardingWorkflowName] = clonedCallbackProps;

  localStorage.setItem(
    ONBOARDING_WORKFLOW_LOCAL_STORAGE_KEY,
    JSON.stringify(state),
  );
};

export const removeOnboardingWorkflowStateFromLocalStorage = (
  onboardingWorkflowName: string,
) => {
  let stateStr = localStorage.getItem(ONBOARDING_WORKFLOW_LOCAL_STORAGE_KEY);

  if (!stateStr) {
    return;
  }

  const state = JSON.parse(stateStr);

  delete state[onboardingWorkflowName];

  localStorage.setItem(
    ONBOARDING_WORKFLOW_LOCAL_STORAGE_KEY,
    JSON.stringify(state),
  );
};
