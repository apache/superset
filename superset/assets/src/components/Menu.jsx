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
import { Nav, Navbar, NavItem, NavDropdown, MenuItem } from 'react-bootstrap';

function MenuObject({ label, icon, childs, url, index }) {
  if (url) {
    return (
      <NavItem eventKey={index} href={url}>
        <i className={`fa ${icon}`} /> &nbsp; {label}
      </NavItem>
    );
  }

  const navTitle = (
    <React.Fragment>
      <i className={`fa ${icon}`} />
      &nbsp; {label}
    </React.Fragment>
  );
  return (
    <NavDropdown id={`menu-dropdown-${label}`} eventKey={index} title={navTitle}>
      {childs.map((child, index1) =>
        child === '-' ? (
          <MenuItem key={`$${index1}`} divider />
        ) : (
          <MenuItem
            key={`${child.label}`}
            href={child.url}
            eventKey={parseFloat(`${index}.${index1}`)}
          >
            <i className={`fa ${child.icon}`} />
            {child.label}
          </MenuItem>
        ),
      )}
    </NavDropdown>
  );
}

MenuObject.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  url: PropTypes.string,
  childs: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
};

function NewMenu() {
  return (
    <li className="dropdown">
      <button
        type="button"
        style={{
          marginTop: '12px',
          marginRight: '30px',
        }}
        data-toggle="dropdown"
        className="dropdown-toggle btn btn-sm btn-primary"
      >
        <i className="fa fa-plus" /> New
      </button>
      <ul className="dropdown-menu">
        <li>
          <a href="/superset/sqllab">
            <span className="fa fa-fw fa-search" />
            {t('SQL Query')}
          </a>
        </li>
        <li>
          <a href="/chart/add">
            <span className="fa fa-fw fa-bar-chart" />
            {t('Chart')}
          </a>
        </li>
        <li>
          <a href="/dashboard/new/">
            <span className="fa fa-fw fa-dashboard" />
            {t('Dashboard')}
          </a>
        </li>
      </ul>
    </li>
  );
}

NewMenu.propTypes = {};

function LanguagePicker({ locale, languages }) {
  return (
    <NavDropdown
      id="locale-dropdown"
      title={
        <span className="f16">
          <i className={`flag ${languages[locale].flag}`} />
        </span>
      }
    >
      {Object.keys(languages).map(langKey =>
        langKey === locale ? null : (
          <MenuItem key={langKey} href={languages[langKey].url}>
            {' '}
            <div className="f16">
              <i className={`flag ${languages[langKey].flag}`} /> - {languages[langKey].name}
            </div>
          </MenuItem>
        ),
      )}
    </NavDropdown>
  );
}

LanguagePicker.propTypes = {
  locale: PropTypes.string.isRequired,
  languages: PropTypes.object.isRequired,
};

function UserMenu({ userInfoUrl, userLogoutUrl }) {
  return (
    <NavDropdown
      id="user-menu-dropwn"
      title={
        <React.Fragment>
          <i className="fa fa-user" />
        </React.Fragment>
      }
    >
      <MenuItem href={userInfoUrl}>
        <span className="fa fa-fw fa-user" />
        {t('Profile')}
      </MenuItem>
      <MenuItem href={userLogoutUrl}>
        <span className="fa fa-fw fa-sign-out" />
        {t('Logout')}
      </MenuItem>
    </NavDropdown>
  );
}

UserMenu.propTypes = {
  userInfoUrl: PropTypes.string.isRequired,
  userLogoutUrl: PropTypes.string.isRequired,
};

export default function Menu({ data: { menu, brand, navbar_right: navbarRight } }) {
  return (
    <header className="top">
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
            <LanguagePicker locale={navbarRight.locale} languages={navbarRight.languages} />
          )}
          {!navbarRight.user_is_anonymous && (
            <UserMenu
              userInfoUrl={navbarRight.user_info_url}
              userLogoutUrl={navbarRight.user_logout_url}
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

Menu.propTypes = {
  data: PropTypes.shape({
    menu: PropTypes.arrayOf(PropTypes.object).isRequired,
    brand: PropTypes.shape({
      path: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      alt: PropTypes.string.isRequired,
    }).isRequired,
    navbar_right: PropTypes.shape({
      bug_report_url: PropTypes.string,
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
