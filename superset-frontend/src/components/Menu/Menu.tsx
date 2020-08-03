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
import { t } from '@superset-ui/translation';
import { Nav, Navbar, NavItem } from 'react-bootstrap';
import styled from '@superset-ui/style';
import MenuObject, { MenuObjectProps } from './MenuObject';
import NewMenu from './NewMenu';
import UserMenu from './UserMenu';
import LanguagePicker, { Languages } from './LanguagePicker';
import './Menu.less';

interface BrandProps {
  path: string;
  icon: string;
  alt: string;
  width: string | number;
}

interface NavBarProps {
  bug_report_url?: string;
  version_string?: string;
  version_sha?: string;
  documentation_url?: string;
  languages: Languages;
  show_language_picker: boolean;
  user_is_anonymous: boolean;
  user_info_url: string;
  user_login_url: string;
  user_logout_url: string;
  locale: string;
}

export interface MenuProps {
  data: {
    menu: MenuObjectProps[];
    brand: BrandProps;
    navbar_right: NavBarProps;
  };
}

const StyledHeader = styled.header`
  .navbar-brand {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .navbar-nav > li > a {
    &:after {
      content: '';
      position: absolute;
      bottom: -3px;
      left: 0;
      width: 100%;
      height: 3px;
      background-color: ${({ theme }) => theme.colors.primary.base};
      opacity: 0;
      transition: opacity ${({ theme }) => theme.transitionTiming * 2}s;
    }

    &:hover {
      border-bottom: none;

      &:after {
        opacity: 1;
      }
    }
  }
`;

export default function Menu({
  data: { menu, brand, navbar_right: navbarRight },
}: MenuProps) {
  return (
    <StyledHeader className="top" id="main-menu">
      <Navbar inverse fluid staticTop role="navigation">
        <Navbar.Header>
          <Navbar.Brand>
            <a className="navbar-brand" href={brand.path}>
              <img width={brand.width} src={brand.icon} alt={brand.alt} />
            </a>
          </Navbar.Brand>
          <Navbar.Toggle />
        </Navbar.Header>
        <Nav>
          {menu.map((item, index) => (
            <MenuObject {...item} key={item.label} index={index + 1} />
          ))}
        </Nav>
        <Nav className="navbar-right">
          {!navbarRight.user_is_anonymous && <NewMenu />}
          {navbarRight.documentation_url && (
            <NavItem
              href={navbarRight.documentation_url}
              target="_blank"
              title="Documentation"
            >
              <i className="fa fa-question" />
              &nbsp;
            </NavItem>
          )}
          {navbarRight.bug_report_url && (
            <NavItem
              href={navbarRight.bug_report_url}
              target="_blank"
              title="Report a Bug"
            >
              <i className="fa fa-bug" />
              &nbsp;
            </NavItem>
          )}
          {navbarRight.show_language_picker && (
            <LanguagePicker
              locale={navbarRight.locale}
              languages={navbarRight.languages}
            />
          )}
          {!navbarRight.user_is_anonymous && (
            <UserMenu
              userInfoUrl={navbarRight.user_info_url}
              userLogoutUrl={navbarRight.user_logout_url}
              versionString={navbarRight.version_string}
              versionSha={navbarRight.version_sha}
            />
          )}
          {navbarRight.user_is_anonymous && (
            <NavItem href={navbarRight.user_login_url}>
              <i className="fa fa-fw fa-sign-in" />
              {t('Login')}
            </NavItem>
          )}
        </Nav>
      </Navbar>
    </StyledHeader>
  );
}
