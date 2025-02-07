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
import { ReactNode, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { isEmpty } from 'lodash';
import {
  t,
  SupersetTheme,
  css,
  styled,
  FeatureFlag,
  isFeatureEnabled,
  getExtensionsRegistry,
  usePrevious,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Switch } from 'src/components/Switch';
import { AlertObject } from 'src/features/alerts/types';
import { Menu } from 'src/components/Menu';
import Checkbox from 'src/components/Checkbox';
import { noOp } from 'src/utils/common';
import { ChartState } from 'src/explore/types';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  fetchUISpecificReport,
  toggleActive,
} from 'src/features/reports/ReportModal/actions';
import { reportSelector } from 'src/views/CRUD/hooks';
import { MenuItemWithCheckboxContainer } from 'src/explore/components/useExploreAdditionalActionsMenu/index';

const extensionsRegistry = getExtensionsRegistry();

const deleteColor = (theme: SupersetTheme) => css`
  color: ${theme.colors.error.base};
`;

const onMenuHover = (theme: SupersetTheme) => css`
  & .antd5-menu-item {
    padding: 5px 12px;
    margin-top: 0px;
    margin-bottom: 4px;
    :hover {
      color: ${theme.colors.grayscale.dark1};
    }
  }
  :hover {
    background-color: ${theme.colors.secondary.light5};
  }
`;

const onMenuItemHover = (theme: SupersetTheme) => css`
  &:hover {
    color: ${theme.colors.grayscale.dark1};
    background-color: ${theme.colors.secondary.light5};
  }
`;

const StyledDropdownItemWithIcon = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  > *:first-child {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const DropdownItemExtension = extensionsRegistry.get(
  'report-modal.dropdown.item.icon',
);

export enum CreationMethod {
  Charts = 'charts',
  Dashboards = 'dashboards',
}
export interface HeaderReportProps {
  dashboardId?: number;
  chart?: ChartState;
  useTextMenu?: boolean;
  setShowReportSubMenu?: (show: boolean) => void;
  showReportSubMenu?: boolean;
  submenuTitle?: string;
  showReportModal: () => void;
  setCurrentReportDeleting: (report: AlertObject | null) => void;
}

// Same instance to be used in useEffects
const EMPTY_OBJECT = {};

export default function HeaderReportDropDown({
  dashboardId,
  chart,
  useTextMenu = false,
  setShowReportSubMenu,
  submenuTitle,
  showReportModal,
  setCurrentReportDeleting,
}: HeaderReportProps) {
  const dispatch = useDispatch();
  const report = useSelector<any, AlertObject>(state => {
    const resourceType = dashboardId
      ? CreationMethod.Dashboards
      : CreationMethod.Charts;
    return (
      reportSelector(state, resourceType, dashboardId || chart?.id) ||
      EMPTY_OBJECT
    );
  });

  const isReportActive: boolean = report?.active || false;
  const user: UserWithPermissionsAndRoles = useSelector<
    any,
    UserWithPermissionsAndRoles
  >(state => state.user);
  const canAddReports = () => {
    if (!isFeatureEnabled(FeatureFlag.AlertReports)) {
      return false;
    }

    if (!user?.userId) {
      // this is in the case that there is an anonymous user.
      return false;
    }

    // Cannot add reports if the resource is not saved
    if (!(dashboardId || chart?.id)) {
      return false;
    }

    const roles = Object.keys(user.roles || []);
    const permissions = roles.map(key =>
      user.roles[key].filter(
        perms => perms[0] === 'menu_access' && perms[1] === 'Manage',
      ),
    );
    return permissions.some(permission => permission.length > 0);
  };

  const prevDashboard = usePrevious(dashboardId);
  const toggleActiveKey = async (data: AlertObject, checked: boolean) => {
    if (data?.id) {
      dispatch(toggleActive(data, checked));
    }
  };

  const shouldFetch =
    canAddReports() &&
    !!((dashboardId && prevDashboard !== dashboardId) || chart?.id);

  useEffect(() => {
    if (shouldFetch) {
      dispatch(
        fetchUISpecificReport({
          userId: user.userId,
          filterField: dashboardId ? 'dashboard_id' : 'chart_id',
          creationMethod: dashboardId ? 'dashboards' : 'charts',
          resourceId: dashboardId || chart?.id,
        }),
      );
    }
  }, []);

  const showReportSubMenu = report && setShowReportSubMenu && canAddReports();

  useEffect(() => {
    if (showReportSubMenu) {
      setShowReportSubMenu(true);
    } else if (!report && setShowReportSubMenu) {
      setShowReportSubMenu(false);
    }
  }, [report]);

  const handleShowMenu = () => {
    showReportModal();
  };

  const handleDeleteMenuClick = () => {
    setCurrentReportDeleting(report);
  };

  const textMenu = () =>
    isEmpty(report) ? (
      <Menu.SubMenu title={submenuTitle} css={onMenuHover}>
        <Menu.Item onClick={handleShowMenu}>
          {DropdownItemExtension ? (
            <StyledDropdownItemWithIcon>
              <div>{t('Set up an email report')}</div>
              <DropdownItemExtension />
            </StyledDropdownItemWithIcon>
          ) : (
            t('Set up an email report')
          )}
        </Menu.Item>
        <Menu.Divider />
      </Menu.SubMenu>
    ) : (
      <Menu.SubMenu
        title={submenuTitle}
        css={css`
          border: none;
        `}
      >
        <Menu.Item
          css={onMenuItemHover}
          onClick={() => toggleActiveKey(report, !isReportActive)}
        >
          <MenuItemWithCheckboxContainer>
            <Checkbox checked={isReportActive} onChange={noOp} />
            {t('Email reports active')}
          </MenuItemWithCheckboxContainer>
        </Menu.Item>
        <Menu.Item css={onMenuItemHover} onClick={handleShowMenu}>
          {t('Edit email report')}
        </Menu.Item>
        <Menu.Item css={onMenuItemHover} onClick={handleDeleteMenuClick}>
          {t('Delete email report')}
        </Menu.Item>
      </Menu.SubMenu>
    );
  const menu = (title: ReactNode) => (
    <Menu.SubMenu
      title={title}
      css={css`
        width: 200px;
      `}
    >
      <Menu.Item>
        {t('Email reports active')}
        <Switch
          data-test="toggle-active"
          checked={isReportActive}
          onClick={(checked: boolean) => toggleActiveKey(report, checked)}
          size="small"
          css={theme => css`
            margin-left: ${theme.gridUnit * 2}px;
          `}
        />
      </Menu.Item>
      <Menu.Item onClick={() => showReportModal()}>
        {t('Edit email report')}
      </Menu.Item>
      <Menu.Item
        onClick={() => setCurrentReportDeleting(report)}
        css={deleteColor}
      >
        {t('Delete email report')}
      </Menu.Item>
    </Menu.SubMenu>
  );

  const iconMenu = () =>
    isEmpty(report) ? (
      <span
        role="button"
        title={t('Schedule email report')}
        tabIndex={0}
        className="action-button action-schedule-report"
        onClick={() => showReportModal()}
      >
        <Icons.Calendar />
      </span>
    ) : (
      menu(<Icons.Calendar />)
    );
  return <>{canAddReports() && (useTextMenu ? textMenu() : iconMenu())}</>;
}
