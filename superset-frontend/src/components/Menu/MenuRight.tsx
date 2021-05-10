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
import { MainNav as Menu } from 'src/common/components';
import { t, styled, css, SupersetTheme } from '@superset-ui/core';
import { Link } from 'react-router-dom';
import Icon from 'src/components/Icon';
import LanguagePicker from './LanguagePicker';
import { NavBarProps, MenuObjectProps } from './Menu';

export const dropdownItems = [
  {
    label: t('SQL query'),
    url: '/superset/sqllab',
    icon: 'fa-fw fa-search',
  },
  {
    label: t('Chart'),
    url: '/chart/add',
    icon: 'fa-fw fa-bar-chart',
  },
  {
    label: t('Dashboard'),
    url: '/dashboard/new',
    icon: 'fa-fw fa-dashboard',
  },
];

const versionInfoStyles = (theme: SupersetTheme) => css`
  padding: ${theme.gridUnit * 1.5}px ${theme.gridUnit * 4}px
    ${theme.gridUnit * 1.5}px ${theme.gridUnit * 7}px;
  color: ${theme.colors.grayscale.base};
  font-size: ${theme.typography.sizes.xs}px;
  white-space: nowrap;
`;
const StyledI = styled.div`
  color: ${({ theme }) => theme.colors.primary.dark1};
`;

const { SubMenu } = Menu;

interface RightMenuProps {
  settings: MenuObjectProps[];
  navbarRight: NavBarProps;
  isFrontendRoute: (path?: string) => boolean;
}

const RightMenu = ({
  settings,
  navbarRight,
  isFrontendRoute,
}: RightMenuProps) => (
  <Menu className="navbar-right" mode="horizontal">
    {!navbarRight.user_is_anonymous && (
      <SubMenu
        data-test="new-dropdown"
        title={<StyledI data-test="new-dropdown-icon" className="fa fa-plus" />}
        icon={<Icon name="triangle-down" />}
      >
        {dropdownItems.map((menu, i) => (
          <Menu.Item key={i}>
            <a href={menu.url}>
              <i
                data-test={`menu-item-${menu.label}`}
                className={`fa ${menu.icon}`}
              />{' '}
              {menu.label}
            </a>
          </Menu.Item>
        ))}
      </SubMenu>
    )}
    <SubMenu title="Settings" icon={<Icon name="triangle-down" />}>
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
          <Menu.Item key="info">
            <a href={navbarRight.user_info_url}>{t('Info')}</a>
          </Menu.Item>
          <Menu.Item key="logout">
            <a href={navbarRight.user_logout_url}>{t('Logout')}</a>
          </Menu.Item>
        </Menu.ItemGroup>,
      ]}
      {(navbarRight.version_string || navbarRight.version_sha) && [
        <Menu.Divider key="version-info-divider" />,
        <Menu.ItemGroup key="about-section" title={t('About')}>
          <div className="about-section">
            {navbarRight.version_string && (
              <li css={versionInfoStyles}>
                Version: {navbarRight.version_string}
              </li>
            )}
            {navbarRight.version_sha && (
              <li css={versionInfoStyles}>SHA: {navbarRight.version_sha}</li>
            )}
          </div>
        </Menu.ItemGroup>,
      ]}
    </SubMenu>
    {navbarRight.documentation_url && (
      <Menu.Item title="Documentation">
        <a
          href={navbarRight.documentation_url}
          target="_blank"
          rel="noreferrer"
        >
          <i className="fa fa-question" />
          &nbsp;
        </a>
      </Menu.Item>
    )}
    {navbarRight.bug_report_url && (
      <Menu.Item title="Report a Bug">
        <a href={navbarRight.bug_report_url} target="_blank" rel="noreferrer">
          <i className="fa fa-bug" />
        </a>
        &nbsp;
      </Menu.Item>
    )}
    {navbarRight.show_language_picker && (
      <Menu.Item>
        <LanguagePicker
          locale={navbarRight.locale}
          languages={navbarRight.languages}
        />
      </Menu.Item>
    )}
    {navbarRight.user_is_anonymous && (
      <Menu.Item>
        <a href={navbarRight.user_login_url}>
          <i className="fa fa-fw fa-sign-in" />
          {t('Login')}
        </a>
      </Menu.Item>
    )}
  </Menu>
);

export default RightMenu;
