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
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  t,
  styled,
  FeatureFlag,
  isFeatureEnabled,
  getExtensionsRegistry,
  usePrevious,
  css,
} from '@superset-ui/core';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { Checkbox } from '@superset-ui/core/components';
import { AlertObject } from 'src/features/alerts/types';
import { noOp } from 'src/utils/common';
import { ChartState } from 'src/explore/types';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  fetchUISpecificReport,
  toggleActive,
} from 'src/features/reports/ReportModal/actions';
import { MenuItemWithCheckboxContainer } from 'src/explore/components/useExploreAdditionalActionsMenu/index';

const extensionsRegistry = getExtensionsRegistry();

export enum CreationMethod {
  Charts = 'charts',
  Dashboards = 'dashboards',
}

const StyledDropdownItemWithIcon = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  > *:first-child {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const DropdownItemExtension = extensionsRegistry.get(
  'report-modal.dropdown.item.icon',
);

export interface HeaderReportProps {
  dashboardId?: number;
  chart?: ChartState;
  showReportModal: () => void;
  setCurrentReportDeleting: (report: AlertObject | null) => void;
}

export const useHeaderReportMenuItems = ({
  dashboardId,
  chart,
  showReportModal,
  setCurrentReportDeleting,
}: HeaderReportProps): MenuItem | null => {
  const dispatch = useDispatch();
  const resourceId = dashboardId || chart?.id;
  const resourceType = dashboardId
    ? CreationMethod.Dashboards
    : CreationMethod.Charts;

  // Select the reports state and specific report with proper reactivity
  const report = useSelector<any, AlertObject | null>(state => {
    if (!resourceId) return null;
    // Select directly from the reports state to ensure reactivity
    const reportsState = state.reports || {};
    const resourceTypeReports = reportsState[resourceType] || {};
    const reportData = resourceTypeReports[resourceId];

    return reportData || null;
  });

  const user: UserWithPermissionsAndRoles = useSelector<
    any,
    UserWithPermissionsAndRoles
  >(state => state.user);

  const prevDashboard = usePrevious(dashboardId);

  // Check if user can add reports
  const canAddReports = () => {
    if (!isFeatureEnabled(FeatureFlag.AlertReports)) return false;
    if (!user?.userId) return false;
    if (!resourceId) return false;

    const roles = Object.keys(user.roles || []);
    const permissions = roles.map(key =>
      user.roles[key].filter(
        perms => perms[0] === 'menu_access' && perms[1] === 'Manage',
      ),
    );
    return permissions.some(permission => permission.length > 0);
  };

  const shouldFetch =
    canAddReports() &&
    !!((dashboardId && prevDashboard !== dashboardId) || chart?.id);

  // Fetch report data when needed
  useEffect(() => {
    if (shouldFetch) {
      dispatch(
        fetchUISpecificReport({
          userId: user.userId,
          filterField: dashboardId ? 'dashboard_id' : 'chart_id',
          creationMethod: dashboardId ? 'dashboards' : 'charts',
          resourceId,
        }),
      );
    }
  }, [dispatch, shouldFetch, user?.userId, dashboardId, resourceId]);

  // Don't show anything if user can't add reports
  if (!canAddReports()) {
    return null;
  }

  // Handler functions
  const handleShowModal = () => showReportModal();
  const handleDeleteReport = () => setCurrentReportDeleting(report);
  const handleToggleActive = () => {
    if (report?.id) {
      dispatch(toggleActive(report, !report.active));
    }
  };

  // If no report exists, show "Set up email report" option
  if (!report || !report.id) {
    return {
      key: 'email-report-setup',
      type: 'submenu',
      label: t('Manage email report'),
      children: [
        {
          key: 'set-up-report',
          label: DropdownItemExtension ? (
            <StyledDropdownItemWithIcon>
              <div>{t('Set up an email report')}</div>
              <DropdownItemExtension />
            </StyledDropdownItemWithIcon>
          ) : (
            t('Set up an email report')
          ),
          onClick: handleShowModal,
        },
      ],
    };
  }

  // If report exists, show management options
  return {
    key: 'email-report-manage',
    type: 'submenu',
    label: t('Manage email report'),
    children: [
      {
        key: 'toggle-active',
        label: (
          <MenuItemWithCheckboxContainer>
            <Checkbox
              checked={report.active || false}
              onChange={noOp}
              css={theme => css`
                margin-right: ${theme.sizeUnit}px;
              `}
            />
            {t('Email reports active')}
          </MenuItemWithCheckboxContainer>
        ),
        onClick: handleToggleActive,
      },
      {
        key: 'edit-report',
        label: t('Edit email report'),
        onClick: handleShowModal,
      },
      {
        key: 'delete-report',
        label: t('Delete email report'),
        onClick: handleDeleteReport,
        danger: true,
      },
    ],
  };
};
