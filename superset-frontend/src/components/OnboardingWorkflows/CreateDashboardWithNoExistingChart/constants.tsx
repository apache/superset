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

import { Step } from 'react-joyride';
import buildOnboardingWorkflowStepId from '../utils';
import { OnboardingWorkflowNames } from '../constants';
import { t } from '@apache-superset/core';
import { ComponentProps } from 'react';
import OnboardingWorkflow from '..';

export const WELCOME_PAGE = '/superset/welcome';
export const DASHBOARD_LIST_PAGE = '/dashboard/list';
export const SUPERSET_DASHBOARD_PAGE = '/superset/dashboard/';
export const CHART_ADD_PAGE = '/chart/add';
export const EXPLORE_PAGE = '/explore';

export const INTRO_STEP_INDEX = 0;
export const GO_TO_DASHBOARDS_STEP_INDEX = 1;
export const GO_TO_CREATE_DASHBOARD_STEP_INDEX = 2;
export const EDIT_DASHBOARD_NAME_STEP_INDEX = 3;
export const SAVE_DASHBOARD_STEP_INDEX = 4;
export const EDIT_DASHBOARD_STEP_INDEX = 5;
export const GO_TO_CREATE_CHART_STEP_INDEX = 6;
export const SELECT_DATASET_STEP_INDEX = 7;
export const SELECT_CHART_STEP_INDEX = 8;
export const GO_TO_CONFIGURE_CHART_STEP_INDEX = 9;
export const EDIT_CHART_NAME_STEP_INDEX = 10;
export const EDIT_CHART_DATA_FILTERS_STEP_INDEX = 11;
export const CREATE_CHART_DATA_WITH_FILTERS_STEP_INDEX = 12;
export const OPEN_SAVE_CHART_TO_DASHBOARD_MODAL_STEP_INDEX = 13;
export const SAVE_CHART_AND_GO_TO_DASHBOARD_PAGE_STEP_INDEX = 14;
export const FINAL_STEP_INDEX = 15;

export const STEPS_MAPPING: Record<string, { stepIndices: number[] }> = {
  [WELCOME_PAGE]: {
    stepIndices: [INTRO_STEP_INDEX, GO_TO_DASHBOARDS_STEP_INDEX],
  },
  [DASHBOARD_LIST_PAGE]: {
    stepIndices: [GO_TO_CREATE_DASHBOARD_STEP_INDEX],
  },
  [SUPERSET_DASHBOARD_PAGE]: {
    stepIndices: [
      EDIT_DASHBOARD_NAME_STEP_INDEX,
      SAVE_DASHBOARD_STEP_INDEX,
      EDIT_DASHBOARD_STEP_INDEX,
      GO_TO_CREATE_CHART_STEP_INDEX,
      FINAL_STEP_INDEX,
    ],
  },
  [CHART_ADD_PAGE]: {
    stepIndices: [
      SELECT_DATASET_STEP_INDEX,
      SELECT_CHART_STEP_INDEX,
      GO_TO_CONFIGURE_CHART_STEP_INDEX,
      GO_TO_CREATE_CHART_STEP_INDEX,
    ],
  },
  [EXPLORE_PAGE]: {
    stepIndices: [
      EDIT_CHART_NAME_STEP_INDEX,
      EDIT_CHART_DATA_FILTERS_STEP_INDEX,
      CREATE_CHART_DATA_WITH_FILTERS_STEP_INDEX,
      OPEN_SAVE_CHART_TO_DASHBOARD_MODAL_STEP_INDEX,
      SAVE_CHART_AND_GO_TO_DASHBOARD_PAGE_STEP_INDEX,
    ],
  },
};

export const DEFAULT_STYLES: ComponentProps<
  typeof OnboardingWorkflow
>['styles'] = {
  options: { zIndex: 10000 },
  overlay: { height: 'inherit' },
};

