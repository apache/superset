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
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { t, SupersetTheme, css, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Switch } from 'src/components/Switch';
import { AlertObject } from 'src/views/CRUD/alert/types';
import { Menu } from 'src/components/Menu';
import { NoAnimationDropdown } from 'src/components/Dropdown';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';

import DeleteModal from 'src/components/DeleteModal';

const deleteColor = (theme: SupersetTheme) => css`
  color: ${theme.colors.error.base};
`;

export default function HeaderReportActionsDropDown({
  showReportModal,
  toggleActive,
  deleteActiveReport,
}: {
  showReportModal: () => void;
  toggleActive: (data: AlertObject, checked: boolean) => void;
  deleteActiveReport: (data: AlertObject) => void;
}) {
  const reports = useSelector<any, AlertObject>(state => state.reports);
  const reportsIds = Object.keys(reports);
  const report = reports[reportsIds[0]];
  const [currentReportDeleting, setCurrentReportDeleting] =
    useState<AlertObject | null>(null);
  const theme = useTheme();

  const toggleActiveKey = async (data: AlertObject, checked: boolean) => {
    if (data?.id) {
      toggleActive(data, checked);
    }
  };

  const handleReportDelete = (report: AlertObject) => {
    deleteActiveReport(report);
    setCurrentReportDeleting(null);
  };

  const menu = () => (
    <Menu selectable={false} css={{ width: '200px' }}>
      <Menu.Item>
        {t('Email reports active')}
        <Switch
          data-test="toggle-active"
          checked={report?.active}
          onClick={(checked: boolean) => toggleActiveKey(report, checked)}
          size="small"
          css={{ marginLeft: theme.gridUnit * 2 }}
        />
      </Menu.Item>
      <Menu.Item onClick={showReportModal}>{t('Edit email report')}</Menu.Item>
      <Menu.Item
        onClick={() => setCurrentReportDeleting(report)}
        css={deleteColor}
      >
        {t('Delete email report')}
      </Menu.Item>
    </Menu>
  );

  return isFeatureEnabled(FeatureFlag.ALERT_REPORTS) ? (
    <>
      <NoAnimationDropdown
        // ref={ref}
        overlay={menu()}
        trigger={['click']}
        getPopupContainer={(triggerNode: any) =>
          triggerNode.closest('.action-button')
        }
      >
        <span role="button" className="action-button" tabIndex={0}>
          <Icons.Calendar />
        </span>
      </NoAnimationDropdown>
      {currentReportDeleting && (
        <DeleteModal
          description={t(
            'This action will permanently delete %s.',
            currentReportDeleting.name,
          )}
          onConfirm={() => {
            if (currentReportDeleting) {
              handleReportDelete(currentReportDeleting);
            }
          }}
          onHide={() => setCurrentReportDeleting(null)}
          open
          title={t('Delete Report?')}
        />
      )}
    </>
  ) : null;
}
