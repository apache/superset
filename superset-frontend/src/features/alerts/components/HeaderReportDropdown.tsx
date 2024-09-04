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
import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { isEmpty } from 'lodash';
import {
  t,
  SupersetTheme,
  css,
  styled,
  useTheme,
  FeatureFlag,
  isFeatureEnabled,
  getExtensionsRegistry,
  usePrevious,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Switch } from 'src/components/Switch';
import { AlertObject, MetaObject } from 'src/features/alerts/types';
import { Menu } from 'src/components/Menu';
import Checkbox from 'src/components/Checkbox';
import { noOp } from 'src/utils/common';
import { NoAnimationDropdown } from 'src/components/Dropdown';
import DeleteModal from 'src/components/DeleteModal';
import AlertReportModal from '../AlertReportModal';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  fetchUISpecificReport,
  toggleActive,
  deleteActiveReport,
  editReport,
  addReport,
} from 'src/features/alerts/actions';
import { reportSelector } from 'src/views/CRUD/hooks';
import { CreationMethod } from 'src/features/alerts/types';
import { MenuItemWithCheckboxContainer } from 'src/explore/components/useExploreAdditionalActionsMenu/index';

const extensionsRegistry = getExtensionsRegistry();

const TRANSLATIONS = {
  CREATE_REPORT: t('Create report'),
  UPDATE_REPORT: t('Edit report'),
  DELETE_REPORT: t('Delete report'),
  ACTIVATE_REPORT: t('Activate report'),
};

