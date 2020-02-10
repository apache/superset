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
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';
import { Nav, Navbar, NavItem } from 'react-bootstrap';
import MenuObject from './MenuObject';
import NewMenu from './NewMenu';
import UserMenu from './UserMenu';
import LanguagePicker from './LanguagePicker';
import './Menu.less';

const propTypes = {
  data: PropTypes.shape({
    menu: PropTypes.arrayOf(PropTypes.object).isRequired,
    brand: PropTypes.shape({
      path: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      alt: PropTypes.string.isRequired,
    }).isRequired,
    navbar_right: PropTypes.shape({
      bug_report_url: PropTypes.string,
      version_string: PropTypes.string,
      version_sha: PropTypes.string,
      documentation_url: PropTypes.string,
      languages: PropTypes.object,
      show_language_picker: PropTypes.bool.isRequired,
      user_is_anonymous: PropTypes.bool.isRequired,
      user_info_url: PropTypes.string.isRequired,
      user_login_url: PropTypes.string.isRequired,
      user_logout_url: PropTypes.string.isRequired,
      locale: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

export default function Menu({
  data: { menu, brand, navbar_right: navbarRight },
}) {
  return (
    <header className="top" id="main-menu">
      <Navbar inverse fluid staticTop role="navigation">
        <Navbar.Header>
          <Navbar.Brand>
            <a className="navbar-brand" href={brand.path}>
              <img width="126" src={brand.icon} alt={brand.alt} />
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
            <NavItem href={navbarRight.documentation_url} title="Documentation">
              <i className="fa fa-question" />
              &nbsp;
            </NavItem>
          )}
          {navbarRight.bug_report_url && (
            <NavItem href={navbarRight.bug_report_url} title="Report a Bug">
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
    </header>
  );
}

Menu.propTypes = propTypes;
