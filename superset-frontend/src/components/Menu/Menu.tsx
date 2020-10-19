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
import { t, styled } from '@superset-ui/core';
import { Nav, Navbar, NavItem, MenuItem } from 'react-bootstrap';
import NavDropdown from 'src/components/NavDropdown';
import MenuObject, {
  MenuObjectProps,
  MenuObjectChildProps,
} from './MenuObject';
import NewMenu from './NewMenu';
import UserMenu from './UserMenu';
import LanguagePicker, { Languages } from './LanguagePicker';

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
    settings: MenuObjectProps[];
  };
}

const StyledHeader = styled.header`
  &:nth-last-of-type(2) nav {
    margin-bottom: 2px;
  }

  .caret {
    display: none;
  }

  .navbar-inverse {
    border: none;
  }

  .version-info {
    padding: 5px 20px;
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;

    div {
      white-space: nowrap;
    }
  }

  .navbar-brand {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .nav > li > a {
    padding: ${({ theme }) => theme.gridUnit * 4}px;
  }

  .navbar-nav > li > a {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    border-bottom: none;
    &:focus {
      border-bottom: none;
    }
    &:after {
      content: '';
      position: absolute;
      bottom: -3px;
      left: 50%;
      width: 0;
      height: 3px;
      background-color: ${({ theme }) => theme.colors.primary.base};
      opacity: 0;
      transform: translateX(-50%);
      transition: all ${({ theme }) => theme.transitionTiming}s;
    }

    &:hover {
      color: ${({ theme }) => theme.colors.grayscale.dark1};
      border-bottom: none;
      &:after {
        opacity: 1;
        width: 100%;
      }
    }
    &:hover,
    &:focus {
      margin: 0;
    }
  }

  .settings-divider {
    margin-bottom: 8px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
  .navbar-right {
    display: flex;
    align-items: center;
    .dropdown:first-of-type {
      /* this is the "+ NEW" button. Sweep this up when it's replaced */
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }
`;

export function Menu({
  data: { menu, brand, navbar_right: navbarRight, settings },
}: MenuProps) {
  // Flatten settings
  const flatSettings: any[] = [];

  if (settings) {
    settings.forEach((section: object, index: number) => {
      const newSection: MenuObjectProps = {
        ...section,
        index,
        isHeader: true,
      };

      flatSettings.push(newSection);

      // Filter out '-'
      if (newSection.childs) {
        newSection.childs.forEach((child: any) => {
          if (child !== '-') {
            flatSettings.push(child);
          }
        });
      }

      if (index !== settings.length - 1) {
        flatSettings.push('-');
      }
    });
  }

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
          {settings && settings.length > 0 && (
            <NavDropdown id="settings-dropdown" title={t('Settings')}>
              {flatSettings.map((section, index) => {
                if (section === '-') {
                  return (
                    <MenuItem
                      key={`$${index}`}
                      divider
                      disabled
                      className="settings-divider"
                    />
                  );
                }
                if (section.isHeader) {
                  return (
                    <MenuItem key={`${section.label}`} disabled>
                      {section.label}
                    </MenuItem>
                  );
                }

                return (
                  <MenuItem
                    key={`${section.label}`}
                    href={section.url}
                    eventKey={index}
                  >
                    {section.label}
                  </MenuItem>
                );
              })}
            </NavDropdown>
          )}
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

// transform the menu data to reorganize components
export default function MenuWrapper({ data }: MenuProps) {
  const newMenuData = {
    ...data,
  };
  // Menu items that should go into settings dropdown
  const settingsMenus = {
    Security: true,
    Manage: true,
  };

  // Cycle through menu.menu to build out cleanedMenu and settings
  const cleanedMenu: MenuObjectProps[] = [];
  const settings: MenuObjectProps[] = [];

  newMenuData.menu.forEach((item: any) => {
    if (!item) {
      return;
    }

    const children: (MenuObjectProps | string)[] = [];
    const newItem = {
      ...item,
    };

    // Filter childs
    if (item.childs) {
      item.childs.forEach((child: MenuObjectChildProps | string) => {
        if (typeof child === 'string') {
          children.push(child);
        } else if ((child as MenuObjectChildProps).label) {
          children.push(child);
        }
      });

      newItem.childs = children;
    }

    if (!settingsMenus.hasOwnProperty(item.name)) {
      cleanedMenu.push(newItem);
    } else {
      settings.push(newItem);
    }
  });

  newMenuData.menu = cleanedMenu;
  newMenuData.settings = settings;

  return <Menu data={newMenuData} />;
}
