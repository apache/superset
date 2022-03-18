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
import React from 'react';
import copyTextToClipboard from 'src/utils/copy';
import { t, logging, QueryFormData } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import {
  getChartPermalink,
  getDashboardPermalink,
  getUrlParam,
} from 'src/utils/urlUtils';
import { RESERVED_DASHBOARD_URL_PARAMS, URL_PARAMS } from 'src/constants';
import { getFilterValue } from 'src/dashboard/components/nativeFilters/FilterBar/keyValue';

interface ShareMenuItemProps {
  url?: string;
  copyMenuItemTitle: string;
  emailMenuItemTitle: string;
  emailSubject: string;
  emailBody: string;
  addDangerToast: Function;
  addSuccessToast: Function;
  dashboardId?: string;
  formData?: Pick<QueryFormData, 'slice_id' | 'datasource'>;
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
    formData,
    ...rest
  } = props;

  async function generateUrl() {
    // chart
    if (formData) {
      // we need to remove reserved dashboard url params
      return getChartPermalink(formData, RESERVED_DASHBOARD_URL_PARAMS);
    }
    // dashboard
    const nativeFiltersKey = getUrlParam(URL_PARAMS.nativeFiltersKey);
    let filterState = {};
    if (nativeFiltersKey && dashboardId) {
      filterState = await getFilterValue(dashboardId, nativeFiltersKey);
    }
    return getDashboardPermalink(String(dashboardId), filterState);
  }

  async function onCopyLink() {
    try {
      const url = await generateUrl();
      await copyTextToClipboard(url);
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
    <>
      <Menu.Item key="copy-url" {...rest}>
        <div onClick={onCopyLink} role="button" tabIndex={0}>
          {copyMenuItemTitle}
        </div>
      </Menu.Item>
      <Menu.Item key="share-by-email" {...rest}>
        <div onClick={onShareByEmail} role="button" tabIndex={0}>
          {emailMenuItemTitle}
        </div>
      </Menu.Item>
    </>
  );
};

export default ShareMenuItems;
