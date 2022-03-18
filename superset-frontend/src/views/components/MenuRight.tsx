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
import { MainNav as Menu } from 'src/components/Menu';
import { t, styled, css, SupersetTheme } from '@superset-ui/core';
import { Link } from 'react-router-dom';
import Icons from 'src/components/Icons';
import findPermission from 'src/dashboard/util/findPermission';
import { useSelector } from 'react-redux';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import LanguagePicker from './LanguagePicker';
import DatabaseModal from '../CRUD/data/database/DatabaseModal';
import { checkUploadExtensions } from '../CRUD/utils';
import {
  ExtentionConfigs,
  GlobalMenuDataOptions,
  RightMenuProps,
} from './types';
import { MenuObjectProps } from './Menu';

const versionInfoStyles = (theme: SupersetTheme) => css`
  padding: ${theme.gridUnit * 1.5}px ${theme.gridUnit * 4}px
    ${theme.gridUnit * 4}px ${theme.gridUnit * 7}px;
  color: ${theme.colors.grayscale.base};
  font-size: ${theme.typography.sizes.xs}px;
  white-space: nowrap;
`;
const StyledI = styled.div`
  color: ${({ theme }) => theme.colors.primary.dark1};
`;

const StyledDiv = styled.div<{ align: string }>`
  display: flex;
  flex-direction: row;
  justify-content: ${({ align }) => align};
  align-items: center;
  margin-right: ${({ theme }) => theme.gridUnit}px;
  .ant-menu-submenu-title > svg {
    top: ${({ theme }) => theme.gridUnit * 5.25}px;
  }
`;

const StyledAnchor = styled.a`
  padding-right: ${({ theme }) => theme.gridUnit}px;
  padding-left: ${({ theme }) => theme.gridUnit}px;
`;

const { SubMenu } = Menu;

