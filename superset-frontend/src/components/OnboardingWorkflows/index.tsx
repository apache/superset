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
import { ComponentProps } from 'react';
import useShouldRenderOnboardingWorkflow from './useShouldRenderOnboardingWorkflow';
import Joyride, { ACTIONS, CallBackProps, ORIGIN, STATUS } from 'react-joyride';
import { useDispatch, useSelector } from 'react-redux';
import UserOnboardingWorkflowsState from 'src/userOnboardingWorkflow/types';
import { markCurrentUserOnboardingWorkflowAsVisited } from 'src/userOnboardingWorkflow/actions';

type OnboardingWorkflowProps = {
  onboardginWorkflowName: string;
  run?: ComponentProps<typeof Joyride>['run'];
  steps: ComponentProps<typeof Joyride>['steps'];
  locale?: ComponentProps<typeof Joyride>['locale'];
  stepIndex?: ComponentProps<typeof Joyride>['stepIndex'];
  callback?: ComponentProps<typeof Joyride>['callback'];
  styles?: ComponentProps<typeof Joyride>['styles'];
};

export default function OnboardingWorkflow({
  onboardginWorkflowName,
  run,
  steps,
  locale,
  stepIndex,
  callback,
  styles,
}: OnboardingWorkflowProps) {
  const dispatch = useDispatch();
  const userOnboardingWorkflowNamesMap = useSelector(
    (state: { userOnboardingWorkflows: UserOnboardingWorkflowsState }) =>
      state.userOnboardingWorkflows.userOnboardingWorkflowNamesMap || {},
  );

  const shouldRenderOnboardingWorkflow = useShouldRenderOnboardingWorkflow(
    onboardginWorkflowName,
  );

  if (!shouldRenderOnboardingWorkflow) {
    return null;
  }

  const handleJoyrideCallback = (data: CallBackProps) => {
    callback?.(data);

    const { status, action } = data;

    if (
      (ORIGIN.BUTTON_CLOSE && action === ACTIONS.CLOSE) ||
      status === STATUS.FINISHED
    ) {
      const userOnboardingWorkflow =
        userOnboardingWorkflowNamesMap[onboardginWorkflowName];

      dispatch(
        markCurrentUserOnboardingWorkflowAsVisited(
          userOnboardingWorkflow.onboardingWorkflowId,
        ) as any,
      );
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      run={run}
      stepIndex={stepIndex}
      scrollOffset={64}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      locale={locale}
      styles={styles}
    />
  );
}