const deleteColor = (theme: SupersetTheme) => css`
  color: ${theme.colors.error.base};
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

export interface HeaderReportProps {
  dashboard?: MetaObject;
  chart?: MetaObject;
  useTextMenu?: boolean;
  setShowReportSubMenu?: (show: boolean) => void;
  setIsDropdownVisible?: (visible: boolean) => void;
  isDropdownVisible?: boolean;
}

export default function HeaderReportDropdown({
  dashboard,
  chart,
  useTextMenu = false,
  setShowReportSubMenu,
  setIsDropdownVisible,
  isDropdownVisible,
  ...rest
}: HeaderReportProps) {
  const dispatch = useDispatch();
  const report = useSelector<any, AlertObject>(state => {
    const resourceType = dashboard
      ? CreationMethod.Dashboards
      : CreationMethod.Charts;
    return reportSelector(state, resourceType, dashboard?.id || chart?.id);
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
    if (!(dashboard?.id || chart?.id)) {
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

  const [currentReportDeleting, setCurrentReportDeleting] =
    useState<AlertObject | null>(null);
  const theme = useTheme();
  const prevDashboard = usePrevious(dashboard?.id);
  const [showModal, setShowModal] = useState<boolean>(false);
  const toggleActiveKey = async (data: AlertObject, checked: boolean) => {
    if (data?.id) {
      dispatch(toggleActive(data, checked));
    }
  };

  const handleReportDelete = async (report: AlertObject) => {
    await dispatch(deleteActiveReport(report));
    setCurrentReportDeleting(null);
  };

  const shouldFetch =
    canAddReports() &&
    !!((dashboard?.id && prevDashboard !== dashboard?.id) || chart?.id);

  useEffect(() => {
    if (shouldFetch) {
      dispatch(
        fetchUISpecificReport({
          userId: user.userId,
          filterField: dashboard?.id ? 'dashboard_id' : 'chart_id',
          creationMethod: dashboard?.id ? 'dashboards' : 'charts',
          resourceId: dashboard?.id || chart?.id,
        }),
      );
    }
  }, []);

  // @z-index-below-dashboard-header (100) - 1 = 99
  const dropdownOverlayStyle = {
    zIndex: 99,
    animationDuration: '0s',
  };

  useEffect(() => {
    if (setShowReportSubMenu) {
      if (!isEmpty(report)) {
        setShowReportSubMenu(true);
      } else {
        setShowReportSubMenu(false);
      }
    }
  }, [report]);

  const handleShowMenu = () => {
    if (setIsDropdownVisible) {
      setIsDropdownVisible(false);
      setShowModal(true);
    }
  };

  const handleDeleteMenuClick = () => {
    if (setIsDropdownVisible) {
      setIsDropdownVisible(false);
      setCurrentReportDeleting(report);
    }
  };
  const textMenu = () =>
    isEmpty(report) ? (
      <Menu selectable={false} {...rest}>
        <Menu.Item onClick={handleShowMenu}>
          {DropdownItemExtension ? (
            <StyledDropdownItemWithIcon>
              <div>{TRANSLATIONS.CREATE_REPORT}</div>
              <DropdownItemExtension />
            </StyledDropdownItemWithIcon>
          ) : (
            TRANSLATIONS.CREATE_REPORT
          )}
        </Menu.Item>
      </Menu>
    ) : (
      isDropdownVisible && (
        <Menu selectable={false} css={{ border: 'none' }}>
          <Menu.Item onClick={() => toggleActiveKey(report, !isReportActive)}>
            <MenuItemWithCheckboxContainer>
              <Checkbox checked={isReportActive} onChange={noOp} />
              {TRANSLATIONS.ACTIVATE_REPORT}
            </MenuItemWithCheckboxContainer>
          </Menu.Item>
          <Menu.Item onClick={handleShowMenu}>
            {TRANSLATIONS.UPDATE_REPORT}
          </Menu.Item>
          <Menu.Item onClick={handleDeleteMenuClick}>
            {TRANSLATIONS.DELETE_REPORT}
          </Menu.Item>
        </Menu>
      )
    );
  const menu = () => (
    <Menu selectable={false} css={{ width: '200px' }}>
      <Menu.Item>
        {TRANSLATIONS.ACTIVATE_REPORT}
        <Switch
          data-test="toggle-active"
          checked={isReportActive}
          onClick={(checked: boolean) => toggleActiveKey(report, checked)}
          size="small"
          css={{ marginLeft: theme.gridUnit * 2 }}
        />
      </Menu.Item>
      <Menu.Item onClick={() => setShowModal(true)}>
        {TRANSLATIONS.UPDATE_REPORT}
      </Menu.Item>
      <Menu.Item
        onClick={() => setCurrentReportDeleting(report)}
        css={deleteColor}
      >
        {TRANSLATIONS.DELETE_REPORT}
      </Menu.Item>
    </Menu>
  );

  const iconMenu = () =>
    isEmpty(report) ? (
      <span
        role="button"
        title={t('Schedule report')}
        tabIndex={0}
        className="action-button action-schedule-report"
        onClick={() => setShowModal(true)}
      >
        <Icons.Calendar />
      </span>
    ) : (
      <>
        <NoAnimationDropdown
          overlay={menu()}
          overlayStyle={dropdownOverlayStyle}
          trigger={['click']}
          getPopupContainer={(triggerNode: any) =>
            triggerNode.closest('.action-button')
          }
        >
          <span
            role="button"
            className="action-button action-schedule-report"
            tabIndex={0}
          >
            <Icons.Calendar />
          </span>
        </NoAnimationDropdown>
      </>
    );

  return (
    <>
      {canAddReports() && (
        <>
          <AlertReportModal
            alert={isEmpty(report) ? null : report}
            show={showModal}
            onHide={() => {
              setShowModal(false);
            }}
            onCreate={response => dispatch(addReport(response))}
            onUpdate={response => dispatch(editReport(response))}
            dashboardObject={dashboard}
            chartObject={chart}
            creationMethod={
              dashboard ? CreationMethod.Dashboards : CreationMethod.Charts
            }
            isReport
          />
          {useTextMenu ? textMenu() : iconMenu()}
          {currentReportDeleting && (
            <DeleteModal
              description={t(
                'This action will permanently delete %s.',
                currentReportDeleting?.name,
              )}
              onConfirm={() => {
                if (currentReportDeleting) {
                  handleReportDelete(currentReportDeleting);
                }
              }}
              onHide={() => setCurrentReportDeleting(null)}
              open
              title={t('Delete report?')}
            />
          )}
        </>
      )}
    </>
  );
}