const RightMenu = ({
  align,
  settings,
  navbarRight,
  isFrontendRoute,
}: RightMenuProps) => {
  const { roles } = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const {
    CSV_EXTENSIONS,
    COLUMNAR_EXTENSIONS,
    EXCEL_EXTENSIONS,
    ALLOWED_EXTENSIONS,
    HAS_GSHEETS_INSTALLED,
  } = useSelector<any, ExtentionConfigs>(state => state.common.conf);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [engine, setEngine] = useState<string>('');
  const canSql = findPermission('can_sqllab', 'Superset', roles);
  const canDashboard = findPermission('can_write', 'Dashboard', roles);
  const canChart = findPermission('can_write', 'Chart', roles);
  const canDatabase = findPermission('can_write', 'Database', roles);

  const canUploadCSV = findPermission(
    'can_this_form_get',
    'CsvToDatabaseView',
    roles,
  );
  const canUploadColumnar = findPermission(
    'can_this_form_get',
    'ColumnarToDatabaseView',
    roles,
  );
  const canUploadExcel = findPermission(
    'can_this_form_get',
    'ExcelToDatabaseView',
    roles,
  );

  const canUpload = canUploadCSV || canUploadColumnar || canUploadExcel;
  const showActionDropdown = canSql || canChart || canDashboard;
  const dropdownItems: MenuObjectProps[] = [
    {
      label: t('Data'),
      icon: 'fa-database',
      childs: [
        {
          label: t('Connect database'),
          name: GlobalMenuDataOptions.DB_CONNECTION,
          perm: canDatabase,
        },
        {
          label: t('Connect Google Sheet'),
          name: GlobalMenuDataOptions.GOOGLE_SHEETS,
          perm: canDatabase && HAS_GSHEETS_INSTALLED,
        },
        {
          label: t('Upload CSV to database'),
          name: 'Upload a CSV',
          url: '/csvtodatabaseview/form',
          perm:
            checkUploadExtensions(CSV_EXTENSIONS, ALLOWED_EXTENSIONS) &&
            canUploadCSV,
        },
        {
          label: t('Upload columnar file to database'),
          name: 'Upload a Columnar file',
          url: '/columnartodatabaseview/form',
          perm:
            checkUploadExtensions(COLUMNAR_EXTENSIONS, ALLOWED_EXTENSIONS) &&
            canUploadColumnar,
        },
        {
          label: t('Upload Excel file to database'),
          name: 'Upload Excel',
          url: '/exceltodatabaseview/form',
          perm:
            checkUploadExtensions(EXCEL_EXTENSIONS, ALLOWED_EXTENSIONS) &&
            canUploadExcel,
        },
      ],
    },
    {
      label: t('SQL query'),
      url: '/superset/sqllab?new=true',
      icon: 'fa-fw fa-search',
      perm: 'can_sqllab',
      view: 'Superset',
    },
    {
      label: t('Chart'),
      url: '/chart/add',
      icon: 'fa-fw fa-bar-chart',
      perm: 'can_write',
      view: 'Chart',
    },
    {
      label: t('Dashboard'),
      url: '/dashboard/new',
      icon: 'fa-fw fa-dashboard',
      perm: 'can_write',
      view: 'Dashboard',
    },
  ];

  const menuIconAndLabel = (menu: MenuObjectProps) => (
    <>
      <i data-test={`menu-item-${menu.label}`} className={`fa ${menu.icon}`} />
      {menu.label}
    </>
  );

  const handleMenuSelection = (itemChose: any) => {
    if (itemChose.key === GlobalMenuDataOptions.DB_CONNECTION) {
      setShowModal(true);
    } else if (itemChose.key === GlobalMenuDataOptions.GOOGLE_SHEETS) {
      setShowModal(true);
      setEngine('Google Sheets');
    }
  };

  const handleOnHideModal = () => {
    setEngine('');
    setShowModal(false);
  };

  return (
    <StyledDiv align={align}>
      <DatabaseModal
        onHide={handleOnHideModal}
        show={showModal}
        dbEngine={engine}
      />
      <Menu selectable={false} mode="horizontal" onClick={handleMenuSelection}>
        {!navbarRight.user_is_anonymous && showActionDropdown && (
          <SubMenu
            data-test="new-dropdown"
            title={
              <StyledI data-test="new-dropdown-icon" className="fa fa-plus" />
            }
            icon={<Icons.TriangleDown />}
          >
            {dropdownItems.map(menu => {
              if (menu.childs) {
                return canDatabase || canUpload ? (
                  <SubMenu
                    key="sub2"
                    className="data-menu"
                    title={menuIconAndLabel(menu)}
                  >
                    {menu.childs.map((item, idx) =>
                      typeof item !== 'string' && item.name && item.perm ? (
                        <>
                          {idx === 2 && <Menu.Divider />}
                          <Menu.Item key={item.name}>
                            {item.url ? (
                              <a href={item.url}> {item.label} </a>
                            ) : (
                              item.label
                            )}
                          </Menu.Item>
                        </>
                      ) : null,
                    )}
                  </SubMenu>
                ) : null;
              }
              return (
                findPermission(
                  menu.perm as string,
                  menu.view as string,
                  roles,
                ) && (
                  <Menu.Item key={menu.label}>
                    <a href={menu.url}>
                      <i
                        data-test={`menu-item-${menu.label}`}
                        className={`fa ${menu.icon}`}
                      />{' '}
                      {menu.label}
                    </a>
                  </Menu.Item>
                )
              );
            })}
          </SubMenu>
        )}
        <SubMenu
          title={t('Settings')}
          icon={<Icons.TriangleDown iconSize="xl" />}
        >
          {settings.map((section, index) => [
            <Menu.ItemGroup key={`${section.label}`} title={section.label}>
              {section.childs?.map(child => {
                if (typeof child !== 'string') {
                  return (
                    <Menu.Item key={`${child.label}`}>
                      {isFrontendRoute(child.url) ? (
                        <Link to={child.url || ''}>{child.label}</Link>
                      ) : (
                        <a href={child.url}>{child.label}</a>
                      )}
                    </Menu.Item>
                  );
                }
                return null;
              })}
            </Menu.ItemGroup>,
            index < settings.length - 1 && <Menu.Divider />,
          ])}

          {!navbarRight.user_is_anonymous && [
            <Menu.Divider key="user-divider" />,
            <Menu.ItemGroup key="user-section" title={t('User')}>
              {navbarRight.user_profile_url && (
                <Menu.Item key="profile">
                  <a href={navbarRight.user_profile_url}>{t('Profile')}</a>
                </Menu.Item>
              )}
              {navbarRight.user_info_url && (
                <Menu.Item key="info">
                  <a href={navbarRight.user_info_url}>{t('Info')}</a>
                </Menu.Item>
              )}
              <Menu.Item key="logout">
                <a href={navbarRight.user_logout_url}>{t('Logout')}</a>
              </Menu.Item>
            </Menu.ItemGroup>,
          ]}
          {(navbarRight.version_string || navbarRight.version_sha) && [
            <Menu.Divider key="version-info-divider" />,
            <Menu.ItemGroup key="about-section" title={t('About')}>
              <div className="about-section">
                {navbarRight.show_watermark && (
                  <div css={versionInfoStyles}>
                    {t('Powered by Apache Superset')}
                  </div>
                )}
                {navbarRight.version_string && (
                  <div css={versionInfoStyles}>
                    Version: {navbarRight.version_string}
                  </div>
                )}
                {navbarRight.version_sha && (
                  <div css={versionInfoStyles}>
                    SHA: {navbarRight.version_sha}
                  </div>
                )}
                {navbarRight.build_number && (
                  <div css={versionInfoStyles}>
                    Build: {navbarRight.build_number}
                  </div>
                )}
              </div>
            </Menu.ItemGroup>,
          ]}
        </SubMenu>
        {navbarRight.show_language_picker && (
          <LanguagePicker
            locale={navbarRight.locale}
            languages={navbarRight.languages}
          />
        )}
      </Menu>
      {navbarRight.documentation_url && (
        <StyledAnchor
          href={navbarRight.documentation_url}
          target="_blank"
          rel="noreferrer"
          title={t('Documentation')}
        >
          <i className="fa fa-question" />
          &nbsp;
        </StyledAnchor>
      )}
      {navbarRight.bug_report_url && (
        <StyledAnchor
          href={navbarRight.bug_report_url}
          target="_blank"
          rel="noreferrer"
          title={t('Report a bug')}
        >
          <i className="fa fa-bug" />
        </StyledAnchor>
      )}
      {navbarRight.user_is_anonymous && (
        <StyledAnchor href={navbarRight.user_login_url}>
          <i className="fa fa-fw fa-sign-in" />
          {t('Login')}
        </StyledAnchor>
      )}
    </StyledDiv>
  );
};

export default RightMenu;