export const STEPS: (Step & { targetClassName: string })[] = [
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    disableOverlayClose: true,
    locale: { next: t("Let's start!") },
    placement: 'center',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, INTRO_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      INTRO_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>🚀 {t('Welcome aboard!')}</h3>
        <p>
          {t(
            'Let’s create your very first dashboard — even if you don’t have any charts yet.',
          )}
        </p>
        <p>
          {t('It only takes a few steps, and we’ll guide you the whole way.')}
        </p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, GO_TO_DASHBOARDS_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      GO_TO_DASHBOARDS_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>📊 {t('Dashboards')}</h3>
        <p>{t('Dashboards are where insights come together.')}</p>
        <p>{t('Click here to explore your dashboards.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, GO_TO_CREATE_DASHBOARD_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      GO_TO_CREATE_DASHBOARD_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>✨ {t('Create a Dashboard')}</h3>
        <p>{t('Let’s start with a fresh, blank canvas.')}</p>
        <p>{t('Click here to create a new dashboard.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, EDIT_DASHBOARD_NAME_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      EDIT_DASHBOARD_NAME_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>🏷️ {t('Name Your Dashboard')}</h3>
        <p>{t('Choose a clear and memorable name.')}</p>
        <p>{t('You can always update it later if needed.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: { ...DEFAULT_STYLES, options: { zIndex: 10 } },
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, SAVE_DASHBOARD_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      SAVE_DASHBOARD_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>💾 {t('Save Your Dashboard')}</h3>
        <p>{t("Don't forget to save your dashboard name.")}</p>
        <p>{t('It’s an easy step to miss!')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'top',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, EDIT_DASHBOARD_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      EDIT_DASHBOARD_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>📈 {t('Edit Your First Dashboard')}</h3>
        <p>{t("Charts bring your dashboard to life, let's add some.")}</p>
        <p>{t('Click here to edit your first dashboard.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'top',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, GO_TO_CREATE_CHART_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      GO_TO_CREATE_CHART_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>📈 {t('Add Your First Chart')}</h3>
        <p>{t('Charts bring your dashboard to life.')}</p>
        <p>{t('Click here to create your first chart.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, SELECT_DATASET_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      SELECT_DATASET_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>🗂️ {t('Select a Dataset')}</h3>
        <p>{t('Choose the dataset you want to explore.')}</p>
        <p>{t('You can always experiment and adjust later.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, SELECT_CHART_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      SELECT_CHART_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>📊 {t('Choose a Chart Type')}</h3>
        <p>{t('Select the chart type that best represents your data.')}</p>
        <p>{t('Feel free to explore different visualizations.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, GO_TO_CONFIGURE_CHART_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      GO_TO_CONFIGURE_CHART_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>🎛️ {t('Customize Your Chart')}</h3>
        <p>
          {t('Now it’s time to configure your chart and make it your own.')}
        </p>
        <p>{t('Adjust settings, metrics, and dimensions as needed.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: { ...DEFAULT_STYLES, options: { zIndex: 10 } },
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, EDIT_CHART_NAME_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      EDIT_CHART_NAME_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>🏷️ {t('Name Your Chart')}</h3>
        <p>{t('Give your chart a descriptive name.')}</p>
        <p>{t('This helps others understand it instantly.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    disableOverlayClose: true,
    placement: 'right',
    spotlightClicks: true,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, EDIT_CHART_DATA_FILTERS_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      EDIT_CHART_DATA_FILTERS_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>⚙️ {t('Complete Required Settings')}</h3>
        <p>
          {t(
            'Make sure all required fields are properly configured before saving.',
          )}
        </p>
        <p>{t('Superset gives you powerful customization options.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'top',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, CREATE_CHART_DATA_WITH_FILTERS_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      CREATE_CHART_DATA_WITH_FILTERS_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>▶️ {t('Create the Chart')}</h3>
        <p>{t('Let’s generate your visualization.')}</p>
        <p>{t('Click “Create chart” to continue.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'bottom',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, OPEN_SAVE_CHART_TO_DASHBOARD_MODAL_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      OPEN_SAVE_CHART_TO_DASHBOARD_MODAL_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>💾 {t('Save the Chart')}</h3>
        <p>{t('Save your chart configuration and applied filters.')}</p>
        <p>{t('Click “Save” to proceed.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'top',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, SAVE_CHART_AND_GO_TO_DASHBOARD_PAGE_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      SAVE_CHART_AND_GO_TO_DASHBOARD_PAGE_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>📌 {t('Add Chart to Dashboard')}</h3>
        <p>{t('Save the chart and add it directly to your dashboard.')}</p>
        <p>{t('Click “Save & go to dashboard” to finish.')}</p>
      </div>
    ),
  },
  {
    disableBeacon: true,
    showSkipButton: false,
    hideBackButton: true,
    hideFooter: true,
    disableOverlayClose: true,
    placement: 'center',
    spotlightClicks: true,
    styles: DEFAULT_STYLES,
    target: `.${buildOnboardingWorkflowStepId(OnboardingWorkflowNames.CreateDashboardWithNoExistingChart, FINAL_STEP_INDEX)}`,
    targetClassName: buildOnboardingWorkflowStepId(
      OnboardingWorkflowNames.CreateDashboardWithNoExistingChart,
      FINAL_STEP_INDEX,
    ),
    content: (
      <div>
        <h3>🎉 {t('Congratulations!')}</h3>
        <p>
          {t(
            'You’ve successfully created a dashboard and added your first chart!',
          )}
        </p>
        <p>{t('Great work — keep exploring and building insights!')}</p>
      </div>
    ),
  },
];
