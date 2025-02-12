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
import { t, logging } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { getDashboardPermalink } from 'src/utils/urlUtils';
import { MenuKeys, RootState } from 'src/dashboard/types';
import { shallowEqual, useSelector } from 'react-redux';

interface ShareMenuItemProps extends ComponentProps<typeof Menu.SubMenu> {
  url?: string;
  copyMenuItemTitle: string;
  emailMenuItemTitle: string;
  emailSubject: string;
  emailBody: string;
  addDangerToast: Function;
  addSuccessToast: Function;
  dashboardId: string | number;
  dashboardComponentId?: string;
  copyMenuItemRef?: RefObject<any>;
  shareByEmailMenuItemRef?: RefObject<any>;
  selectedKeys?: string[];
  setOpenKeys?: Function;
  title: string;
  disabled?: boolean;
}

const ShareMenuItems = (props: ShareMenuItemProps) => {
  const {
    copyMenuItemTitle,
    emailMenuItemTitle,
    emailSubject,
    emailBody,
    addDangerToast,
    addSuccessToast,
    dashboardId,
    dashboardComponentId,
    title,
    disabled,
    ...rest
  } = props;
  const { dataMask, activeTabs } = useSelector(
    (state: RootState) => ({
      dataMask: state.dataMask,
      activeTabs: state.dashboardState.activeTabs,
    }),
    shallowEqual,
  );

  async function generateUrl() {
    return getDashboardPermalink({
      dashboardId,
      dataMask,
      activeTabs,
      anchor: dashboardComponentId,
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

  return (
    <Menu.SubMenu
      title={title}
      key={MenuKeys.Share}
      disabled={disabled}
      {...rest}
    >
      <Menu.Item key={MenuKeys.CopyLink} onClick={() => onCopyLink()}>
        {copyMenuItemTitle}
      </Menu.Item>
      <Menu.Item key={MenuKeys.ShareByEmail} onClick={() => onShareByEmail()}>
        {emailMenuItemTitle}
      </Menu.Item>
    </Menu.SubMenu>
  );
};
export default ShareMenuItems;
