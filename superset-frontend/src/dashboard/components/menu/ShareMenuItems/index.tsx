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
import { ComponentProps, RefObject } from 'react';
import copyTextToClipboard from 'src/utils/copy';
import {
  t,
  logging,
  FeatureFlag,
  isFeatureEnabled,
  LatestQueryFormData,
} from '@superset-ui/core';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import { getDashboardPermalink } from 'src/utils/urlUtils';
import EmbedCodeContent from 'src/explore/components/EmbedCodeContent';
import { ModalTrigger } from '@superset-ui/core/components';
import { MenuKeys, RootState } from 'src/dashboard/types';
import { shallowEqual, useSelector } from 'react-redux';
import { hasStatefulCharts } from 'src/dashboard/util/chartStateConverter';

export interface ShareMenuItemProps extends ComponentProps<
  typeof Menu.SubMenu
> {
  url?: string;
  copyMenuItemTitle: string;
  emailMenuItemTitle: string;
  emailSubject: string;
  emailBody: string;
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  dashboardId: string | number;
  dashboardComponentId?: string;
  latestQueryFormData?: LatestQueryFormData;
  maxWidth?: string;
  copyMenuItemRef?: RefObject<HTMLElement>;
  shareByEmailMenuItemRef?: RefObject<HTMLElement>;
  selectedKeys?: string[];
  setOpenKeys?: (keys: string[] | undefined) => void;
  title: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export const useShareMenuItems = (props: ShareMenuItemProps): MenuItem => {
  const {
    copyMenuItemTitle,
    emailMenuItemTitle,
    emailSubject,
    emailBody,
    addDangerToast,
    addSuccessToast,
    dashboardId,
    dashboardComponentId,
    latestQueryFormData,
    maxWidth,
    title,
    disabled,
    ...rest
  } = props;
  const sliceExists = !!(
    latestQueryFormData && Object.keys(latestQueryFormData).length > 0
  );
  const isEmbedCodeEnabled = isFeatureEnabled(FeatureFlag.EmbeddableCharts);

  const { dataMask, activeTabs, chartStates, sliceEntities } = useSelector(
    (state: RootState) => ({
      dataMask: state.dataMask,
      activeTabs: state.dashboardState.activeTabs,
      chartStates: state.dashboardState.chartStates,
      sliceEntities: state.sliceEntities?.slices,
    }),
    shallowEqual,
  );

  async function generateUrl() {
    // Only include chart state for AG Grid tables
    const includeChartState =
      hasStatefulCharts(sliceEntities) &&
      chartStates &&
      Object.keys(chartStates).length > 0;

    return getDashboardPermalink({
      dashboardId,
      dataMask,
      activeTabs,
      anchor: dashboardComponentId,
      chartStates: includeChartState ? chartStates : undefined,
      includeChartState,
    });
  }

  async function onCopyLink() {
    try {
      await copyTextToClipboard(generateUrl);
      addSuccessToast(t('Copied to clipboard!'));
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }

  async function onShareByEmail() {
    try {
      const encodedBody = encodeURIComponent(
        `${emailBody}${await generateUrl()}`,
      );
      const encodedSubject = encodeURIComponent(emailSubject);
      window.location.href = `mailto:?Subject=${encodedSubject}%20&Body=${encodedBody}`;
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }

  const children: MenuItem[] = [
    {
      key: MenuKeys.CopyLink,
      label: copyMenuItemTitle,
      onClick: onCopyLink,
    },
    {
      key: MenuKeys.ShareByEmail,
      label: emailMenuItemTitle,
      onClick: onShareByEmail,
    },
  ];

  // Add embed code option if feature is enabled and chart data exists
  if (isEmbedCodeEnabled && sliceExists) {
    children.push({
      key: MenuKeys.EmbedCode,
      label: (
        <ModalTrigger
          triggerNode={
            <span data-test="embed-code-button">{t('Embed code')}</span>
          }
          modalTitle={t('Embed code')}
          modalBody={
            <EmbedCodeContent
              formData={latestQueryFormData}
              addDangerToast={addDangerToast}
            />
          }
          maxWidth={maxWidth}
          responsive
        />
      ),
    });
  }

  return {
    ...rest,
    type: 'submenu',
    label: title,
    key: MenuKeys.Share,
    disabled,
    children,
  };
};
