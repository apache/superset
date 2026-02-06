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
import {
  ACTIONS,
  CallBackProps,
  Events,
  EVENTS,
  LIFECYCLE,
  ORIGIN,
  STATUS,
} from 'react-joyride';
import {
  WELCOME_PAGE,
  DASHBOARD_LIST_PAGE,
  SUPERSET_DASHBOARD_PAGE,
  CHART_ADD_PAGE,
  EXPLORE_PAGE,
  INTRO_STEP_INDEX,
  GO_TO_CREATE_DASHBOARD_STEP_INDEX,
  EDIT_DASHBOARD_NAME_STEP_INDEX,
  EDIT_DASHBOARD_STEP_INDEX,
  SELECT_DATASET_STEP_INDEX,
  EDIT_CHART_NAME_STEP_INDEX,
  EDIT_CHART_DATA_FILTERS_STEP_INDEX,
  FINAL_STEP_INDEX,
  STEPS,
  DEFAULT_STYLES,
  SAVE_CHART_AND_GO_TO_DASHBOARD_PAGE_STEP_INDEX,
} from './constants';
import { useEffect, useMemo, useState } from 'react';
import {
  getOnboardingWorkflowStateFromLocalStorage,
  removeOnboardingWorkflowStateFromLocalStorage,
  setOnboardingWorkflowStateToLocalStorage,
  setZIndexForStepTarget,
} from '../utils';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import UserOnboardingWorkflowsState from 'src/userOnboardingWorkflow/types';
import { setUserOnboardingWorkflowsStepIndex } from 'src/userOnboardingWorkflow/actions';
import { OnboardingWorkflowNames } from '../constants';
import OnboardingWorkflow from '..';
import getCurrentPageFromLocation from './utils';

export default function CreateDashboardWithNoExistingChartOnboardingWorkflow() {
  const location = useLocation();
  const { pathname } = location;
  const currentPage = useMemo(
    () => getCurrentPageFromLocation(pathname) || '',
    [pathname],
  );
  const dispatch = useDispatch();

  const stepIndex = useSelector(
    (state: { userOnboardingWorkflows: UserOnboardingWorkflowsState }) =>
      state.userOnboardingWorkflows.onboardingWorkflowStepIndex,
  );

  useEffect(() => {
    dispatch(
      setUserOnboardingWorkflowsStepIndex(
        getOnboardingWorkflowStateFromLocalStorage(
          OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
        )?.index || INTRO_STEP_INDEX,
      ),
    );
  }, []);

  useEffect(() => {
    setZIndexForStepTarget(STEPS, stepIndex - 1, '');
    setZIndexForStepTarget(STEPS, stepIndex, '99999');
  }, [stepIndex]);

  const [run, setRun] = useState(true);

  useEffect(() => {
    let nextStep = -1;
    const currentIdx =
      getOnboardingWorkflowStateFromLocalStorage(
        OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      )?.index || 0;

    if (currentPage === WELCOME_PAGE) {
      nextStep = INTRO_STEP_INDEX;
    } else if (currentPage === DASHBOARD_LIST_PAGE) {
      nextStep = GO_TO_CREATE_DASHBOARD_STEP_INDEX;
    } else if (currentPage === SUPERSET_DASHBOARD_PAGE) {
      if (currentIdx === EDIT_DASHBOARD_STEP_INDEX) {
        nextStep = EDIT_DASHBOARD_STEP_INDEX;
      } else if (currentIdx >= SAVE_CHART_AND_GO_TO_DASHBOARD_PAGE_STEP_INDEX) {
        nextStep = FINAL_STEP_INDEX;
      } else {
        nextStep = EDIT_DASHBOARD_NAME_STEP_INDEX;
      }
    } else if (currentPage === CHART_ADD_PAGE) {
      nextStep = SELECT_DATASET_STEP_INDEX;
    } else if (currentPage === EXPLORE_PAGE) {
      nextStep = EDIT_CHART_NAME_STEP_INDEX;
    }

    if (nextStep >= INTRO_STEP_INDEX) {
      const handler = setInterval(() => {
        if (document.querySelector(STEPS[nextStep].target.toString())) {
          clearInterval(handler);
          setZIndexForStepTarget(STEPS, nextStep, '99999');
          dispatch(setUserOnboardingWorkflowsStepIndex(nextStep));
        }
      }, 100);
    }
  }, [location, currentPage]);

  const callback = (data: CallBackProps) => {
    const { type, action, status, lifecycle } = data;

    if (lifecycle === LIFECYCLE.READY && action === ACTIONS.NEXT) {
      setOnboardingWorkflowStateToLocalStorage(
        OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
        data,
      );
    }

    if (
      (ORIGIN.BUTTON_CLOSE && action === ACTIONS.CLOSE) ||
      status === STATUS.FINISHED
    ) {
      dispatch(setUserOnboardingWorkflowsStepIndex(INTRO_STEP_INDEX));

      setRun(false);

      removeOnboardingWorkflowStateFromLocalStorage(
        OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      );
    } else if (([EVENTS.STEP_AFTER] as Events[]).includes(type)) {
      const nextStepIndex = stepIndex + (action === ACTIONS.PREV ? -1 : 1);

      dispatch(setUserOnboardingWorkflowsStepIndex(nextStepIndex));
    }
  };

  return (
    <OnboardingWorkflow
      onboardginWorkflowName={
        OnboardingWorkflowNames.CreateDashboardWithNoExistingChart
      }
      run={run}
      steps={STEPS}
      stepIndex={stepIndex}
      callback={callback}
      styles={
        [
          EDIT_CHART_NAME_STEP_INDEX,
          EDIT_CHART_DATA_FILTERS_STEP_INDEX,
        ].includes(stepIndex)
          ? { ...DEFAULT_STYLES, options: { zIndex: 10 } }
          : DEFAULT_STYLES
      }
    />
  );
}
